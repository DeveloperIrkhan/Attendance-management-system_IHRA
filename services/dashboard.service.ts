import "server-only";
import { prisma } from "@/lib/prisma";
import { employeeWhereFor, type DataScope } from "@/lib/auth/data-scope";
import { toMinutes } from "@/lib/attendance/attendance-rules";
import {
  addDays,
  monthRange,
  parseIsoDate,
  parseMonthParam,
  toIsoDate,
} from "@/lib/attendance/dates";
import { MONTHS } from "@/lib/attendance/months";
import {
  monthPeriod,
  parseCustomPeriod,
  type Period,
  type PeriodParams,
} from "@/lib/attendance/period";
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
  /** x-axis text: the day number, "12 Oct", or a month name for long periods */
  label: string;
  /** hover text for days off */
  title?: string;
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
  /** what the charts and totals cover: a month (default), a date range or a year */
  period: Period;
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

/**
 * Reads ?from= &to= &year= (a custom period) as well as ?date= and ?month=.
 * `period` is null for the normal month view.
 */
export async function resolveDashboardView(
  sp: PeriodParams,
  scope: DataScope = { kind: "ALL" },
): Promise<{ date: Date; period: Period | null }> {
  const custom = parseCustomPeriod(sp);
  if (custom) {
    const latest = await prisma.attendance.aggregate({
      _max: { date: true },
      where: {
        date: { gte: custom.start, lte: custom.end },
        employee: employeeWhereFor(scope),
      },
    });
    return { date: latest._max.date ?? custom.start, period: custom };
  }
  return {
    date: await resolveDashboardDate(sp.date, sp.month, scope),
    period: null,
  };
}

/** Chart points for a custom period: one per day, or one per month when it is long. */
function buildPeriodSeries(
  period: Period,
  perDay: Map<string, DayCounts>,
  calendars: Map<string, Awaited<ReturnType<typeof getMonthCalendar>>>,
): SeriesPoint[] {
  const days: Date[] = [];
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) days.push(d);
  const monthName = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3);
  const sameMonth =
    toIsoDate(period.start).slice(0, 7) === toIsoDate(period.end).slice(0, 7);
  const sameYear = period.start.getUTCFullYear() === period.end.getUTCFullYear();

  if (days.length <= 62) {
    return days.map((d) => {
      const iso = toIsoDate(d);
      const c = perDay.get(iso) ?? emptyCounts();
      const cal = calendars.get(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`)!;
      const type = makeDayTypeResolver(cal)(d);
      const holiday =
        type === "HOLIDAY"
          ? cal.holidays.find((h) => toIsoDate(h.date) === iso)?.title
          : undefined;
      return {
        iso,
        day: d.getUTCDate(),
        label: sameMonth ? String(d.getUTCDate()) : `${d.getUTCDate()} ${monthName(d)}`,
        title:
          type === "HOLIDAY"
            ? `Holiday: ${holiday ?? ""}`
            : type === "WEEKEND"
              ? "Weekly off"
              : undefined,
        isOff: type !== "WORKING",
        present: c.present,
        late: c.shortLeave + c.halfDay,
        absent: c.absent,
        missing: c.missingPunch,
        leave: c.onLeave,
      };
    });
  }

  const byMonth = new Map<string, SeriesPoint>();
  for (const d of days) {
    const key = toIsoDate(d).slice(0, 7);
    let point = byMonth.get(key);
    if (!point) {
      point = {
        iso: `${key}-01`,
        day: 1,
        label: sameYear ? monthName(d) : `${monthName(d)} ${key.slice(2, 4)}`,
        isOff: false,
        present: 0,
        late: 0,
        absent: 0,
        missing: 0,
        leave: 0,
      };
      byMonth.set(key, point);
    }
    const c = perDay.get(toIsoDate(d)) ?? emptyCounts();
    point.present += c.present;
    point.late += c.shortLeave + c.halfDay;
    point.absent += c.absent;
    point.missing += c.missingPunch;
    point.leave += c.onLeave;
  }
  return [...byMonth.values()];
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

/** The weekly-off days and holidays of every month a period touches, loaded once each. */
async function loadCalendars(period: Period) {
  const keys: { year: number; month: number }[] = [];
  const seen = new Set<string>();
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    if (!seen.has(key)) {
      seen.add(key);
      keys.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }
  }
  const loaded = await Promise.all(
    keys.map((k) => getMonthCalendar(k.year, k.month)),
  );
  return new Map(keys.map((k, i) => [`${k.year}-${k.month}`, loaded[i]]));
}

export async function getDashboardData(
  date: Date,
  scope: DataScope = { kind: "ALL" },
  includeSystem = true,
  customPeriod: Period | null = null,
): Promise<DashboardData> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const employee = employeeWhereFor(scope);

  const { start, end } = monthRange(year, month);
  // The charts and totals follow this period; the calendar and day table stay on the month.
  const period = customPeriod ?? monthPeriod(year, month);
  const periodEnd = addDays(period.end, 1); // exclusive

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
    customRows,
    customCalendars,
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
        joiningDate: { gte: period.start, lt: periodEnd },
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

    // A custom range or year: its own attendance records and month calendars.
    customPeriod
      ? prisma.attendance.findMany({
          where: {
            date: { gte: period.start, lt: periodEnd },
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
        })
      : Promise.resolve(null),
    customPeriod
      ? loadCalendars(period)
      : Promise.resolve(null),
  ]);

  const periodRows = customRows ?? monthRows;

  // Determine working days, weekends, and holidays.
  const dayTypeOf = makeDayTypeResolver(calendar);

  // Attendance statistics for each day.
  const perDay = new Map<string, DayCounts>();

  // Attendance statistics grouped by department.
  const perDept = new Map<string, { attended: number; expected: number }>();

  const monthTotals = emptyCounts(); // totals for the whole period
  const periodPerDay = new Map<string, DayCounts>();

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

  // The selected month drives the calendar.
  for (const record of monthRows) {
    const iso = toIsoDate(record.date);
    const counts = perDay.get(iso) ?? emptyCounts();
    addStatus(counts, record.status);
    perDay.set(iso, counts);
  }

  // The period drives the totals, the department rates and the arrival histogram.
  for (const record of periodRows) {
    const iso = toIsoDate(record.date);

    const counts = periodPerDay.get(iso) ?? emptyCounts();
    addStatus(counts, record.status);
    periodPerDay.set(iso, counts);

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
      label: String(dayNumber),
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
    period,
    dayType: dayTypeOf(date),
    holidayName: holidayByIso.get(toIsoDate(date)) ?? null,
    hasDayData: dayRows.length > 0,
    totalEmployees,
    newThisMonth,
    day,
    series:
      customPeriod && customCalendars
        ? buildPeriodSeries(period, periodPerDay, customCalendars)
        : series,
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
