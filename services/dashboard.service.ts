import "server-only";
import { prisma } from "@/lib/prisma";
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

//Which day the dashboard
// shows: ?date=, else the latest day of ?month=,
// else the latest day with data.
export async function resolveDashboardDate(
  dateParam?: string,
  monthParam?: string,
): Promise<Date> {
  const direct = parseIsoDate(dateParam);
  if (direct) return direct;

  const period = parseMonthParam(monthParam);
  if (period) {
    const { start, end } = monthRange(period.year, period.month);
    const r = await prisma.attendance.aggregate({
      _max: { date: true },
      where: { date: { gte: start, lt: end } },
    });
    return r._max.date ?? start;
  }

  const latest = await prisma.attendance.aggregate({ _max: { date: true } });
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

export async function getDashboardData(date: Date): Promise<DashboardData> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1 because, my months are string from 0, mean 0 for january
  const { start, end } = monthRange(year, month);

  const [settings, calendar] = await Promise.all([
    getSettings(),
    getMonthCalendar(year, month),
  ]);
  const dayTypeOf = makeDayTypeResolver(calendar);

  const [
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
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({
      where: { isActive: true, joiningDate: { gte: start, lt: end } },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        date: true,
        status: true,
        checkIn: true,
        employee: { select: { department: { select: { name: true } } } },
      },
    }),
    prisma.attendance.findMany({
      where: { date },
      include: {
        employee: {
          select: {
            name: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.attendance.count({
      where: { status: "INCOMPLETE", isManual: false },
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.shortLeave.count({ where: { status: "PENDING" } }),
    prisma.importBatch.count({
      where: { processedAt: null, successfulRows: { gt: 0 } },
    }),
    prisma.importedAttendanceRow.count({ where: { employeeId: null } }),
    prisma.leaveRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        employee: { select: { name: true, employeeCode: true } },
        leaveType: { select: { name: true } },
      },
    }),
    prisma.importBatch.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        fileName: true,
        month: true,
        year: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  //Attendance statistics for each day
  const perDay = new Map<string, DayCounts>();
  //groups attendance statistics by department.
  //   Attendance statistics for each department
  const perDept = new Map<string, { attended: number; expected: number }>();
  const monthTotals = emptyCounts();
  //Starting point for the check-in time chart
  const histStart = Math.max(
    0,
    Math.floor((toMinutes(settings.shiftStart) - 60) / 15) * 15,
  );
  //Number of regular time intervals
  const binCount = 16; // 15-minute bins over four hours
  //Number of check-ins in each interval
  // [early, ...bins, late]
  const histCounts = new Array<number>(binCount + 2).fill(0);
  //Determines which interval a check-in belongs to
  const binOf = (m: number) =>
    m < histStart
      ? 0
      : Math.min(binCount + 1, Math.floor((m - histStart) / 15) + 1);

  for (const r of monthRows) {
    const iso = toIsoDate(r.date);
    const c = perDay.get(iso) ?? emptyCounts();
    addStatus(c, r.status);
    perDay.set(iso, c);
    addStatus(monthTotals, r.status);

    if (r.status !== "WEEKEND" && r.status !== "HOLIDAY") {
      const dept = r.employee.department.name;
      const d = perDept.get(dept) ?? { attended: 0, expected: 0 };
      if (ATTENDED.has(r.status)) d.attended++;
      if (r.status !== "ON_LEAVE") d.expected++;
      perDept.set(dept, d);
    }

    if (r.checkIn && ATTENDED.has(r.status)) {
      histCounts[
        binOf(r.checkIn.getUTCHours() * 60 + r.checkIn.getUTCMinutes())
      ]++;
    }
  }

  const holidayByIso = new Map(
    calendar.holidays.map((h) => [toIsoDate(h.date), h.title]),
  );
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const series: SeriesPoint[] = [];
  const calendarOut: DashboardData["calendar"] = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const iso = toIsoDate(d);
    const c = perDay.get(iso) ?? emptyCounts();
    const type = dayTypeOf(d);
    series.push({
      iso,
      day,
      isOff: type !== "WORKING",
      present: c.present,
      late: c.shortLeave + c.halfDay,
      absent: c.absent,
      missing: c.missingPunch,
      leave: c.onLeave,
    });

    const attended = c.present + c.shortLeave + c.halfDay;
    if (type === "HOLIDAY") {
      calendarOut[iso] = {
        tone: "holiday",
        title: `Holiday: ${holidayByIso.get(iso) ?? ""}`,
      };
    } else if (type === "WEEKEND") {
      calendarOut[iso] = { tone: "off", title: "Weekly off" };
    } else if (c.expected === 0) {
      calendarOut[iso] = { tone: "none", title: "No attendance data" };
    } else {
      const base = Math.max(1, c.expected - c.onLeave);
      const rate = attended / base;
      calendarOut[iso] = {
        tone: rate >= 0.9 ? "good" : rate >= 0.75 ? "fair" : "poor",
        title: `${attended} attended, ${c.absent} absent, ${c.missingPunch} missing punch, ${c.onLeave} on leave`,
      };
    }
  }

  /* ---- histogram labels ---- */
  const hh = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const labels = [`<${hh(histStart)}`];
  for (let i = 0; i < binCount; i++) labels.push(hh(histStart + i * 15));
  labels.push(`${hh(histStart + binCount * 15)}+`);
  const lateAfter = toMinutes(settings.shiftStart) + settings.graceMinutes;
  const markerAfter = binOf(lateAfter);
  const histTotal = histCounts.reduce((a, b) => a + b, 0);

  /* ---- selected day's table ---- */
  const todayAll: TodayRow[] = dayRows
    .map((r) => ({
      id: r.id,
      code: r.employee.employeeCode,
      name: r.employee.name,
      department: r.employee.department.name,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
    }))
    .sort(
      (a, b) =>
        (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9) ||
        a.name.localeCompare(b.name),
    );

  const day = emptyCounts();
  for (const r of dayRows) addStatus(day, r.status);

  const departments = [...perDept.entries()]
    .map(([name, v]) => ({
      name,
      attended: v.attended,
      expected: v.expected,
      rate:
        v.expected > 0
          ? Math.round((v.attended / v.expected) * 1000) / 10
          : null,
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  const activity = await getRecentActivity();

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
    recentLeaves: recentLeaves.map((l) => ({
      id: l.id,
      employee: l.employee.name,
      code: l.employee.employeeCode,
      type: l.leaveType.name,
      from: l.startDate,
      to: l.endDate,
      status: l.status,
    })),
    lastImport,
    activity,
  };
}

/* ---------- Recent activity, assembled from existing records (no audit table needed yet) ---------- */

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
          uploadedBy: { select: { fullName: true } },
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
          employee: { select: { name: true } },
        },
      }),
      prisma.employee.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.attendance.findMany({
        where: { isManual: true, editedAt: { not: null } },
        orderBy: { editedAt: "desc" },
        take: 3,
        select: {
          id: true,
          editedAt: true,
          editedById: true,
          employee: { select: { name: true } },
        },
      }),
    ],
  );

  const userIds = [
    ...decidedLeaves.map((l) => l.decidedById),
    ...corrections.map((c) => c.editedById),
  ].filter((x): x is string => Boolean(x));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(userIds)] } },
        select: { id: true, fullName: true },
      })
    : [];
  const nameOf = (id: string | null) =>
    users.find((u) => u.id === id)?.fullName ?? "HR";

  const items: ActivityItem[] = [];
  for (const b of batches) {
    items.push({
      id: `imp-${b.id}`,
      kind: "import",
      title: "Excel file imported",
      detail: `${b.fileName}${b.uploadedBy ? `, by ${b.uploadedBy.fullName}` : ""}`,
      at: b.createdAt,
    });
    if (b.processedAt) {
      items.push({
        id: `proc-${b.id}`,
        kind: "process",
        title: "Attendance processing completed",
        detail: b.fileName,
        at: b.processedAt,
      });
    }
  }
  for (const l of decidedLeaves) {
    items.push({
      id: `leave-${l.id}`,
      kind: "leave",
      title: `Leave ${l.status.toLowerCase()}`,
      detail: `${l.employee.name}, by ${nameOf(l.decidedById)}`,
      at: l.decidedAt!,
    });
  }
  for (const e of newEmployees) {
    items.push({
      id: `emp-${e.id}`,
      kind: "employee",
      title: "New employee added",
      detail: e.name,
      at: e.createdAt,
    });
  }
  for (const c of corrections) {
    items.push({
      id: `fix-${c.id}`,
      kind: "correction",
      title: "Attendance corrected",
      detail: `${c.employee.name}, by ${nameOf(c.editedById)}`,
      at: c.editedAt!,
    });
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);
}

export async function getShellData(want: {
  missingPunches: boolean;
  leaves: boolean;
  imports: boolean;
}) {
  const [missing, leaves, shorts, lastImport] = await Promise.all([
    want.missingPunches
      ? prisma.attendance.count({
          where: { status: "INCOMPLETE", isManual: false },
        })
      : 0,
    want.leaves
      ? prisma.leaveRequest.count({ where: { status: "PENDING" } })
      : 0,
    want.leaves ? prisma.shortLeave.count({ where: { status: "PENDING" } }) : 0,
    want.imports
      ? prisma.importBatch.findFirst({
          orderBy: { createdAt: "desc" },
          select: { month: true, year: true, status: true },
        })
      : null,
  ]);
  return { notifications: missing + leaves + shorts, lastImport };
}
