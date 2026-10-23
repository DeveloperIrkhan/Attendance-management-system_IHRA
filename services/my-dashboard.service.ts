import "server-only";

import { prisma } from "@/lib/prisma";
import { toIsoDate, monthRange } from "@/lib/attendance/dates";
import { getMonthCalendar, makeDayTypeResolver } from "./settings.service";
import type { DayTone } from "./dashboard.service";

export type MyDashboardData = {
  employee: {
    employeeCode: string;
    department: string;
    designation: string;
  };
  year: number;
  month: number;
  date: Date;
  todayIso: string;
  summary: {
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    shortLeave: number;
    halfDay: number;
  };
  series: {
    day: number;
    present: number;
    late: number;
    absent: number;
    leave: number;
  }[];
  calendar: Record<string, { tone: DayTone; title: string }>;
  attendance: {
    id: string;
    date: Date;
    status: string;
    checkIn: Date | null;
    checkOut: Date | null;
  }[];
  leaveRequests: {
    id: string;
    type: string;
    from: Date;
    to: Date;
    status: string;
  }[];
};

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
        employeeCode: true,
        department: {
          select: { name: true },
        },
        designation: {
          select: { title: true },
        },
      },
    }),

    prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: start, lt: end },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
      },
    }),

    prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        leaveType: {
          select: { name: true },
        },
      },
    }),

    getMonthCalendar(year, month),
  ]);

  // The user account must be linked to an existing employee.
  if (!employee) return null;

  const dayTypeOf = makeDayTypeResolver(monthCalendar);

  const summary = {
    present: 0,
    late: 0,
    absent: 0,
    onLeave: 0,
    shortLeave: 0,
    halfDay: 0,
  };

  const rowByDate = new Map<string, (typeof monthRows)[number]>();

  for (const row of monthRows) {
    const iso = toIsoDate(row.date);
    rowByDate.set(iso, row);

    switch (row.status) {
      case "PRESENT":
        summary.present++;
        break;
      case "SHORT_LEAVE":
        summary.shortLeave++;
        summary.late++;
        break;
      case "HALF_DAY":
        summary.halfDay++;
        summary.late++;
        break;
      case "ABSENT":
        summary.absent++;
        break;
      case "ON_LEAVE":
        summary.onLeave++;
        break;
    }
  }

  const calendar: MyDashboardData["calendar"] = {};
  const series: MyDashboardData["series"] = [];

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(Date.UTC(year, month - 1, day));
    const iso = toIsoDate(currentDate);
    const row = rowByDate.get(iso);
    const dayType = dayTypeOf(currentDate);

    let tone: DayTone = "none";
    let title = "No attendance record";

    if (dayType === "HOLIDAY") {
      tone = "holiday";
      title = "Holiday";
    } else if (dayType === "WEEKEND") {
      tone = "off";
      title = "Weekly off";
    } else if (row) {
      switch (row.status) {
        case "PRESENT":
          tone = "good";
          title = "Present";
          break;
        case "SHORT_LEAVE":
          tone = "fair";
          title = "Short leave";
          break;
        case "HALF_DAY":
          tone = "fair";
          title = "Half day";
          break;
        case "ABSENT":
          tone = "poor";
          title = "Absent";
          break;
        case "INCOMPLETE":
          tone = "fair";
          title = "Missing punch";
          break;
        case "ON_LEAVE":
          tone = "good";
          title = "On leave";
          break;
        default:
          title = row.status;
      }
    }

    calendar[iso] = { tone, title };

    series.push({
      day,
      present: row?.status === "PRESENT" ? 1 : 0,
      late: row?.status === "SHORT_LEAVE" || row?.status === "HALF_DAY" ? 1 : 0,
      absent: row?.status === "ABSENT" ? 1 : 0,
      leave: row?.status === "ON_LEAVE" ? 1 : 0,
    });
  }

  return {
    employee: {
      employeeCode: employee.employeeCode,
      department: employee.department.name,
      designation: employee?.designation?.title ?? "",
    },
    year,
    month,
    date,
    todayIso: toIsoDate(date),
    summary,
    series,
    calendar,
    attendance: monthRows.slice(0, 10).map((row) => ({
      id: row.id,
      date: row.date,
      status: row.status,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
    })),
    leaveRequests: leaveRows.map((leave) => ({
      id: leave.id,
      type: leave.leaveType.name,
      from: leave.startDate,
      to: leave.endDate,
      status: leave.status,
    })),
  };
}
