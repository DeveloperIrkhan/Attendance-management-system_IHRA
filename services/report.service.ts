import "server-only";
import { prisma } from "@/lib/prisma";
import {
  employeeWhereFor,
  scopeLabel,
  type DataScope,
} from "@/lib/auth/data-scope";
import {
  clockText,
  monthRange,
  parseIsoDate,
  parseMonthParam,
  toIsoDate,
} from "@/lib/attendance/dates";
import { formatMinutes } from "@/lib/attendance/duration";
import { MONTHS } from "@/lib/attendance/months";
import { APPROVER_LABEL } from "@/lib/leave/approval-routing";
import type { ReportParams, ReportTable } from "@/lib/reports/type";
import { getLatestAttendanceDate } from "./attendance.service";
import { getMonthlySummary } from "./monthly-summary.service";
import { ServiceError } from "@/lib/action-state";

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present",
  SHORT_LEAVE: "Short leave",
  HALF_DAY: "Half day",
  LATE: "Late",
  ABSENT: "Absent",
  INCOMPLETE: "Missing punch",
  ON_LEAVE: "On leave",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekly off",
};
const label = (s: string) => STATUS_LABEL[s] ?? s;
const mins = (n: number) => (n > 0 ? formatMinutes(n) : "-");
const fmtDate = (d: Date) => toIsoDate(d);

const MAX_ROWS = 5000;
const MAX_RANGE_DAYS = 366;

export function listReportEmployees(scope: DataScope) {
  return prisma.employee.findMany({
    where: employeeWhereFor(scope),
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true },
  });
}

export async function buildReport(
  params: ReportParams,
  scope: DataScope,
): Promise<ReportTable> {
  if (scope.kind === "SELF") {
    throw new ServiceError("You do not have access to reports.");
  }

  // A DD's own department is always applied; the department filter only narrows "ALL".
  const employee = employeeWhereFor(scope, params.department);
  const latest =
    (await getLatestAttendanceDate()) ??
    new Date(
      Date.UTC(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
      ),
    );
  const period = parseMonthParam(params.month) ?? {
    year: latest.getUTCFullYear(),
    month: latest.getUTCMonth() + 1,
  };
  const monthName = `${MONTHS[period.month - 1]} ${period.year}`;

  const from =
    parseIsoDate(params.from) ??
    new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  const to = parseIsoDate(params.to) ?? latest;
  if (to < from)
    throw new ServiceError("The end date is before the start date.");
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new ServiceError("Choose a range of at most one year.");
  }
  const rangeText = `${fmtDate(from)} to ${fmtDate(to)}`;

  let departmentName: string | undefined;
  if (scope.kind === "DEPARTMENT" || params.department) {
    const dept = await prisma.department.findUnique({
      where: {
        id:
          scope.kind === "DEPARTMENT" ? scope.departmentId : params.department!,
      },
      select: { name: true },
    });
    departmentName = dept?.name;
  }
  const who =
    scope.kind === "DEPARTMENT" || departmentName
      ? `Department: ${departmentName ?? "-"}`
      : scopeLabel(scope);

  const personInclude = {
    employee: {
      select: {
        name: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
    },
  } as const;

  switch (params.type) {
    // ------------------------------------------------------------------ daily
    case "daily": {
      const date = parseIsoDate(params.date) ?? latest;
      const records = await prisma.attendance.findMany({
        where: { date, employee },
        include: personInclude,
        orderBy: { employee: { name: "asc" } },
        take: MAX_ROWS,
      });
      const counts = new Map<string, number>();
      for (const r of records)
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
      return {
        title: "Daily attendance",
        subtitle: `${fmtDate(date)} · ${who}`,
        column: [
          { label: "Code" },
          { label: "Name", weight: 2 },
          { label: "Department", weight: 1.5 },
          { label: "In", align: "center" },
          { label: "Out", align: "center" },
          { label: "Worked", align: "right" },
          { label: "Late", align: "right" },
          { label: "Overtime", align: "right" },
          { label: "Status" },
        ],
        rows: records.map((r) => [
          r.employee.employeeCode,
          r.employee.name,
          r.employee.department.name,
          clockText(r.checkIn),
          clockText(r.checkOut),
          r.checkIn && r.checkOut ? mins(r.workingMinutes) : "-",
          mins(r.lateMinutes),
          mins(r.overtimeMinutes),
          label(r.status),
        ]),
        notes: [
          [...counts.entries()]
            .map(([s, n]) => `${label(s)} ${n}`)
            .join(" · ") || "No records for this date.",
        ],
      };
    }

    // ---------------------------------------------------------------- monthly
    case "monthly": {
      const { rows, totals } = await getMonthlySummary(
        period.year,
        period.month,
        params.department,
        scope,
      );
      const line = (c: typeof totals) => [
        String(c.workingDays),
        String(c.present),
        String(c.shortLeave),
        String(c.halfDay),
        String(c.missingPunch),
        String(c.absent),
        String(c.onLeave),
        mins(c.lateMinutes),
        mins(c.overtimeMinutes),
        mins(c.workedMinutes),
      ];
      return {
        title: "Monthly attendance",
        subtitle: `${monthName} · ${who}`,
        column: [
          { label: "Code" },
          { label: "Name", weight: 2 },
          { label: "Department", weight: 1.5 },
          { label: "Working days", align: "right" },
          { label: "Present", align: "right" },
          { label: "Short leave", align: "right" },
          { label: "Half day", align: "right" },
          { label: "Missing punch", align: "right" },
          { label: "Absent", align: "right" },
          { label: "On leave", align: "right" },
          { label: "Late", align: "right" },
          { label: "Overtime", align: "right" },
          { label: "Worked", align: "right" },
        ],
        rows: rows.map((r) => [r.code, r.name, r.department, ...line(r)]),
        totals: ["", "Total", "", ...line(totals)],
        notes: ["Missing punch days count as absent until HR corrects them."],
      };
    }

    // ------------------------------------------------------------------- late
    case "late": {
      const records = await prisma.attendance.findMany({
        where: {
          date: { gte: from, lte: to },
          employee,
          OR: [
            { status: { in: ["SHORT_LEAVE", "HALF_DAY"] } },
            {
              lateMinutes: { gt: 0 },
              status: { notIn: ["WEEKEND", "HOLIDAY"] },
            },
          ],
        },
        include: personInclude,
        orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
        take: MAX_ROWS,
      });
      const total = records.reduce((s, r) => s + r.lateMinutes, 0);
      return {
        title: "Late arrivals",
        subtitle: `${rangeText} · ${who}`,
        column: [
          { label: "Date" },
          { label: "Code" },
          { label: "Name", weight: 2 },
          { label: "Department", weight: 1.5 },
          { label: "In", align: "center" },
          { label: "Late by", align: "right" },
          { label: "Status" },
        ],
        rows: records.map((r) => [
          fmtDate(r.date),
          r.employee.employeeCode,
          r.employee.name,
          r.employee.department.name,
          clockText(r.checkIn),
          mins(r.lateMinutes),
          label(r.status),
        ]),
        notes: [
          `${records.length} late arrival(s), ${mins(total)} late in total.`,
        ],
      };
    }

    // ----------------------------------------------------------------- absent
    case "absent": {
      const records = await prisma.attendance.findMany({
        where: {
          date: { gte: from, lte: to },
          employee,
          status: { in: ["ABSENT", "INCOMPLETE"] },
        },
        include: personInclude,
        orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
        take: MAX_ROWS,
      });
      const absent = records.filter((r) => r.status === "ABSENT").length;
      return {
        title: "Absentees",
        subtitle: `${rangeText} · ${who}`,
        column: [
          { label: "Date" },
          { label: "Code" },
          { label: "Name", weight: 2 },
          { label: "Department", weight: 1.5 },
          { label: "Status" },
          { label: "Remarks", weight: 2 },
        ],
        rows: records.map((r) => [
          fmtDate(r.date),
          r.employee.employeeCode,
          r.employee.name,
          r.employee.department.name,
          label(r.status),
          r.remarks ?? "",
        ]),
        notes: [
          `${absent} absent day(s), ${records.length - absent} missing punch day(s).`,
        ],
      };
    }

    // --------------------------------------------------------------- overtime
    case "overtime": {
      const records = await prisma.attendance.findMany({
        where: {
          date: { gte: from, lte: to },
          employee,
          overtimeMinutes: { gt: 0 },
        },
        include: personInclude,
      });
      const byEmployee = new Map<
        string,
        {
          code: string;
          name: string;
          dept: string;
          days: number;
          minutes: number;
        }
      >();
      for (const r of records) {
        const key = r.employee.employeeCode;
        const e = byEmployee.get(key) ?? {
          code: r.employee.employeeCode,
          name: r.employee.name,
          dept: r.employee.department.name,
          days: 0,
          minutes: 0,
        };
        e.days++;
        e.minutes += r.overtimeMinutes;
        byEmployee.set(key, e);
      }
      const list = [...byEmployee.values()].sort(
        (a, b) => b.minutes - a.minutes,
      );
      const total = list.reduce((s, e) => s + e.minutes, 0);
      return {
        title: "Overtime",
        subtitle: `${rangeText} · ${who}`,
        column: [
          { label: "Code" },
          { label: "Name", weight: 2 },
          { label: "Department", weight: 1.5 },
          { label: "Days with overtime", align: "right" },
          { label: "Total overtime", align: "right" },
        ],
        rows: list.map((e) => [
          e.code,
          e.name,
          e.dept,
          String(e.days),
          mins(e.minutes),
        ]),
        totals: [
          "",
          "Total",
          "",
          String(list.reduce((s, e) => s + e.days, 0)),
          mins(total),
        ],
        notes: [
          "Overtime is time after the shift end, as set on the Rules page.",
        ],
      };
    }

    // ------------------------------------------------------------- department
    case "department": {
      const { start, end } = monthRange(period.year, period.month);
      const [records, headcount] = await Promise.all([
        prisma.attendance.findMany({
          where: { date: { gte: start, lt: end }, employee },
          select: {
            status: true,
            lateMinutes: true,
            overtimeMinutes: true,
            employee: { select: { department: { select: { name: true } } } },
          },
        }),
        prisma.employee.groupBy({
          by: ["departmentId"],
          where: { isActive: true, ...employee },
          _count: { _all: true },
        }),
      ]);
      const names = new Map(
        (
          await prisma.department.findMany({ select: { id: true, name: true } })
        ).map((d) => [d.id, d.name]),
      );
      type Row = Record<string, number> & { employees: number };
      const blank = (): Row => ({
        employees: 0,
        present: 0,
        shortLeave: 0,
        halfDay: 0,
        missing: 0,
        absent: 0,
        leave: 0,
        late: 0,
        overtime: 0,
      });
      const byDept = new Map<string, Row>();
      for (const h of headcount) {
        const r = blank();
        r.employees = h._count._all;
        byDept.set(names.get(h.departmentId) ?? "-", r);
      }
      for (const r of records) {
        const key = r.employee.department.name;
        const d = byDept.get(key) ?? blank();
        switch (r.status) {
          case "PRESENT":
            d.present++;
            break;
          case "SHORT_LEAVE":
            d.shortLeave++;
            break;
          case "HALF_DAY":
            d.halfDay++;
            break;
          case "INCOMPLETE":
            d.missing++;
            break;
          case "ABSENT":
            d.absent++;
            break;
          case "ON_LEAVE":
            d.leave++;
            break;
        }
        d.late += r.lateMinutes;
        d.overtime += r.overtimeMinutes;
        byDept.set(key, d);
      }
      const entries = [...byDept.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      );
      const cells = (d: Row) => [
        String(d.employees),
        String(d.present),
        String(d.shortLeave),
        String(d.halfDay),
        String(d.missing),
        String(d.absent),
        String(d.leave),
        mins(d.late),
        mins(d.overtime),
      ];
      const sum = blank();
      for (const [, d] of entries)
        for (const k of Object.keys(sum)) sum[k] += d[k];
      return {
        title: "Department summary",
        subtitle: `${monthName} · ${who}`,
        column: [
          { label: "Department", weight: 2 },
          { label: "Employees", align: "right" },
          { label: "Present", align: "right" },
          { label: "Short leave", align: "right" },
          { label: "Half day", align: "right" },
          { label: "Missing punch", align: "right" },
          { label: "Absent", align: "right" },
          { label: "On leave", align: "right" },
          { label: "Late", align: "right" },
          { label: "Overtime", align: "right" },
        ],
        rows: entries.map(([name, d]) => [name, ...cells(d)]),
        totals: ["Total", ...cells(sum)],
        notes: ["Counts are employee-days in the month."],
      };
    }

    // ---------------------------------------------------------------- history
    case "history": {
      if (!params.employee) {
        throw new ServiceError("Choose an employee for this report.");
      }
      // the employee must be inside the person's scope
      const target = await prisma.employee.findFirst({
        where: { id: params.employee, ...employeeWhereFor(scope) },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          department: { select: { name: true } },
        },
      });
      if (!target) throw new ServiceError("Employee not found.");

      const records = await prisma.attendance.findMany({
        where: { employeeId: target.id, date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
      });
      const attended = records.filter((r) =>
        ["PRESENT", "SHORT_LEAVE", "HALF_DAY"].includes(r.status),
      ).length;
      return {
        title: "Employee attendance history",
        subtitle: `${target.name} (${target.employeeCode}) · ${target.department.name} · ${rangeText}`,
        column: [
          { label: "Date" },
          { label: "Day" },
          { label: "In", align: "center" },
          { label: "Out", align: "center" },
          { label: "Worked", align: "right" },
          { label: "Late", align: "right" },
          { label: "Overtime", align: "right" },
          { label: "Status" },
          { label: "Remarks", weight: 2 },
        ],
        rows: records.map((r) => [
          fmtDate(r.date),
          r.date.toLocaleDateString("en-GB", {
            weekday: "short",
            timeZone: "UTC",
          }),
          clockText(r.checkIn),
          clockText(r.checkOut),
          r.checkIn && r.checkOut ? mins(r.workingMinutes) : "-",
          mins(r.lateMinutes),
          mins(r.overtimeMinutes),
          label(r.status),
          r.remarks ?? "",
        ]),
        notes: [`${attended} day(s) attended in this range.`],
      };
    }

    // ----------------------------------------------------------------- leaves
    case "leaves": {
      const statuses = [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
      ] as const;
      const status = statuses.find((s) => s === params.status);
      const requests = await prisma.leaveRequest.findMany({
        where: {
          employee,
          ...(status ? { status } : {}),
          startDate: { lte: to },
          endDate: { gte: from },
        },
        include: {
          employee: {
            select: {
              name: true,
              employeeCode: true,
              department: { select: { name: true } },
            },
          },
          leaveType: { select: { name: true } },
        },
        orderBy: [{ startDate: "asc" }],
        take: MAX_ROWS,
      });
      const deciderIds = [
        ...new Set(requests.map((r) => r.decidedById).filter(Boolean)),
      ] as string[];
      const deciders = new Map(
        (
          await prisma.user.findMany({
            where: { id: { in: deciderIds } },
            select: { id: true, fullName: true },
          })
        ).map((u) => [u.id, u.fullName]),
      );
      const approvedDays = requests
        .filter((r) => r.status === "APPROVED")
        .reduce((s, r) => s + r.days, 0);
      return {
        title: "Leave history",
        subtitle: `${rangeText}${status ? ` · ${status.toLowerCase()}` : ""} · ${who}`,
        column: [
          { label: "Employee", weight: 2 },
          { label: "Department", weight: 1.5 },
          { label: "Type" },
          { label: "From" },
          { label: "To" },
          { label: "Days", align: "right" },
          { label: "Status" },
          { label: "Routed to" },
          { label: "Decided by", weight: 1.5 },
          { label: "Decided on" },
        ],
        rows: requests.map((r) => [
          `${r.employee.name} (${r.employee.employeeCode})`,
          r.employee.department.name,
          r.leaveType.name,
          fmtDate(r.startDate),
          fmtDate(r.endDate),
          String(r.days),
          r.status.charAt(0) + r.status.slice(1).toLowerCase(),
          r.approverLevel && r.approverLevel !== "STAFF"
            ? APPROVER_LABEL[r.approverLevel]
            : "-",
          r.decidedById ? (deciders.get(r.decidedById) ?? "-") : "-",
          r.decidedAt ? fmtDate(r.decidedAt) : "-",
        ]),
        notes: [
          `${requests.length} request(s), ${approvedDays} approved working day(s).`,
        ],
      };
    }
    default:
      throw new ServiceError("Unknown report type.");
  }
}
