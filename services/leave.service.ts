import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { LeaveRequestStatus } from "@/lib/generated/prisma/client";
import {
  getApproverIdentity,
  hasPermission,
  type AuthUser,
} from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  APPROVER_LABEL,
  SHORT_ROUTE_MAX_DAYS,
  canDecideRequest,
  levelsAbove,
  resolveApprovalRoute,
  type ApprovalLevel,
  type ApproverLevel,
} from "@/lib/leave/approval-routing";
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

/**
 * Is there an active login for someone who may decide at this level?
 * Counts the level itself (a DD only inside `departmentId`) and every level above it,
 * because higher levels hold parent rights.
 */
async function hasActiveApprover(
  level: ApproverLevel,
  opts: { departmentId?: string; excludeEmployeeId: string },
) {
  const higher = levelsAbove(level);
  const found = await prisma.employee.findFirst({
    where: {
      id: { not: opts.excludeEmployeeId },
      isActive: true,
      user: { is: { isActive: true } },
      OR: [
        {
          designation: { approvalLevel: level },
          // a DD counts inside their own department and where they hold additional charge
          ...(level === "DD" && opts.departmentId
            ? {
                OR: [
                  { departmentId: opts.departmentId },
                  {
                    additionalCharges: {
                      some: { departmentId: opts.departmentId },
                    },
                  },
                ],
              }
            : {}),
        },
        ...(higher.length
          ? [{ designation: { approvalLevel: { in: higher } } }]
          : []),
        // someone acting as CEO / Chairman while the post is vacant
        { actingApprovals: { some: { level: { in: [level, ...higher] } } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Says exactly why nobody can approve, so HR knows what to fix.
 * A short request from staff (AD, SO...) needs an active DD, with a login, in the
 * SAME department. Only when there is none does it go to the CEO, so a "no CEO" error
 * usually hides the real problem: the department has no usable DD.
 */
async function explainMissingApprover(opts: {
  requesterId: string;
  departmentId: string;
  approverLevel: ApproverLevel;
  /** true when this was a short staff request that looked for a department DD first */
  escalatedFromDd: boolean;
  days: number;
}): Promise<string> {
  const generic = `No active ${APPROVER_LABEL[opts.approverLevel]} login exists for this request. Set the approval level on the designation and make sure that employee is active. If the post is vacant, an acting ${APPROVER_LABEL[opts.approverLevel]} can be set on the Departments page.`;

  if (opts.approverLevel !== "CEO" || !opts.escalatedFromDd) {
    // e.g. a long request from staff goes straight to the CEO, by rule
    if (opts.approverLevel === "CEO" && opts.days > SHORT_ROUTE_MAX_DAYS) {
      return `This request is ${opts.days} working days. Requests of more than ${SHORT_ROUTE_MAX_DAYS} working days from staff go to the CEO, and no active CEO login exists. ${generic}`;
    }
    return generic;
  }

  const [department, ddsHere, ddsElsewhere] = await Promise.all([
    prisma.department.findUnique({
      where: { id: opts.departmentId },
      select: { name: true },
    }),
    prisma.employee.findMany({
      where: {
        id: { not: opts.requesterId },
        designation: { approvalLevel: "DD" },
        OR: [
          { departmentId: opts.departmentId },
          { additionalCharges: { some: { departmentId: opts.departmentId } } },
        ],
      },
      select: {
        name: true,
        isActive: true,
        user: { select: { isActive: true } },
      },
    }),
    prisma.employee.findMany({
      where: {
        departmentId: { not: opts.departmentId },
        additionalCharges: { none: { departmentId: opts.departmentId } },
        isActive: true,
        user: { is: { isActive: true } },
        designation: { approvalLevel: "DD" },
      },
      select: { name: true, department: { select: { name: true } } },
      take: 3,
    }),
  ]);

  const dept = department?.name ?? "this department";
  const lead = `This request goes to the DD of ${dept}, but no DD there can approve it`;
  let reason: string;
  if (ddsHere.length === 0) {
    reason = `no employee in ${dept} has a designation with approval level "DD", and no DD has been given additional charge of it (Departments page, "Additional charge")`;
  } else {
    const problems = ddsHere.map((d) =>
      !d.isActive
        ? `${d.name} is inactive`
        : !d.user
          ? `${d.name} has no login`
          : `${d.name}'s login is deactivated`,
    );
    reason = problems.join("; ");
  }
  const elsewhere = ddsElsewhere.length
    ? ` A DD only decides for their own department or one they hold additional charge of. Found DD(s) in other departments: ${ddsElsewhere
        .map((d) => `${d.name} (${d.department.name})`)
        .join(", ")}.`
    : "";
  return `${lead}: ${reason}.${elsewhere} It could not be sent to the CEO either, because no active CEO, Chairman or acting CEO login exists (set an acting CEO on the Departments page).`;
}

type RoutePlan = {
  approverLevel: ApproverLevel;
  approverDepartmentId: string | null;
  routeNote: string | null;
};

/** Decides who must approve, or throws a clear message if nobody can. */
async function planRoute(
  employee: {
    id: string;
    departmentId: string;
    designation: { approvalLevel: ApprovalLevel } | null;
  },
  days: number,
): Promise<RoutePlan | "ADMIN_RECORDS"> {
  const requesterLevel: ApprovalLevel =
    employee.designation?.approvalLevel ?? "STAFF";
  const route = resolveApprovalRoute(requesterLevel, days);
  if (route.approverLevel === null) return "ADMIN_RECORDS";

  let approverLevel: ApproverLevel = route.approverLevel;
  let approverDepartmentId: string | null = null;
  let routeNote: string | null = null;

  if (route.sameDepartment) {
    // Only a DD of this department may decide a short request. That is the department's own
    // DD, or a DD of another department who holds additional charge of it (departments
    // without a DD of their own). If there is nobody, escalate.
    const ownDd = await prisma.employee.findFirst({
      where: {
        id: { not: employee.id },
        isActive: true,
        designation: { approvalLevel: "DD" },
        user: { is: { isActive: true } },
        OR: [
          { departmentId: employee.departmentId },
          {
            additionalCharges: {
              some: { departmentId: employee.departmentId },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (ownDd) {
      approverDepartmentId = employee.departmentId;
    } else {
      approverLevel = "CEO";
      routeNote =
        "No active DD (or additional-charge DD) for this department, sent to the CEO";
    }
  }

  const exists = await hasActiveApprover(approverLevel, {
    excludeEmployeeId: employee.id,
    ...(approverLevel === "DD" ? { departmentId: approverDepartmentId! } : {}),
  });
  if (!exists) {
    throw new ServiceError(
      await explainMissingApprover({
        requesterId: employee.id,
        departmentId: employee.departmentId,
        approverLevel,
        escalatedFromDd: route.sameDepartment,
        days,
      }),
    );
  }
  return { approverLevel, approverDepartmentId, routeNote };
}

export async function createLeaveRequest(
  input: LeaveRequestInput,
  user: AuthUser,
) {
  const start = parseIsoDate(input.startDate);
  const end = parseIsoDate(input.endDate);
  if (!start || !end) throw new ServiceError("Invalid date.");

  // HR may file for someone else. Everyone else files for their own record.
  const onBehalf =
    hasPermission(user, PERMISSIONS.LEAVES_MANAGE) && input.employeeId;
  const employeeId = onBehalf ? input.employeeId! : user.employee?.id;
  if (!employeeId) {
    throw new ServiceError(
      "Your user account is not linked to an employee record. Ask an Admin to link it.",
    );
  }

  const [employee, leaveType] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        isActive: true,
        departmentId: true,
        designation: { select: { approvalLevel: true } },
      },
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

  // ---- Who approves?
  const plan = await planRoute(employee, days);

  // The Chairman has nobody above them: an Admin records the leave as approved.
  if (plan === "ADMIN_RECORDS") {
    if (!hasPermission(user, PERMISSIONS.USERS_MANAGE)) {
      throw new ServiceError(
        "The Chairman's leave has no approver in the system. Ask an Admin to record it.",
      );
    }
    const recorded = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        reason: input.reason ?? null,
        days,
        status: "APPROVED",
        decidedById: user.id,
        decidedAt: new Date(),
        requestedById: user.id,
        routeNote: "Recorded by Admin (Chairman)",
      },
    });
    await reprocessEmployeeRange(employee.id, start, end);
    return recorded;
  }

  return prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: start,
      endDate: end,
      reason: input.reason ?? null,
      days,
      status: "PENDING",
      approverLevel: plan.approverLevel,
      approverDepartmentId: plan.approverDepartmentId,
      routeNote: plan.routeNote,
      requestedById: user.id,
    },
  });
}

/**
 * Old pending requests made before routing existed have no approver and nobody can decide them.
 * This gives each of them a route, using the same rules as a new request.
 */
export async function rerouteUnroutedRequests() {
  const stuck = await prisma.leaveRequest.findMany({
    where: { status: "PENDING", approverLevel: null },
    include: {
      employee: {
        select: {
          id: true,
          departmentId: true,
          designation: { select: { approvalLevel: true } },
        },
      },
    },
  });

  let routed = 0;
  const failed: string[] = [];
  for (const request of stuck) {
    try {
      const days = await countWorkingDays(request.startDate, request.endDate);
      const plan = await planRoute(request.employee, days);
      if (plan === "ADMIN_RECORDS") {
        failed.push(
          `${request.id}: Chairman's leave must be recorded by an Admin`,
        );
        continue;
      }
      await prisma.leaveRequest.update({
        where: { id: request.id },
        data: {
          days,
          approverLevel: plan.approverLevel,
          approverDepartmentId: plan.approverDepartmentId,
          routeNote: plan.routeNote,
        },
      });
      routed++;
    } catch (e) {
      failed.push(
        `${request.id}: ${e instanceof ServiceError ? e.message : "error"}`,
      );
    }
  }
  return { routed, failed };
}

const LEAVE_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
};

export async function decideLeaveRequest(
  id: string,
  decision: "APPROVED" | "REJECTED" | "CANCELLED",
  user: AuthUser,
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

  // ---- Who may do this?
  const me = getApproverIdentity(user);
  const isDesignatedApprover = canDecideRequest(me, request);

  if (decision === "APPROVED" || decision === "REJECTED") {
    if (!isDesignatedApprover) {
      throw new ServiceError("You are not the approver for this request.");
    }
  } else {
    const isRequester = me?.employeeId === request.employeeId;
    const isHr = hasPermission(user, PERMISSIONS.LEAVES_MANAGE);
    const ownPending = isRequester && request.status === "PENDING";
    if (!ownPending && !isDesignatedApprover && !isHr) {
      throw new ServiceError("You cannot cancel this request.");
    }
  }

  let days = request.days;
  if (decision === "APPROVED") {
    // The calendar may have changed since the request was made: recount and re-check.
    days = await countWorkingDays(request.startDate, request.endDate);
    if (days === 0)
      throw new ServiceError("The request now contains no working days.");

    // A new holiday can move a request across the 3-day line, which changes who approves.
    const wasShort = request.days <= SHORT_ROUTE_MAX_DAYS;
    const isShort = days <= SHORT_ROUTE_MAX_DAYS;
    if (wasShort !== isShort) {
      throw new ServiceError(
        `The calendar changed and the request is now ${days} working day(s), which needs a different approver. Cancel it and submit again.`,
      );
    }

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
      decidedById: user.id,
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

const requestInclude = {
  employee: {
    select: {
      name: true,
      employeeCode: true,
      department: { select: { name: true } },
    },
  },
  leaveType: { select: { name: true } },
} as const;

/**
 * Requests waiting for this person to decide: those routed to their own level
 * (a DD only sees their department) and, by parent rights, those routed to any lower level.
 * Empty unless they are DD, CEO or Chairman.
 */
export async function listPendingForApprover(user: AuthUser) {
  const me = getApproverIdentity(user);
  if (!me || me.level === "STAFF") return [];

  const lowerLevels = (["DD", "CEO", "CHAIRMAN"] as const).filter(
    (l) => l !== me.level && levelsAbove(l).includes(me.level as ApproverLevel),
  );
  return prisma.leaveRequest.findMany({
    where: {
      status: "PENDING",
      employeeId: { not: me.employeeId },
      OR: [
        me.level === "DD"
          ? {
              approverLevel: "DD",
              approverDepartmentId: {
                in: [me.departmentId, ...(me.chargeDepartmentIds ?? [])],
              },
            }
          : { approverLevel: me.level },
        ...(lowerLevels.length ? [{ approverLevel: { in: lowerLevels } }] : []),
      ],
    },
    orderBy: { startDate: "asc" },
    take: 200,
    include: requestInclude,
  });
}

export function countPendingForApprover(user: AuthUser) {
  return listPendingForApprover(user).then((r) => r.length);
}

export function listMyLeaveRequests(employeeId: string) {
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: requestInclude,
  });
}

export function listLeaveRequests(status?: LeaveRequestStatus) {
  return prisma.leaveRequest.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: requestInclude,
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
