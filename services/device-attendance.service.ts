import { prisma } from "../lib/prisma";
import {
  evaluateDay,
  formatMinutes,
  toMinutes,
  toRuleConfig,
} from "../lib/attendance/attendance-rules";
import type { AttendanceStatus } from "../lib/generated/prisma/client";

/**
 * Rebuilds daily Attendance rows from the raw uFace800 DevicePunch log.
 * DevicePunch.punchedAt is treated as an office-clock timestamp, matching
 * this project’s existing convention of storing attendance clock times in UTC.
 * Manual attendance corrections are never overwritten.
 */
export async function processDevicePunches() {
  const settings = await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  const cfg = toRuleConfig(settings);

  const [employees, punches] = await Promise.all([
    prisma.employee.findMany({
      where: { biometricId: { not: null } },
      select: { id: true, biometricId: true, joiningDate: true, name: true },
    }),
    prisma.devicePunch.findMany({
      orderBy: [{ punchedAt: "asc" }, { deviceUserId: "asc" }],
      select: {
        deviceUserId: true,
        punchedAt: true,
      },
    }),
  ]);

  const employeeByBiometricId = new Map(
    employees
      .filter((employee) => employee.biometricId)
      .map((employee) => [employee.biometricId!, employee]),
  );

  type PunchGroup = {
    employeeId: string;
    employeeName: string;
    joiningDate: Date | null;
    dateIso: string;
    times: number[];
  };
  const groups = new Map<string, PunchGroup>();
  const unmatchedIds = new Set<string>();

  for (const punch of punches) {
    const deviceUserId = String(punch.deviceUserId).trim();
    const employee = employeeByBiometricId.get(deviceUserId);
    if (!employee) {
      unmatchedIds.add(deviceUserId);
      continue;
    }

    // The application uses UTC date/time components as office wall-clock time.
    const dateIso = punch.punchedAt.toISOString().slice(0, 10);
    const minutes = punch.punchedAt.getUTCHours() * 60 + punch.punchedAt.getUTCMinutes();
    const key = `${employee.id}|${dateIso}`;
    const group = groups.get(key) ?? {
      employeeId: employee.id,
      employeeName: employee.name,
      joiningDate: employee.joiningDate,
      dateIso,
      times: [],
    };
    group.times.push(minutes);
    groups.set(key, group);
  }

  // Load the calendar once per month represented in the punch data.
  const monthKeys = new Set(
    [...groups.values()].map((group) => group.dateIso.slice(0, 7)),
  );
  const calendarByMonth = new Map<string, { weeklyOffDays: number[]; holidays: Set<string> }>();
  for (const monthKey of monthKeys) {
    const [yearText, monthText] = monthKey.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
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
    calendarByMonth.set(monthKey, {
      weeklyOffDays: override?.weeklyOffDays ?? settings.defaultWeeklyOffDays,
      holidays: new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10))),
    });
  }

  let processed = 0;
  let skippedManual = 0;
  let skippedBeforeJoining = 0;

  for (const group of groups.values()) {
    const date = new Date(`${group.dateIso}T00:00:00.000Z`);
    if (group.joiningDate && group.dateIso < group.joiningDate.toISOString().slice(0, 10)) {
      skippedBeforeJoining++;
      continue;
    }

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: group.employeeId, date } },
      select: { id: true, isManual: true },
    });
    if (existing?.isManual) {
      skippedManual++;
      continue;
    }

    const calendar = calendarByMonth.get(group.dateIso.slice(0, 7))!;
    const dayOfWeek = date.getUTCDay();
    const dayType = calendar.holidays.has(group.dateIso)
      ? "HOLIDAY"
      : calendar.weeklyOffDays.includes(dayOfWeek)
        ? "WEEKEND"
        : "WORKING";

    const result = evaluateDay({ dayType, punches: group.times }, cfg);
    const acceptedPunches = result.accepted.map(formatMinutes).join(" ");
    const data = {
      checkIn: result.checkIn === null ? null : new Date(date.getTime() + result.checkIn * 60_000),
      checkOut: result.checkOut === null ? null : new Date(date.getTime() + result.checkOut * 60_000),
      workingMinutes: result.workingMinutes,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      overtimeMinutes: result.overtimeMinutes,
      status: result.status as AttendanceStatus,
      remarks: result.remarks ? `${result.remarks}; Source: uFace800` : "Source: uFace800",
      punches: acceptedPunches || null,
      sourceBatchId: null,
    };

    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: group.employeeId, date } },
      update: data,
      create: { employeeId: group.employeeId, date, ...data },
    });
    processed++;
  }

  const summary = {
    rawPunches: punches.length,
    matchedEmployeeDays: groups.size,
    processed,
    skippedManual,
    skippedBeforeJoining,
    unmatchedDeviceUserIds: [...unmatchedIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
  console.log("uFace800 attendance processing summary:", summary);
  if (summary.unmatchedDeviceUserIds.length) {
    console.warn(
      "These device IDs have no Employee.biometricId match. Add the exact IDs in the employee records:",
      summary.unmatchedDeviceUserIds.join(", "),
    );
  }
  return summary;
}
