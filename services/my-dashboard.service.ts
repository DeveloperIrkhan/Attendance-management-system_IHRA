import "server-only";

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
  parseStatusFilter,
  type Period,
  type PeriodParams,
  type StatusFilter,
} from "@/lib/attendance/period";
import {
  getMonthCalendar,
  makeDayTypeResolver,
  type MonthCalendar,
} from "./settings.service";
import type { DayTone } from "./dashboard.service";
import { prisma } from "@/lib/prisma";

export type MyDay = {
  iso: string;
  day: number;
  /** attendance status, or WEEKEND / HOLIDAY from the calendar, or "NO_RECORD" */
  status: string;
  tone: DayTone;
  label: string;
  /** holiday name or remarks, when there is one */
  note: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  isManual: boolean;
};

export type MySummary = {
  /** days with a valid arrival: on time + short leave + half day */
  attended: number;
  present: number;
  shortLeave: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  missingPunch: number;
  weeklyOff: number;
  holidays: number;
  /** late arrivals (short leave + half day) */
  lateDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  workingMinutes: number;
};

export type MySeriesPoint = {
  label: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  missing: number;
};

export type MyDashboardData = {
  employee: {
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
  };
  /** the month of the selected day: drives the calendar and the "selected day" card */
  year: number;
  month: number;
  date: Date;
  /** the month's own numbers (kept for the calendar and older callers) */
  summary: MySummary;
  /** the day picked with ?date= */
  selected: MyDay;
  /** every day of the month, in order */
  days: MyDay[];
  calendar: Record<string, { tone: DayTone; title: string }>;
  series: {
    day: number;
    present: number;
    late: number;
    absent: number;
    leave: number;
    missing: number;
  }[];
  /**
   * What the page is filtered to: a month (default), a custom date range or a whole year.
   * The summary cards, charts and day table all use these period* fields.
   */
  period: Period;
  periodSummary: MySummary;
  /** every day of the period, in order, before the status filter */
  periodDays: MyDay[];
  /** one point per day, or per month when the period is longer than ~2 months */
  periodSeries: MySeriesPoint[];
  status: StatusFilter;
  leaveRequests: {
    id: string;
    type: string;
    from: Date;
    to: Date;
    days: number;
    status: string;
    approverLevel: string | null;
  }[];
};

const LABEL: Record<string, string> = {
  PRESENT: "Present",
  SHORT_LEAVE: "Short leave",
  HALF_DAY: "Half day",
  LATE: "Late",
  ABSENT: "Absent",
  INCOMPLETE: "Missing punch",
  ON_LEAVE: "On leave",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekly off",
  NO_RECORD: "No record",
};

const TONE: Record<string, DayTone> = {
  PRESENT: "good",
  ON_LEAVE: "good",
  SHORT_LEAVE: "fair",
  HALF_DAY: "fair",
  LATE: "fair",
  INCOMPLETE: "fair",
  ABSENT: "poor",
  HOLIDAY: "holiday",
  WEEKEND: "off",
  NO_RECORD: "none",
};

/** Beyond this many days the chart shows one bar per month instead of one per day. */
const DAILY_CHART_MAX_DAYS = 62;

/**
 * Which day the employee dashboard shows:
 * ?date=YYYY-MM-DD, else the last record in ?month=YYYY-MM, else the employee's own
 * latest record, else today. Only this employee's data is looked at.
 */
export async function resolveMyDate(
  employeeId: string,
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
      where: { employeeId, date: { gte: start, lt: end } },
    });
    return r._max.date ?? start;
  }

  const latest = await prisma.attendance.aggregate({
    _max: { date: true },
    where: { employeeId },
  });
  if (latest._max.date) return latest._max.date;
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Reads ?from= &to= &month= &year= &date= &status= and works out
 *  - `date`:   the selected day (calendar + "selected day" card)
 *  - `period`: a custom range or year, or null for the normal month view
 *  - `status`: the status filter ("ALL" when none)
 * Every page that shows the employee's own attendance calls this.
 */
export async function resolveMyView(
  employeeId: string,
  sp: PeriodParams & { status?: string },
): Promise<{ date: Date; period: Period | null; status: StatusFilter }> {
  const status = parseStatusFilter(sp.status);
  const custom = parseCustomPeriod(sp);

  if (custom) {
    // Select the last day that has a record inside the period, else its first day.
    const latest = await prisma.attendance.aggregate({
      _max: { date: true },
      where: { employeeId, date: { gte: custom.start, lte: custom.end } },
    });
    return { date: latest._max.date ?? custom.start, period: custom, status };
  }

  const date = await resolveMyDate(employeeId, sp.date, sp.month);
  return { date, period: null, status };
}

/** One entry per calendar day from `start` to `end` (both inclusive). */
async function buildDays(
  employeeId: string,
  start: Date,
  end: Date,
): Promise<MyDay[]> {
  const rows = await prisma.attendance.findMany({
    where: { employeeId, date: { gte: start, lt: addDays(end, 1) } },
    orderBy: { date: "asc" },
  });
  const rowByDate = new Map(rows.map((r) => [toIsoDate(r.date), r]));

  // The weekly-off days and holidays can differ per month: load each month once.
  const monthKeys: { year: number; month: number }[] = [];
  const seen = new Set<string>();
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    if (!seen.has(key)) {
      seen.add(key);
      monthKeys.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }
  }
  const loaded = await Promise.all(
    monthKeys.map((m) => getMonthCalendar(m.year, m.month)),
  );
  const calendars = new Map<
    string,
    { cal: MonthCalendar; dayTypeOf: ReturnType<typeof makeDayTypeResolver> }
  >();
  monthKeys.forEach((m, i) =>
    calendars.set(`${m.year}-${m.month}`, {
      cal: loaded[i],
      dayTypeOf: makeDayTypeResolver(loaded[i]),
    }),
  );

  const days: MyDay[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    const iso = toIsoDate(current);
    const { cal, dayTypeOf } = calendars.get(
      `${current.getUTCFullYear()}-${current.getUTCMonth() + 1}`,
    )!;
    const row = rowByDate.get(iso);
    const dayType = dayTypeOf(current);
    const holiday =
      dayType === "HOLIDAY"
        ? cal.holidays.find((h) => toIsoDate(h.date) === iso)
        : undefined;

    // A saved record wins (someone who worked on a holiday still shows as present);
    // without one, the calendar says whether it was a weekly off day or a holiday.
    const status = row
      ? row.status
      : dayType === "HOLIDAY"
        ? "HOLIDAY"
        : dayType === "WEEKEND"
          ? "WEEKEND"
          : "NO_RECORD";

    days.push({
      iso,
      day: current.getUTCDate(),
      status,
      tone: TONE[status] ?? "none",
      label: LABEL[status] ?? status,
      note: row?.remarks ?? holiday?.title ?? null,
      checkIn: row?.checkIn ?? null,
      checkOut: row?.checkOut ?? null,
      workingMinutes: row?.workingMinutes ?? 0,
      lateMinutes: row?.lateMinutes ?? 0,
      earlyLeaveMinutes: row?.earlyLeaveMinutes ?? 0,
      overtimeMinutes: row?.overtimeMinutes ?? 0,
      isManual: row?.isManual ?? false,
    });
  }
  return days;
}

function summarize(days: MyDay[]): MySummary {
  const s: MySummary = {
    attended: 0,
    present: 0,
    shortLeave: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    missingPunch: 0,
    weeklyOff: 0,
    holidays: 0,
    lateDays: 0,
    lateMinutes: 0,
    overtimeMinutes: 0,
    workingMinutes: 0,
  };
  for (const d of days) {
    switch (d.status) {
      case "PRESENT":
        s.present++;
        break;
      case "SHORT_LEAVE":
        s.shortLeave++;
        break;
      case "HALF_DAY":
        s.halfDay++;
        break;
      case "ABSENT":
        s.absent++;
        break;
      case "ON_LEAVE":
        s.onLeave++;
        break;
      case "INCOMPLETE":
        s.missingPunch++;
        break;
      case "WEEKEND":
        s.weeklyOff++;
        break;
      case "HOLIDAY":
        s.holidays++;
        break;
    }
    s.lateMinutes += d.lateMinutes;
    s.overtimeMinutes += d.overtimeMinutes;
    s.workingMinutes += d.workingMinutes;
  }
  s.lateDays = s.shortLeave + s.halfDay;
  s.attended = s.present + s.shortLeave + s.halfDay;
  return s;
}

function counts(status: string) {
  return {
    present: status === "PRESENT" ? 1 : 0,
    late: status === "SHORT_LEAVE" || status === "HALF_DAY" ? 1 : 0,
    absent: status === "ABSENT" ? 1 : 0,
    leave: status === "ON_LEAVE" ? 1 : 0,
    missing: status === "INCOMPLETE" ? 1 : 0,
  };
}

function seriesFor(days: MyDay[]): MySeriesPoint[] {
  if (days.length === 0) return [];
  const first = days[0].iso;
  const last = days[days.length - 1].iso;
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const sameYear = first.slice(0, 4) === last.slice(0, 4);

  if (days.length <= DAILY_CHART_MAX_DAYS) {
    return days.map((d) => {
      const monthName = MONTHS[Number(d.iso.slice(5, 7)) - 1].slice(0, 3);
      return {
        label: sameMonth ? String(d.day) : `${d.day} ${monthName}`,
        ...counts(d.status),
      };
    });
  }

  // Long period: one bar per month.
  const byMonth = new Map<string, MySeriesPoint>();
  for (const d of days) {
    const key = d.iso.slice(0, 7);
    let point = byMonth.get(key);
    if (!point) {
      const name = MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3);
      point = {
        label: sameYear ? name : `${name} ${key.slice(2, 4)}`,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        missing: 0,
      };
      byMonth.set(key, point);
    }
    const c = counts(d.status);
    point.present += c.present;
    point.late += c.late;
    point.absent += c.absent;
    point.leave += c.leave;
    point.missing += c.missing;
  }
  return [...byMonth.values()];
}

export async function getMyDashboardData(
  employeeId: string,
  date: Date,
  options: { period?: Period | null; status?: StatusFilter } = {},
): Promise<MyDashboardData | null> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const monthOf = monthPeriod(year, month);
  const customPeriod = options.period ?? null;

  const [employee, monthDays, customDays, leaveRows] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        name: true,
        employeeCode: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    }),
    buildDays(employeeId, monthOf.start, monthOf.end),
    customPeriod
      ? buildDays(employeeId, customPeriod.start, customPeriod.end)
      : Promise.resolve(null),
    prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { leaveType: { select: { name: true } } },
    }),
  ]);

  // The user account must be linked to an existing employee.
  if (!employee) return null;

  const period = customPeriod ?? monthOf;
  const periodDays = customDays ?? monthDays;

  const calendar: MyDashboardData["calendar"] = {};
  for (const d of monthDays) calendar[d.iso] = { tone: d.tone, title: d.label };

  const summary = summarize(monthDays);

  return {
    employee: {
      name: employee.name,
      employeeCode: employee.employeeCode,
      department: employee.department.name,
      designation: employee.designation?.title ?? "",
    },
    year,
    month,
    date,
    summary,
    selected: monthDays[date.getUTCDate() - 1],
    days: monthDays,
    calendar,
    series: monthDays.map((d) => ({ day: d.day, ...counts(d.status) })),
    period,
    periodSummary: customDays ? summarize(customDays) : summary,
    periodDays,
    periodSeries: seriesFor(periodDays),
    status: options.status ?? "ALL",
    leaveRequests: leaveRows.map((leave) => ({
      id: leave.id,
      type: leave.leaveType.name,
      from: leave.startDate,
      to: leave.endDate,
      days: leave.days,
      status: leave.status,
      approverLevel: leave.approverLevel,
    })),
  };
}
