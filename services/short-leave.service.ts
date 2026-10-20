import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { LeaveRequestStatus } from "@/lib/generated/prisma/client";
import { toMinutes } from "@/lib/attendance/attendance-rules";
import { monthRange, parseIsoDate } from "@/lib/attendance/dates";
import type { ShortLeaveInput } from "@/validations/leave.validation";
import { reprocessEmployeeRange } from "./attendance.service";
import { getSettings } from "./settings.service";

const atMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

export async function createShortLeave(input: ShortLeaveInput, userId: string) {
  const date = parseIsoDate(input.date);
  if (!date) throw new ServiceError("Invalid date.");

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, isActive: true },
  });
  if (!employee || !employee.isActive)
    throw new ServiceError("Employee not found or inactive.");

  const settings = await getSettings();
  const from = toMinutes(input.startTime);
  const to = toMinutes(input.endTime);
  const duration = to - from;

  if (
    from < toMinutes(settings.shiftStart) ||
    to > toMinutes(settings.shiftEnd)
  ) {
    throw new ServiceError(
      `A short leave must be within shift hours (${settings.shiftStart} to ${settings.shiftEnd}).`,
    );
  }
  if (duration > settings.shortLeaveMaxMinutes) {
    throw new ServiceError(
      `A short leave can be at most ${settings.shortLeaveMaxMinutes} minutes. Use a full-day leave for longer absences.`,
    );
  }

  const sameDay = await prisma.shortLeave.findFirst({
    where: {
      employeeId: employee.id,
      date,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });
  if (sameDay)
    throw new ServiceError(
      "This employee already has a short leave on this date.",
    );

  if (settings.shortLeaveMonthlyLimit > 0) {
    const { start, end } = monthRange(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
    );
    const count = await prisma.shortLeave.count({
      where: {
        employeeId: employee.id,
        status: { in: ["PENDING", "APPROVED"] },
        date: { gte: start, lt: end },
      },
    });
    if (count >= settings.shortLeaveMonthlyLimit) {
      throw new ServiceError(
        `Monthly limit reached: ${settings.shortLeaveMonthlyLimit} short leave(s) per month.`,
      );
    }
  }

  const approved = input.approveNow;
  const created = await prisma.shortLeave.create({
    data: {
      employeeId: employee.id,
      date,
      startTime: atMinutes(date, from),
      endTime: atMinutes(date, to),
      durationMinutes: duration,
      reason: input.reason ?? null,
      status: approved ? "APPROVED" : "PENDING",
      decidedById: approved ? userId : null,
      decidedAt: approved ? new Date() : null,
    },
  });

  if (approved) await reprocessEmployeeRange(employee.id, date, date);
  return created;
}

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
};

export async function decideShortLeave(
  id: string,
  decision: "APPROVED" | "REJECTED" | "CANCELLED",
  userId: string,
) {
  const sl = await prisma.shortLeave.findUnique({ where: { id } });
  if (!sl) throw new ServiceError("Short leave not found.");
  if (!TRANSITIONS[sl.status]?.includes(decision)) {
    throw new ServiceError(
      `A ${sl.status.toLowerCase()} short leave cannot be changed to ${decision.toLowerCase()}.`,
    );
  }

  const previousStatus = sl.status;
  const updated = await prisma.shortLeave.update({
    where: { id },
    data: { status: decision, decidedById: userId, decidedAt: new Date() },
  });

  if (
    decision === "APPROVED" ||
    (previousStatus === "APPROVED" && decision === "CANCELLED")
  ) {
    await reprocessEmployeeRange(sl.employeeId, sl.date, sl.date);
  }
  return updated;
}

export function listShortLeaves(status?: LeaveRequestStatus) {
  return prisma.shortLeave.findMany({
    where: status ? { status } : {},
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { employee: { select: { name: true, employeeCode: true } } },
  });
}
