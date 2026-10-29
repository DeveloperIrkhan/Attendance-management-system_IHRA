import "server-only";
import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/attendance/dates";
import { employeeWhereFor, type DataScope } from "@/lib/auth/data-scope";

export type SummaryRow = {
  employeeId: string;
  code: string;
  name: string;
  department: string;
  isActive: boolean;
  hasData: boolean;
  workingDays: number;
  present: number;
  shortLeave: number;
  halfDay: number;
  missingPunch: number;
  absent: number;
  onLeave: number;
  lateMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number;
  shortLeaveApprovedMinutes: number;
};

type Counters = Omit<
  SummaryRow,
  "employeeId" | "code" | "name" | "department" | "isActive" | "hasData"
>;

const emptyCounters = (): Counters => ({
  workingDays: 0,
  present: 0,
  shortLeave: 0,
  halfDay: 0,
  missingPunch: 0,
  absent: 0,
  onLeave: 0,
  lateMinutes: 0,
  overtimeMinutes: 0,
  workedMinutes: 0,
  shortLeaveApprovedMinutes: 0,
});

/** Computed live from the daily records, so it always includes HR corrections. */
export async function getMonthlySummary(
  year: number,
  month: number,
  departmentId: string | undefined,
  scope: DataScope,
) {
  const { start, end } = monthRange(year, month);
  const employeeFilter = employeeWhereFor(scope, departmentId);
  const records = await prisma.attendance.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(departmentId ? { employee: employeeFilter } : {}),
    },
    select: {
      employeeId: true,
      status: true,
      lateMinutes: true,
      overtimeMinutes: true,
      workingMinutes: true,
    },
  });

  const byEmployee = new Map<string, Counters>();
  for (const r of records) {
    const c = byEmployee.get(r.employeeId) ?? emptyCounters();
    if (r.status !== "WEEKEND" && r.status !== "HOLIDAY") c.workingDays++;
    switch (r.status) {
      case "PRESENT":
        c.present++;
        break;
      case "SHORT_LEAVE":
        c.shortLeave++;
        break;
      case "HALF_DAY":
        c.halfDay++;
        break;
      case "INCOMPLETE":
        c.missingPunch++;
        break;
      case "ABSENT":
        c.absent++;
        break;
      case "ON_LEAVE":
        c.onLeave++;
        break;
      default:
        break;
    }
    c.lateMinutes += r.lateMinutes;
    c.overtimeMinutes += r.overtimeMinutes;
    c.workedMinutes += r.workingMinutes;
    byEmployee.set(r.employeeId, c);
  }
  const approvedShortLeaves = await prisma.shortLeave.findMany({
    where: {
      status: "APPROVED",
      date: { gte: start, lt: end },
      ...(departmentId ? { employee: employeeFilter } : {}),
    },
    select: { employeeId: true, durationMinutes: true },
  });
  for (const sl of approvedShortLeaves) {
    const c = byEmployee.get(sl.employeeId);
    if (c) c.shortLeaveApprovedMinutes += sl.durationMinutes;
  }
  const ids = [...byEmployee.keys()];
  const employees = await prisma.employee.findMany({
    where: {
      AND: [
        departmentId ? { departmentId } : {},
        { OR: [{ isActive: true }, { id: { in: ids } }] },
      ],
    },
    orderBy: { employeeCode: "asc" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      isActive: true,
      department: { select: { name: true } },
    },
  });

  const rows: SummaryRow[] = employees.map((e) => {
    const counters = byEmployee.get(e.id);
    return {
      employeeId: e.id,
      code: e.employeeCode,
      name: e.name,
      department: e.department.name,
      isActive: e.isActive,
      hasData: Boolean(counters),
      ...(counters ?? emptyCounters()),
    };
  });

  const totals = emptyCounters();
  for (const r of rows) {
    (Object.keys(totals) as (keyof Counters)[]).forEach((k) => {
      totals[k] += r[k];
    });
  }

  return { rows, totals };
}
