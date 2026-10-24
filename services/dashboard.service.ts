import "server-only";
import { prisma } from "@/lib/prisma";
import { employeeWhereFor, type DataScope } from "@/lib/auth/data-scope";
import { toMinutes } from "@/lib/attendance/attendance-rules";
import {
  monthRange,
  parseIsoDate,
  parseMonthParam,
  toIsoDate,
} from "@/lib/attendance/dates";
import {
  getMonthCalendar,
  getSettings,
  makeDayTypeResolver,
} from "./settings.service";

const ATTENDED = new Set(["PRESENT", "SHORT_LEAVE", "HALF_DAY"]);

export type DayCounts = {
  present: number;
  shortLeave: number;
  halfDay: number;
  absent: number;
  missingPunch: number;
  onLeave: number;
  expected: number;
  records: number;
};

const emptyCounts = (): DayCounts => ({
  present: 0,
  shortLeave: 0,
  halfDay: 0,
  absent: 0,
  missingPunch: 0,
  onLeave: 0,
  expected: 0,
  records: 0,
});

function addStatus(c: DayCounts, status: string) {
  c.records++;

  if (status === "WEEKEND" || status === "HOLIDAY") return;

  c.expected++;

  switch (status) {
    case "PRESENT":
      c.present++;
      break;
    case "SHORT_LEAVE":
      c.shortLeave++;
      break;
    case "HALF_DAY":
      c.halfDay++;
      break;
    case "ABSENT":
      c.absent++;
      break;
    case "INCOMPLETE":
      c.missingPunch++;
      break;
    case "ON_LEAVE":
      c.onLeave++;
      break;
    default:
      break;
  }
}

export type DayTone = "good" | "fair" | "poor" | "off" | "holiday" | "none";

export type SeriesPoint = {
  iso: string;
  day: number;
  isOff: boolean;
  present: number;
  late: number;
  absent: number;
  missing: number;
  leave: number;
};

export type TodayRow = {
  id: string;
  code: string;
  name: string;
  department: string;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
};

export type ActivityItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: Date;
};

export type DashboardData = {
  date: Date;
  year: number;
  month: number;
  dayType: "WORKING" | "WEEKEND" | "HOLIDAY";
  holidayName: string | null;
  hasDayData: boolean;
  totalEmployees: number;
  newThisMonth: number;
  day: DayCounts;
  series: SeriesPoint[];
  calendar: Record<string, { tone: DayTone; title: string }>;
  todayRows: TodayRow[];
  todayTotal: number;
  histogram: {
    labels: string[];
    counts: number[];
    markerAfter: number;
    markerLabel: string;
    total: number;
  };
  departments: {
    name: string;
    rate: number | null;
    attended: number;
    expected: number;
  }[];
  monthTotals: DayCounts;
  attention: {
    missingPunches: number;
    pendingLeaves: number;
    pendingShortLeaves: number;
    unprocessedBatches: number;
    unmatchedRows: number;
  };
  recentLeaves: {
    id: string;
    employee: string;
    code: string;
    type: string;
    from: Date;
    to: Date;
    status: string;
  }[];
  lastImport: {
    fileName: string;
    month: number;
    year: number;
    status: string;
    createdAt: Date;
  } | null;
  activity: ActivityItem[];
};

// Determines which day the dashboard displays:
// 1. Explicit ?date= parameter.
// 2. Latest attendance date in ?month=.
// 3. Latest attendance date available to this scope.
// 4. Today if no attendance exists.
export async function resolveDashboardDate(
  dateParam?: string,
  monthParam?: string,
  scope: DataScope = { kind: "ALL" },
): Promise<Date> {
  const employee = employeeWhereFor(scope);

  const direct = parseIsoDate(dateParam);

  if (direct) return direct;

  const period = parseMonthParam(monthParam);

  if (period) {
    const { start, end } = monthRange(period.year, period.month);

    const result = await prisma.attendance.aggregate({
      _max: { date: true },
      where: {
        date: { gte: start, lt: end },
        employee,
      },
    });

    return result._max.date ?? start;
  }

  const latest = await prisma.attendance.aggregate({
    _max: { date: true },
    where: { employee },
  });

  if (latest._max.date) return latest._max.date;

  const now = new Date();

  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const PRIORITY: Record<string, number> = {
  INCOMPLETE: 0,
  ABSENT: 1,
  HALF_DAY: 2,
  SHORT_LEAVE: 3,
  ON_LEAVE: 4,
  PRESENT: 5,
  WEEKEND: 6,
  HOLIDAY: 6,
};

export async function getDashboardData(
  date: Date,
  scope: DataScope = { kind: "ALL" },
  includeSystem = true,
): Promise<DashboardData> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const employee = employeeWhereFor(scope);

  const { start, end } = monthRange(year, month);

  // Load settings, calendar, and dashboard queries together.
  const [
    settings,
    calendar,
    totalEmployees,
    newThisMonth,
    monthRows,
    dayRows,
    missingPunches,
    pendingLeaves,
    pendingShortLeaves,
    unprocessedBatches,
    unmatchedRows,
    recentLeaves,
    lastImport,
  ] = await Promise.all([
    getSettings(),
    getMonthCalendar(year, month),

    // Active employees visible within this scope.
    prisma.employee.count({
      where: {
        isActive: true,
        ...employee,
      },
    }),

    // Employees who joined during the selected month.
    prisma.employee.count({
      where: {
        isActive: true,
        joiningDate: { gte: start, lt: end },
        ...employee,
      },
    }),

    // Attendance records for the selected month.
    prisma.attendance.findMany({
      where: {
        date: { gte: start, lt: end },
        employee,
      },
      select: {
        date: true,
        status: true,
        checkIn: true,
        employee: {
          select: {
            department: {
              select: { name: true },
            },
          },
        },
      },
    }),

    // Attendance records for the selected day.
    prisma.attendance.findMany({
      where: {
        date,
        employee,
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeCode: true,
            department: {
              select: { name: true },
            },
          },
        },
      },
    }),

    // Missing punches visible within this scope.
    prisma.attendance.count({
      where: {
        status: "INCOMPLETE",
        isManual: false,
        employee,
      },
    }),

    prisma.leaveRequest.count({
      where: {
        status: "PENDING",
        employee,
      },
    }),

    prisma.shortLeave.count({
      where: {
        status: "PENDING",
        employee,
      },
    }),

    // System-level import statistics are optional.
    includeSystem
      ? prisma.importBatch.count({
          where: {
            processedAt: null,
            successfulRows: { gt: 0 },
          },
        })
      : Promise.resolve(0),

    includeSystem
      ? prisma.importedAttendanceRow.count({
          where: { employeeId: null },
        })
      : Promise.resolve(0),

    // Recent leave requests for employees in this scope.
    prisma.leaveRequest.findMany({
      where: { employee },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        employee: {
          select: {
            name: true,
            employeeCode: true,
          },
        },
        leaveType: {
          select: { name: true },
        },
      },
    }),

    includeSystem
      ? prisma.importBatch.findFirst({
          orderBy: { createdAt: "desc" },
          select: {
            fileName: true,
            month: true,
            year: true,
            status: true,
            createdAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  // Determine working days, weekends, and holidays.
  const dayTypeOf = makeDayTypeResolver(calendar);

  // Attendance statistics for each day.
  const perDay = new Map<string, DayCounts>();

  // Attendance statistics grouped by department.
  const perDept = new Map<string, { attended: number; expected: number }>();

  const monthTotals = emptyCounts();

  // Starting point for the check-in time chart.
  const histStart = Math.max(
    0,
    Math.floor((toMinutes(settings.shiftStart) - 60) / 15) * 15,
  );

  // Sixteen 15-minute intervals, plus early and late bins.
  const binCount = 16;
  const histCounts = new Array<number>(binCount + 2).fill(0);

  const binOf = (minutes: number) =>
    minutes < histStart
      ? 0
      : Math.min(binCount + 1, Math.floor((minutes - histStart) / 15) + 1);

  // Process monthly attendance.
  for (const record of monthRows) {
    const iso = toIsoDate(record.date);

    const counts = perDay.get(iso) ?? emptyCounts();

    addStatus(counts, record.status);
    perDay.set(iso, counts);

    addStatus(monthTotals, record.status);

    if (record.status !== "WEEKEND" && record.status !== "HOLIDAY") {
      const departmentName = record.employee.department.name;

      const department = perDept.get(departmentName) ?? {
        attended: 0,
        expected: 0,
      };

      if (ATTENDED.has(record.status)) {
        department.attended++;
      }

      if (record.status !== "ON_LEAVE") {
        department.expected++;
      }

      perDept.set(departmentName, department);
    }

    // Include attended records in the check-in histogram.
    if (record.checkIn && ATTENDED.has(record.status)) {
      const minutes =
        record.checkIn.getUTCHours() * 60 + record.checkIn.getUTCMinutes();

      histCounts[binOf(minutes)]++;
    }
  }

  // Map holiday dates to their titles.
  const holidayByIso = new Map(
    calendar.holidays.map((holiday) => [
      toIsoDate(holiday.date),
      holiday.title,
    ]),
  );

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const series: SeriesPoint[] = [];
  const calendarOut: DashboardData["calendar"] = {};

  // Build the daily chart and calendar.
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const currentDate = new Date(Date.UTC(year, month - 1, dayNumber));

    const iso = toIsoDate(currentDate);
    const counts = perDay.get(iso) ?? emptyCounts();
    const type = dayTypeOf(currentDate);

    series.push({
      iso,
      day: dayNumber,
      isOff: type !== "WORKING",
      present: counts.present,
      late: counts.shortLeave + counts.halfDay,
      absent: counts.absent,
      missing: counts.missingPunch,
      leave: counts.onLeave,
    });

    const attended = counts.present + counts.shortLeave + counts.halfDay;

    if (type === "HOLIDAY") {
      calendarOut[iso] = {
        tone: "holiday",
        title: `Holiday: ${holidayByIso.get(iso) ?? ""}`,
      };
    } else if (type === "WEEKEND") {
      calendarOut[iso] = {
        tone: "off",
        title: "Weekly off",
      };
    } else if (counts.expected === 0) {
      calendarOut[iso] = {
        tone: "none",
        title: "No attendance data",
      };
    } else {
      const base = Math.max(1, counts.expected - counts.onLeave);

      const rate = attended / base;

      calendarOut[iso] = {
        tone: rate >= 0.9 ? "good" : rate >= 0.75 ? "fair" : "poor",
        title: `${attended} attended, ${counts.absent} absent, ${counts.missingPunch} missing punch, ${counts.onLeave} on leave`,
      };
    }
  }

  // Histogram labels.
  const hh = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
      minutes % 60,
    ).padStart(2, "0")}`;

  const labels = [`<${hh(histStart)}`];

  for (let index = 0; index < binCount; index++) {
    labels.push(hh(histStart + index * 15));
  }

  labels.push(`${hh(histStart + binCount * 15)}+`);

  const lateAfter = toMinutes(settings.shiftStart) + settings.graceMinutes;

  const markerAfter = binOf(lateAfter);

  const histTotal = histCounts.reduce((total, count) => total + count, 0);

  // Selected day's attendance table.
  const todayAll: TodayRow[] = dayRows
    .map((record) => ({
      id: record.id,
      code: record.employee.employeeCode,
      name: record.employee.name,
      department: record.employee.department.name,
      status: record.status,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
    }))
    .sort(
      (a, b) =>
        (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9) ||
        a.name.localeCompare(b.name),
    );

  const day = emptyCounts();

  for (const record of dayRows) {
    addStatus(day, record.status);
  }

  // Department attendance rates.
  const departments = [...perDept.entries()]
    .map(([name, value]) => ({
      name,
      attended: value.attended,
      expected: value.expected,
      rate:
        value.expected > 0
          ? Math.round((value.attended / value.expected) * 1000) / 10
          : null,
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  // Only load system activity when authorized by the caller.
  const activity = includeSystem ? await getRecentActivity() : [];

  return {
    date,
    year,
    month,
    dayType: dayTypeOf(date),
    holidayName: holidayByIso.get(toIsoDate(date)) ?? null,
    hasDayData: dayRows.length > 0,
    totalEmployees,
    newThisMonth,
    day,
    series,
    calendar: calendarOut,
    todayRows: todayAll.slice(0, 10),
    todayTotal: todayAll.length,
    histogram: {
      labels,
      counts: histCounts,
      markerAfter,
      markerLabel: `On time until ${hh(lateAfter)}`,
      total: histTotal,
    },
    departments,
    monthTotals,
    attention: {
      missingPunches,
      pendingLeaves,
      pendingShortLeaves,
      unprocessedBatches,
      unmatchedRows,
    },
    recentLeaves: recentLeaves.map((leave) => ({
      id: leave.id,
      employee: leave.employee.name,
      code: leave.employee.employeeCode,
      type: leave.leaveType.name,
      from: leave.startDate,
      to: leave.endDate,
      status: leave.status,
    })),
    lastImport,
    activity,
  };
}

/* -------------------------------------------------------
   Recent activity
   ------------------------------------------------------- */

async function getRecentActivity(): Promise<ActivityItem[]> {
  const [batches, decidedLeaves, newEmployees, corrections] = await Promise.all(
    [
      prisma.importBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          processedAt: true,
          uploadedBy: {
            select: { fullName: true },
          },
        },
      }),

      prisma.leaveRequest.findMany({
        where: { decidedAt: { not: null } },
        orderBy: { decidedAt: "desc" },
        take: 3,
        select: {
          id: true,
          status: true,
          decidedAt: true,
          decidedById: true,
          employee: {
            select: { name: true },
          },
        },
      }),

      prisma.employee.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),

      prisma.attendance.findMany({
        where: {
          isManual: true,
          editedAt: { not: null },
        },
        orderBy: { editedAt: "desc" },
        take: 3,
        select: {
          id: true,
          editedAt: true,
          editedById: true,
          employee: {
            select: { name: true },
          },
        },
      }),
    ],
  );

  const userIds = [
    ...decidedLeaves.map((leave) => leave.decidedById),
    ...corrections.map((record) => record.editedById),
  ].filter((id): id is string => Boolean(id));

  const users = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: [...new Set(userIds)] },
        },
        select: {
          id: true,
          fullName: true,
        },
      })
    : [];

  const nameOf = (id: string | null) =>
    users.find((user) => user.id === id)?.fullName ?? "HR";

  const items: ActivityItem[] = [];

  for (const batch of batches) {
    items.push({
      id: `imp-${batch.id}`,
      kind: "import",
      title: "Excel file imported",
      detail: `${batch.fileName}${
        batch.uploadedBy ? `, by ${batch.uploadedBy.fullName}` : ""
      }`,
      at: batch.createdAt,
    });

    if (batch.processedAt) {
      items.push({
        id: `proc-${batch.id}`,
        kind: "process",
        title: "Attendance processing completed",
        detail: batch.fileName,
        at: batch.processedAt,
      });
    }
  }

  for (const leave of decidedLeaves) {
    items.push({
      id: `leave-${leave.id}`,
      kind: "leave",
      title: `Leave ${leave.status.toLowerCase()}`,
      detail: `${leave.employee.name}, by ${nameOf(leave.decidedById)}`,
      at: leave.decidedAt!,
    });
  }

  for (const employee of newEmployees) {
    items.push({
      id: `emp-${employee.id}`,
      kind: "employee",
      title: "New employee added",
      detail: employee.name,
      at: employee.createdAt,
    });
  }

  for (const correction of corrections) {
    items.push({
      id: `fix-${correction.id}`,
      kind: "correction",
      title: "Attendance corrected",
      detail: `${correction.employee.name}, by ${nameOf(
        correction.editedById,
      )}`,
      at: correction.editedAt!,
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);
}

/* -------------------------------------------------------
   Application shell notifications
   ------------------------------------------------------- */

export async function getShellData(want: {
  missingPunches: boolean;
  leaves: boolean;
  /** Leave requests waiting for this person to approve. */
  approvals?: number;
  imports: boolean;
}) {
  const [missing, leaves, shorts, lastImport] = await Promise.all([
    want.missingPunches
      ? prisma.attendance.count({
          where: {
            status: "INCOMPLETE",
            isManual: false,
          },
        })
      : Promise.resolve(0),

    // Full-day leave approvals are counted separately.
    Promise.resolve(0),

    want.leaves
      ? prisma.shortLeave.count({
          where: { status: "PENDING" },
        })
      : Promise.resolve(0),

    want.imports
      ? prisma.importBatch.findFirst({
          orderBy: { createdAt: "desc" },
          select: {
            month: true,
            year: true,
            status: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    notifications: missing + leaves + shorts + (want.approvals ?? 0),
    lastImport,
  };
}
