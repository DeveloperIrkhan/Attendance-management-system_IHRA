import { prisma } from "../lib/prisma";
import { toRuleConfig } from "../lib/attendance/attendance-rules";
import { officeNow } from "../lib/attendance/office-clock";
import {
  LEAVE_REMARK,
  planLeaveSync,
  type DayType,
  type ExistingRow,
} from "../lib/attendance/leave-sync";

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Brings the attendance rows of one employee between `from` and `to` in line with their
 * approved leaves. Safe to run again and again. Days after today are written when they arrive.
 */
export async function syncLeaveToAttendance(
  employeeId: string,
  from: Date,
  to: Date,
) {
  const summary = { created: 0, markedOnLeave: 0, reverted: 0, removed: 0 };

  const settings = await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  const cfg = toRuleConfig(settings);
  const { todayMs, minutes: nowMinutes } = officeNow();

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const lastMs = Math.min(toMs, todayMs);
  if (lastMs < fromMs) return summary;

  const [employee, rows, leaves] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { isActive: true, joiningDate: true },
    }),
    prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: new Date(fromMs), lte: new Date(lastMs) },
      },
      select: {
        date: true,
        status: true,
        isManual: true,
        checkIn: true,
        remarks: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        startDate: { lte: new Date(lastMs) },
        endDate: { gte: new Date(fromMs) },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);
  if (!employee || !employee.isActive) return summary;

  // Weekly off days and holidays, per month
  const calendars = new Map<string, { off: number[]; holidays: Set<string> }>();
  const monthKeys = new Set<string>();
  for (let ms = fromMs; ms <= lastMs; ms += DAY_MS) monthKeys.add(iso(ms).slice(0, 7));
  for (const key of monthKeys) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const [override, holidays] = await Promise.all([
      prisma.monthlyOffDays.findUnique({ where: { year_month: { year, month } } }),
      prisma.holiday.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt: new Date(Date.UTC(year, month, 1)),
          },
        },
        select: { date: true },
      }),
    ]);
    calendars.set(key, {
      off: override?.weeklyOffDays ?? settings.defaultWeeklyOffDays,
      holidays: new Set(holidays.map((h) => iso(h.date.getTime()))),
    });
  }
  const dayTypeOf = (ms: number): DayType => {
    const calendar = calendars.get(iso(ms).slice(0, 7));
    if (!calendar) return "WORKING";
    if (calendar.holidays.has(iso(ms))) return "HOLIDAY";
    return calendar.off.includes(new Date(ms).getUTCDay()) ? "WEEKEND" : "WORKING";
  };

  const rowMap = new Map<string, ExistingRow>(
    rows.map((r) => [
      iso(r.date.getTime()),
      {
        status: r.status,
        isManual: r.isManual,
        hasCheckIn: r.checkIn !== null,
        remarks: r.remarks,
      },
    ]),
  );

  const plan = planLeaveSync({
    fromMs,
    toMs,
    todayMs,
    nowMinutes,
    shiftEndMinutes: cfg.shiftEnd,
    leaves: leaves.map((l) => ({
      startMs: l.startDate.getTime(),
      endMs: l.endDate.getTime(),
    })),
    joiningMs: employee.joiningDate ? employee.joiningDate.getTime() : null,
    rows: rowMap,
    dayTypeOf,
  });

  const at = (ms: number) => ({ employeeId_date: { employeeId, date: new Date(ms) } });
  const changes = [
    ...plan.toOnLeave.map((d) =>
      prisma.attendance.update({
        where: at(d.dateMs),
        data: { status: "ON_LEAVE", remarks: LEAVE_REMARK },
      }),
    ),
    ...plan.toIncomplete.map((d) =>
      prisma.attendance.update({
        where: at(d.dateMs),
        data: { status: "INCOMPLETE", remarks: "Leave cancelled" },
      }),
    ),
    ...plan.toAbsent.map((d) =>
      prisma.attendance.update({
        where: at(d.dateMs),
        data: { status: "ABSENT", remarks: "Leave cancelled" },
      }),
    ),
    ...plan.remove.map((d) => prisma.attendance.delete({ where: at(d.dateMs) })),
  ];
  if (changes.length) await prisma.$transaction(changes);

  if (plan.create.length) {
    // never replaces a row that appeared in the meantime (the sync may write the same day)
    const result = await prisma.attendance.createMany({
      data: plan.create.map((d) => ({
        employeeId,
        date: new Date(d.dateMs),
        status: "ON_LEAVE" as const,
        remarks: LEAVE_REMARK,
        sourceBatchId: null,
      })),
      skipDuplicates: true,
    });
    summary.created = result.count;
  }
  summary.markedOnLeave = plan.toOnLeave.length;
  summary.reverted = plan.toIncomplete.length + plan.toAbsent.length;
  summary.removed = plan.remove.length;
  return summary;
}

/**
 * Safety net for the sync: makes sure everyone whose approved leave covers today (or the last
 * few days) is shown as on leave. This is also what puts a leave approved in advance onto the
 * calendar once its first day arrives.
 */
export async function syncApprovedLeavesToAttendance(sinceDays = 2) {
  const { todayMs } = officeNow();
  const from = todayMs - sinceDays * DAY_MS;
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: new Date(todayMs) },
      endDate: { gte: new Date(from) },
      employee: { isActive: true },
    },
    select: { employeeId: true, startDate: true, endDate: true },
  });

  const ranges = new Map<string, { from: number; to: number }>();
  for (const l of leaves) {
    const start = Math.max(l.startDate.getTime(), from);
    const end = Math.min(l.endDate.getTime(), todayMs);
    const current = ranges.get(l.employeeId);
    ranges.set(l.employeeId, {
      from: current ? Math.min(current.from, start) : start,
      to: current ? Math.max(current.to, end) : end,
    });
  }

  let touched = 0;
  for (const [employeeId, range] of ranges) {
    const r = await syncLeaveToAttendance(
      employeeId,
      new Date(range.from),
      new Date(range.to),
    );
    touched += r.created + r.markedOnLeave;
  }
  return { employeesChecked: ranges.size, rowsWritten: touched };
}
