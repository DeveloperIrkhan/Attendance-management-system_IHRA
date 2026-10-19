import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { AttendanceStatus, Prisma } from "@/lib/generated/prisma/client";
import {
  collectPunches,
  evaluateDay,
  formatMinutes,
  toMinutes,
  toRuleConfig,
} from "@/lib/attendance/attendance-rules";
import { monthRange, toIsoDate } from "@/lib/attendance/dates";
import {
  getMonthCalendar,
  getSettings,
  makeDayTypeResolver,
} from "./settings.service";

export type ProcessSummary = {
  processed: number;
  skippedManual: number;
  skippedBeforeJoining: number;
  byStatus: Record<string, number>;
};

type AttendanceFields = Omit<
  Prisma.AttendanceUncheckedCreateInput,
  "id" | "employeeId" | "date" | "createdAt" | "updatedAt"
>;

const atMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);
const timeToMinutes = (t: string | null) => (t ? toMinutes(t) : null);

/**
 * Turns the imported rows of one batch into daily Attendance records.
 * Safe to run again at any time (after changing rules, holidays, or re-matching).
 * Records that HR edited by hand (isManual) are never overwritten.
 */
export async function processBatch(batchId: string): Promise<ProcessSummary> {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, month: true, year: true },
  });
  if (!batch) throw new ServiceError("Import batch not found.");

  const [settings, calendar] = await Promise.all([
    getSettings(),
    getMonthCalendar(batch.year, batch.month),
  ]);
  const cfg = toRuleConfig(settings);
  const dayTypeOf = makeDayTypeResolver(calendar);
  const { start, end } = monthRange(batch.year, batch.month);

  const rows = await prisma.importedAttendanceRow.findMany({
    where: {
      importBatchId: batchId,
      employeeId: { not: null },
      attendanceDate: { not: null },
    },
    orderBy: { sourceRowNumber: "asc" },
    select: {
      employeeId: true,
      attendanceDate: true,
      sourceClockIn: true,
      sourceClockOut: true,
      sourcePunches: true,
      employee: { select: { joiningDate: true } },
    },
  });

  const employeeIds = [...new Set(rows.map((r) => r.employeeId!))];
  const [manual, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: start, lt: end },
        isManual: true,
      },
      select: { employeeId: true, date: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "APPROVED",
        startDate: { lt: end },
        endDate: { gte: start },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ]);
  const manualKeys = new Set(
    manual.map((m) => `${m.employeeId}|${toIsoDate(m.date)}`),
  );
  const onLeave = (employeeId: string, date: Date) =>
    leaves.some(
      (l) =>
        l.employeeId === employeeId && l.startDate <= date && l.endDate >= date,
    );

  const summary: ProcessSummary = {
    processed: 0,
    skippedManual: 0,
    skippedBeforeJoining: 0,
    byStatus: {},
  };
  const writes: { employeeId: string; date: Date; data: AttendanceFields }[] =
    [];

  for (const row of rows) {
    const employeeId = row.employeeId!;
    const date = row.attendanceDate!;

    if (row.employee?.joiningDate && date < row.employee.joiningDate) {
      summary.skippedBeforeJoining++;
      continue;
    }
    if (manualKeys.has(`${employeeId}|${toIsoDate(date)}`)) {
      summary.skippedManual++;
      continue;
    }

    const result = evaluateDay(
      {
        dayType: dayTypeOf(date),
        punches: collectPunches(
          row.sourcePunches,
          row.sourceClockIn,
          row.sourceClockOut,
        ),
        hintIn: timeToMinutes(row.sourceClockIn),
        hintOut: timeToMinutes(row.sourceClockOut),
      },
      cfg,
    );

    let status: AttendanceStatus = result.status;
    let remarks = result.remarks;
    if (status === "ABSENT" && onLeave(employeeId, date)) {
      status = "ON_LEAVE";
      remarks = "Approved leave";
    }

    writes.push({
      employeeId,
      date,
      data: {
        checkIn:
          result.checkIn !== null ? atMinutes(date, result.checkIn) : null,
        checkOut:
          result.checkOut !== null ? atMinutes(date, result.checkOut) : null,
        workingMinutes: result.workingMinutes,
        lateMinutes: result.lateMinutes,
        earlyLeaveMinutes: result.earlyLeaveMinutes,
        overtimeMinutes: result.overtimeMinutes,
        status,
        remarks,
        punches: result.accepted.length
          ? result.accepted.map(formatMinutes).join(" ")
          : null,
        sourceBatchId: batchId,
      },
    });
    summary.processed++;
    summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const w of writes) {
        await tx.attendance.upsert({
          where: {
            employeeId_date: { employeeId: w.employeeId, date: w.date },
          },
          update: w.data,
          create: { employeeId: w.employeeId, date: w.date, ...w.data },
        });
      }
      await tx.importBatch.update({
        where: { id: batchId },
        data: { processedAt: new Date() },
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return summary;
}

/* ---------- Daily view ---------- */

export async function getLatestAttendanceDate(): Promise<Date | null> {
  const r = await prisma.attendance.aggregate({ _max: { date: true } });
  return r._max.date;
}

export async function getDailyAttendance(date: Date, departmentId?: string) {
  const records = await prisma.attendance.findMany({
    where: { date, ...(departmentId ? { employee: { departmentId } } : {}) },
    orderBy: { employee: { name: "asc" } },
    include: {
      employee: {
        select: {
          name: true,
          employeeCode: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  const counts: Record<string, number> = {};
  for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return { records, counts };
}
