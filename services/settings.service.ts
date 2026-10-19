import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { DayType } from "@/lib/attendance/attendance-rules";
import { monthRange, toIsoDate, parseIsoDate } from "@/lib/attendance/dates";
import type { SettingsInput } from "@/validations/attendance-settings.validation";

export const getSettings = () => {
  return prisma.attendanceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
};

export function updateSettings(input: SettingsInput, userId: string) {
  const data = { ...input, updatedById: userId };
  return prisma.attendanceSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
}

export async function getMonthCalendar(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [settings, override, holidays] = await Promise.all([
    getSettings(),
    prisma.monthlyOffDays.findUnique({
      where: { year_month: { year, month } },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    weeklyOffDays: override
      ? override.weeklyOffDays
      : settings.defaultWeeklyOffDays,
    defaultWeeklyOffDays: settings.defaultWeeklyOffDays,
    isOverride: Boolean(override),
    holidays,
  };
}

export type MonthCalendar = Awaited<ReturnType<typeof getMonthCalendar>>;

export function makeDayTypeResolver(
  cal: Pick<MonthCalendar, "weeklyOffDays" | "holidays">,
) {
  const holidayDates = new Set(cal.holidays.map((h) => toIsoDate(h.date)));
  return (date: Date): DayType => {
    if (holidayDates.has(toIsoDate(date))) return "HOLIDAY";
    if (cal.weeklyOffDays.includes(date.getUTCDay())) return "WEEKEND";
    return "WORKING";
  };
}

export function setMonthlyOffDays(
  year: number,
  month: number,
  weeklyOffDays: number[],
) {
  return prisma.monthlyOffDays.upsert({
    where: { year_month: { year, month } },
    update: { weeklyOffDays },
    create: { year, month, weeklyOffDays },
  });
}

export async function clearMonthlyOffDays(year: number, month: number) {
  await prisma.monthlyOffDays.deleteMany({ where: { year, month } });
}

export async function addHoliday(dateText: string, title: string) {
  const date = parseIsoDate(dateText);
  if (!date) throw new ServiceError("Invalid date.");
  const exists = await prisma.holiday.findUnique({
    where: { date },
    select: { id: true },
  });
  if (exists) throw new ServiceError("A holiday is already set on this date.");
  return prisma.holiday.create({ data: { date, title } });
}

export async function deleteHoliday(id: string) {
  await prisma.holiday.delete({ where: { id } });
}
