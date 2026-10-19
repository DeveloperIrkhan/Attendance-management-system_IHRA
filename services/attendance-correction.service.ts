import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { Prisma } from "@/lib/generated/prisma/client";
import { evaluateDay, formatMinutes, toMinutes, toRuleConfig } from "@/lib/attendance/attendance-rules";
import { monthRange } from "@/lib/attendance/dates";
import type { CorrectionInput } from "@/validations/attendance-correction.validation";
import { getMonthCalendar, getSettings, makeDayTypeResolver } from "./settings.service";

const atMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

//HR enters the real times (or marks the day absent). 
// the day is then protected from re-processing.
export async function correctAttendance(input: CorrectionInput, userId: string) {
  const record = await prisma.attendance.findUnique({
    where: { id: input.id },
    select: { id: true, date: true },
  });
  if (!record) throw new ServiceError("Attendance record not found.");

  const note = `Corrected by HR: ${input.reason}`;
  let data: Prisma.AttendanceUncheckedUpdateInput;

  if (input.mode === "absent") {
    data = {
      status: "ABSENT",
      checkIn: null,
      checkOut: null,
      workingMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      punches: null,
      remarks: `${note} (marked absent)`,
    };
  } else {
    const date = record.date;
    const [settings, calendar] = await Promise.all([
      getSettings(),
      getMonthCalendar(date.getUTCFullYear(), date.getUTCMonth() + 1),
    ]);
    // HR-entered times are trusted: no punch window and no duplicate filtering.
    const cfg = {
      ...toRuleConfig(settings),
      earliestPunch: 0,
      latestPunch: 1439,
      duplicatePunchMinutes: 0,
    };

    const inMin = toMinutes(input.checkIn!);
    const outMin = toMinutes(input.checkOut!);
    const result = evaluateDay(
      { dayType: makeDayTypeResolver(calendar)(date), punches: [inMin, outMin] },
      cfg,
    );

    data = {
      status: result.status,
      checkIn: result.checkIn !== null ? atMinutes(date, result.checkIn) : null,
      checkOut: result.checkOut !== null ? atMinutes(date, result.checkOut) : null,
      workingMinutes: result.workingMinutes,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      overtimeMinutes: result.overtimeMinutes,
      punches: `${formatMinutes(inMin)} ${formatMinutes(outMin)}`,
      remarks: [note, result.remarks].filter(Boolean).join("; "),
    };
  }

  return prisma.attendance.update({
    where: { id: record.id },
    data: { ...data, isManual: true, editedById: userId, editedAt: new Date(), editReason: input.reason },
  });
}

export function getAttendanceRecord(id: string) {
  return prisma.attendance.findUnique({
    where: { id },
    include: {
      employee: {
        select: { name: true, employeeCode: true, department: { select: { name: true } } },
      },
    },
  });
}

const REVIEW_LIMIT = 200;

/** Days with a single punch that HR still has to resolve. */
export async function listMissingPunches(period?: { year: number; month: number }) {
  const where: Prisma.AttendanceWhereInput = { status: "INCOMPLETE", isManual: false };
  if (period) {
    const { start, end } = monthRange(period.year, period.month);
    where.date = { gte: start, lt: end };
  }

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { employee: { name: "asc" } }],
      take: REVIEW_LIMIT,
      include: {
        employee: {
          select: { name: true, employeeCode: true, department: { select: { name: true } } },
        },
      },
    }),
    prisma.attendance.count({ where }),
  ]);
  return { items, total, limit: REVIEW_LIMIT };
}