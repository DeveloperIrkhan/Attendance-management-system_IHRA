import "server-only";

import { prisma } from "@/lib/prisma";
import {
  monthRange,
  parseIsoDate,
  parseMonthParam,
  toIsoDate,
} from "@/lib/attendance/dates";
import { getMonthCalendar, makeDayTypeResolver } from "./settings.service";
import type { DayTone } from "./dashboard.service";

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

export type MyDashboardData = {
  employee: {
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
  };
  year: number;
  month: number;
  date: Date;
  summary: {
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

export async function getMyDashboardData(
  employeeId: string,
  date: Date,
): Promise<MyDashboardData | null> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const { start, end } = monthRange(year, month);

  const [employee, monthRows, leaveRows, monthCalendar] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        name: true,
        employeeCode: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { employeeId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { leaveType: { select: { name: true } } },
    }),
    getMonthCalendar(year, month),
  ]);

  // The user account must be linked to an existing employee.
  if (!employee) return null;

  const dayTypeOf = makeDayTypeResolver(monthCalendar);
  const rowByDate = new Map(monthRows.map((r) => [toIsoDate(r.date), r]));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const summary: MyDashboardData["summary"] = {
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

  const days: MyDay[] = [];
  const calendar: MyDashboardData["calendar"] = {};
  const series: MyDashboardData["series"] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const current = new Date(Date.UTC(year, month - 1, day));
    const iso = toIsoDate(current);
    const row = rowByDate.get(iso);
    const dayType = dayTypeOf(current);
    const holiday =
      dayType === "HOLIDAY"
        ? monthCalendar.holidays.find((h) => toIsoDate(h.date) === iso)
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

    const entry: MyDay = {
      iso,
      day,
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
    };
    days.push(entry);
    calendar[iso] = { tone: entry.tone, title: entry.label };

    switch (status) {
      case "PRESENT":
        summary.present++;
        break;
      case "SHORT_LEAVE":
        summary.shortLeave++;
        break;
      case "HALF_DAY":
        summary.halfDay++;
        break;
      case "ABSENT":
        summary.absent++;
        break;
      case "ON_LEAVE":
        summary.onLeave++;
        break;
      case "INCOMPLETE":
        summary.missingPunch++;
        break;
      case "WEEKEND":
        summary.weeklyOff++;
        break;
      case "HOLIDAY":
        summary.holidays++;
        break;
    }
    summary.lateMinutes += entry.lateMinutes;
    summary.overtimeMinutes += entry.overtimeMinutes;
    summary.workingMinutes += entry.workingMinutes;

    series.push({
      day,
      present: status === "PRESENT" ? 1 : 0,
      late: status === "SHORT_LEAVE" || status === "HALF_DAY" ? 1 : 0,
      absent: status === "ABSENT" ? 1 : 0,
      leave: status === "ON_LEAVE" ? 1 : 0,
      missing: status === "INCOMPLETE" ? 1 : 0,
    });
  }

  summary.lateDays = summary.shortLeave + summary.halfDay;
  summary.attended = summary.present + summary.shortLeave + summary.halfDay;

  const selected = days[date.getUTCDate() - 1];

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
    selected,
    days,
    calendar,
    series,
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
