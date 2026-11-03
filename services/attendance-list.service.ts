import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/attendance/dates";
import { toRuleConfig } from "@/lib/attendance/attendance-rules";
import { officeNow } from "@/lib/attendance/office-clock";
import { emptyDayNote, statusWithoutRecord } from "@/lib/attendance/roster";
import type { DailyStatus } from "@/lib/attendance/daily-filters";
import { employeeWhereFor, type DataScope } from "@/lib/auth/data-scope";
import {
  getMonthCalendar,
  getSettings,
  makeDayTypeResolver,
} from "./settings.service";
import { Prisma } from "@/lib/generated/prisma/client";
export const DAILY_PAGE_SIZE = 100;

/**
 * Attendance records for one day, a date range or a month, filtered by department, status and a
 * search text. The DD's own department limit is always applied through `scope`.
 * `counts` ignores the status filter, so the status buttons can show how many days match each.
 */

const attendanceEmployeeSelect = {
  name: true,
  employeeCode: true,
  biometricId: true,
  department: {
    select: {
      name: true,
    },
  },
  designation: {
    select: {
      title: true,
    },
  },
  additionalCharges: {
    select: {
      department: {
        select: {
          name: true,
        },
      },
    },
  },
} satisfies Prisma.EmployeeSelect;

type AttendanceWithEmployee = Prisma.AttendanceGetPayload<{
  include: {
    employee: {
      select: typeof attendanceEmployeeSelect;
    };
  };
}>;

export async function listAttendanceRecords(opts: {
  start: Date;
  end: Date;
  departmentId?: string;
  status: DailyStatus;
  q?: string;
  scope: DataScope;
  page: number;
}) {
  const q = opts.q?.trim().slice(0, 60);
  const employee = {
    ...employeeWhereFor(opts.scope, opts.departmentId),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { employeeCode: { contains: q, mode: "insensitive" as const } },
            { biometricId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const dateWhere = { gte: opts.start, lt: addDays(opts.end, 1) };
  const base = { date: dateWhere, employee };
  let where: Prisma.AttendanceWhereInput = base;
  if (opts.status === "NOT_IN") {
    where = { ...base, id: { in: [] } };
  } else if (opts.status !== "ALL") {
    where = { ...base, status: opts.status };
  }

  const [grouped, records] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "asc" }, { employee: { employeeCode: "asc" } }],
      skip: (opts.page - 1) * DAILY_PAGE_SIZE,
      take: DAILY_PAGE_SIZE,
      include: {
        employee: {
          select: attendanceEmployeeSelect,
        },
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  let all = 0;
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    all += g._count._all;
  }
  const total = opts.status === "ALL" ? all : (counts[opts.status] ?? 0);
  return {
    records,
    counts,
    all,
    total,
    pages: Math.max(1, Math.ceil(total / DAILY_PAGE_SIZE)),
  };
}

export type RosterRow = {
  key: string;
  /** the saved attendance record, or null when the employee has none for this day */
  record: {
    id: string;
    checkIn: Date | null;
    checkOut: Date | null;
    workingMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
    remarks: string | null;
  } | null;
  /** the saved status, or one worked out for an employee without a record */
  status: string;
  /** text for the Remarks column when there is no saved record */
  note: string | null;
  employee: {
    name: string;
    employeeCode: string;
    biometricId: string | null;
    department: { name: string };
    designation: { title: string } | null;
    /** departments this DD also looks after (additional charge) */
    additionalCharges: { department: { name: string } }[];
  };
};

/**
 * One row for EVERY active employee on one day, whether or not they punched.
 * An employee with a record shows it. One without shows what the day means for them:
 * weekly off, holiday, approved leave, "not in yet" (today, shift still running), absent
 * (the day is over) or "no record" (a day that was never processed, or a future day).
 */
export async function getDayRoster(opts: {
  date: Date;
  departmentId?: string;
  q?: string;
  scope: DataScope;
}): Promise<RosterRow[]> {
  const q = opts.q?.trim().slice(0, 60);
  const employeeFilter = {
    ...employeeWhereFor(opts.scope, opts.departmentId),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { employeeCode: { contains: q, mode: "insensitive" as const } },
            { biometricId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [records, employees, leaves, settings, calendar, dayRecordCount] =
    await Promise.all([
      prisma.attendance.findMany({
        where: { date: opts.date, employee: employeeFilter },
        include: {
          employee: {
            select: {
              name: true,
              employeeCode: true,
              biometricId: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
              additionalCharges: {
                select: { department: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.employee.findMany({
        where: {
          AND: [
            employeeFilter,
            { isActive: true },
            {
              OR: [{ joiningDate: null }, { joiningDate: { lte: opts.date } }],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          biometricId: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
          additionalCharges: {
            select: { department: { select: { name: true } } },
          },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: opts.date },
          endDate: { gte: opts.date },
        },
        select: { employeeId: true },
      }),
      getSettings(),
      getMonthCalendar(opts.date.getUTCFullYear(), opts.date.getUTCMonth() + 1),
      // was this day processed at all, for anybody in scope?
      prisma.attendance.count({
        where: { date: opts.date, employee: employeeWhereFor(opts.scope) },
      }),
    ]);

  const cfg = toRuleConfig(settings);
  const { todayMs, minutes } = officeNow();
  const dateMs = opts.date.getTime();
  const dayType = makeDayTypeResolver(calendar)(opts.date);
  const onLeave = new Set(leaves.map((l) => l.employeeId));
  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));

  const rows: RosterRow[] = records.map((r) => ({
    key: r.id,
    record: {
      id: r.id,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      workingMinutes: r.workingMinutes,
      lateMinutes: r.lateMinutes,
      overtimeMinutes: r.overtimeMinutes,
      remarks: r.remarks,
    },
    status: r.status,
    note: null,
    employee: r.employee,
  }));

  for (const e of employees) {
    if (recordByEmployee.has(e.id)) continue;
    const status = statusWithoutRecord({
      dayType,
      onLeave: onLeave.has(e.id),
      isFuture: dateMs > todayMs,
      isToday: dateMs === todayMs,
      shiftOver: minutes >= cfg.shiftEnd,
      dayHasRecords: dayRecordCount > 0,
    });
    rows.push({
      key: `none-${e.id}`,
      record: null,
      status,
      note: emptyDayNote(status),
      employee: {
        name: e.name,
        employeeCode: e.employeeCode,
        biometricId: e.biometricId,
        department: e.department,
        designation: e.designation,
        additionalCharges: e.additionalCharges,
      },
    });
  }

  rows.sort((a, b) =>
    a.employee.employeeCode.localeCompare(b.employee.employeeCode, undefined, {
      numeric: true,
    }),
  );
  return rows;
}
