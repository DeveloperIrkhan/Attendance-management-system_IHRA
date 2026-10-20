import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { LeaveRequestStatus } from "@/lib/generated/prisma/client";
import type { DayType } from "@/lib/attendance/attendance-rules";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/attendance/dates";
import type {
  LeaveRequestInput,
  LeaveTypeInput,
} from "@/validations/leave.validation";
import { reprocessEmployeeRange } from "./attendance.service";
import { getMonthCalendar, makeDayTypeResolver } from "./settings.service";

const yearRange = (year: number) => ({
  start: new Date(Date.UTC(year, 0, 1)),
  end: new Date(Date.UTC(year + 1, 0, 1)),
});

export function listLeaveTypes() {
  return prisma.leaveType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { leaveRequests: true } } },
  });
}

export async function createLeaveType(input: LeaveTypeInput) {
  const exists = await prisma.leaveType.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists)
    throw new ServiceError("A leave type with this name already exists.");
  return prisma.leaveType.create({
    data: {
      name: input.name,
      isPaid: input.isPaid,
      yearlyQuotaDays: input.yearlyQuotaDays,
    },
  });
}

export async function updateLeaveType(id: string, input: LeaveTypeInput) {
  const exists = await prisma.leaveType.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, NOT: { id } },
    select: { id: true },
  });
  if (exists)
    throw new ServiceError("A leave type with this name already exists.");
  return prisma.leaveType.update({
    where: { id },
    data: {
      name: input.name,
      isPaid: input.isPaid,
      yearlyQuotaDays: input.yearlyQuotaDays,
    },
  });
}

export function setLeaveTypeActive(id: string, isActive: boolean) {
  return prisma.leaveType.update({ where: { id }, data: { isActive } });
}

export function listEmployeeOptions() {
  return prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true },
  });
}

export async function countWorkingDays(
  start: Date,
  end: Date,
): Promise<number> {
  const resolvers = new Map<string, (d: Date) => DayType>();
  let count = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    let resolver = resolvers.get(key);
    if (!resolver) {
      resolver = makeDayTypeResolver(
        await getMonthCalendar(d.getUTCFullYear(), d.getUTCMonth() + 1),
      );
      resolvers.set(key, resolver);
    }
    if (resolver(d) === "WORKING") count++;
  }
  return count;
}

async function usedDays(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  statuses: LeaveRequestStatus[],
  excludeId?: string,
) {
  const { start, end } = yearRange(year);
  const agg = await prisma.leaveRequest.aggregate({
    _sum: { days: true },
    where: {
      employeeId,
      leaveTypeId,
      status: { in: statuses },
      startDate: { gte: start, lt: end },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return agg._sum.days ?? 0;
}

async function assertNoOverlap(
  employeeId: string,
  start: Date,
  end: Date,
  excludeId?: string,
) {
  const clash = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { startDate: true, endDate: true, status: true },
  });
  if (clash) {
    throw new ServiceError(
      `This employee already has a ${clash.status.toLowerCase()} leave from ${toIsoDate(clash.startDate)} to ${toIsoDate(clash.endDate)}.`,
    );
  }
}

export async function createLeaveRequest(
  input: LeaveRequestInput,
  userId: string,
) {
  const start = parseIsoDate(input.startDate);
  const end = parseIsoDate(input.endDate);
  if (!start || !end) throw new ServiceError("Invalid date.");

  const [employee, leaveType] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, isActive: true },
    }),
    prisma.leaveType.findUnique({ where: { id: input.leaveTypeId } }),
  ]);
  if (!employee || !employee.isActive)
    throw new ServiceError("Employee not found or inactive.");
  if (!leaveType || !leaveType.isActive)
    throw new ServiceError("Leave type not found or inactive.");

  await assertNoOverlap(employee.id, start, end);

  const days = await countWorkingDays(start, end);
  if (days === 0) {
    throw new ServiceError(
      "The selected dates contain no working days (only weekly off days or holidays).",
    );
  }

  if (leaveType.yearlyQuotaDays !== null) {
    const used = await usedDays(
      employee.id,
      leaveType.id,
      start.getUTCFullYear(),
      ["APPROVED", "PENDING"],
    );
    if (used + days > leaveType.yearlyQuotaDays) {
      throw new ServiceError(
        `Quota exceeded for ${leaveType.name}: ${used} of ${leaveType.yearlyQuotaDays} days already approved or pending, and this request needs ${days}.`,
      );
    }
  }

  const approved = input.approveNow;
  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: start,
      endDate: end,
      reason: input.reason ?? null,
      days,
      status: approved ? "APPROVED" : "PENDING",
      decidedById: approved ? userId : null,
      decidedAt: approved ? new Date() : null,
    },
  });

  if (approved) await reprocessEmployeeRange(employee.id, start, end);
  return created;
}

const LEAVE_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
};

export async function decideLeaveRequest(
  id: string,
  decision: "APPROVED" | "REJECTED" | "CANCELLED",
  userId: string,
) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { leaveType: true },
  });
  if (!request) throw new ServiceError("Leave request not found.");

  if (!LEAVE_TRANSITIONS[request.status]?.includes(decision)) {
    throw new ServiceError(
      `A ${request.status.toLowerCase()} request cannot be changed to ${decision.toLowerCase()}.`,
    );
  }

  let days = request.days;
  if (decision === "APPROVED") {
    // The calendar may have changed since the request was made: recount and re-check.
    days = await countWorkingDays(request.startDate, request.endDate);
    if (days === 0)
      throw new ServiceError("The request now contains no working days.");

    await assertNoOverlap(
      request.employeeId,
      request.startDate,
      request.endDate,
      request.id,
    );

    const quota = request.leaveType.yearlyQuotaDays;
    if (quota !== null) {
      const used = await usedDays(
        request.employeeId,
        request.leaveTypeId,
        request.startDate.getUTCFullYear(),
        ["APPROVED"],
        request.id,
      );
      if (used + days > quota) {
        throw new ServiceError(
          `Quota exceeded for ${request.leaveType.name}: ${used} of ${quota} days already approved, and this request needs ${days}.`,
        );
      }
    }
  }

  const previousStatus = request.status;
  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: decision,
      days,
      decidedById: userId,
      decidedAt: new Date(),
    },
  });

  if (
    decision === "APPROVED" ||
    (previousStatus === "APPROVED" && decision === "CANCELLED")
  ) {
    await reprocessEmployeeRange(
      request.employeeId,
      request.startDate,
      request.endDate,
    );
  }
  return updated;
}

export function listLeaveRequests(status?: LeaveRequestStatus) {
  return prisma.leaveRequest.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: {
      employee: { select: { name: true, employeeCode: true } },
      leaveType: { select: { name: true } },
    },
  });
}

export async function getLeaveBalances(year: number) {
  const { start, end } = yearRange(year);
  const [types, employees, grouped] = await Promise.all([
    prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
    }),
    prisma.leaveRequest.groupBy({
      by: ["employeeId", "leaveTypeId", "status"],
      where: {
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { gte: start, lt: end },
      },
      _sum: { days: true },
    }),
  ]);

  const usage: Record<string, { approved: number; pending: number }> = {};
  for (const g of grouped) {
    const key = `${g.employeeId}|${g.leaveTypeId}`;
    const entry = (usage[key] ??= { approved: 0, pending: 0 });
    if (g.status === "APPROVED") entry.approved += g._sum.days ?? 0;
    else entry.pending += g._sum.days ?? 0;
  }
  return { types, employees, usage };
}
