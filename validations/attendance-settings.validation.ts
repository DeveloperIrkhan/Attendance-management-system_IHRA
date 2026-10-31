import { z } from "zod";
import { toMinutes } from "@/lib/attendance/attendance-rules";

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time such as 08:00");
// A time that may be left empty: empty means "rule off" and is stored as null.
const optionalTime = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  time.nullable(),
);
const minutes = (min: number, max: number, label: string) =>
  z.coerce
    .number()
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);
const weekdays = z.array(z.coerce.number().int().min(0).max(6)).max(7);

export const settingsSchema = z
  .object({
    shiftStart: time,
    shiftEnd: time,
    graceMinutes: minutes(0, 120, "Grace period"),
    halfDayAfterMinutes: minutes(1, 480, "Half-day threshold"),
    duplicatePunchMinutes: minutes(0, 120, "Repeated-punch window"),
    earliestPunch: time,
    latestPunch: time,
    overtimeMinMinutes: minutes(0, 480, "Minimum overtime"),
    offDayWorkIsOvertime: z.boolean(),
    defaultWeeklyOffDays: weekdays,
    shortLeaveMaxMinutes: minutes(15, 480, "Maximum short leave"),
    shortLeaveMonthlyLimit: minutes(0, 31, "Monthly short leave limit"),
    shortLeaveExcusesLateArrival: z.boolean(),
    earlyLeaveHalfDayBefore: optionalTime,
    earlyLeaveShortLeaveBefore: optionalTime,
  })
  .superRefine((v, ctx) => {
    const start = toMinutes(v.shiftStart);
    const end = toMinutes(v.shiftEnd);
    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["shiftEnd"],
        message: "Shift end must be after shift start",
      });
    }
    if (toMinutes(v.earliestPunch) > start) {
      ctx.addIssue({
        code: "custom",
        path: ["earliestPunch"],
        message: "Earliest punch must not be after shift start",
      });
    }
    if (toMinutes(v.latestPunch) < end) {
      ctx.addIssue({
        code: "custom",
        path: ["latestPunch"],
        message: "Latest punch must not be before shift end",
      });
    }
    const halfBefore = v.earlyLeaveHalfDayBefore
      ? toMinutes(v.earlyLeaveHalfDayBefore)
      : null;
    const shortBefore = v.earlyLeaveShortLeaveBefore
      ? toMinutes(v.earlyLeaveShortLeaveBefore)
      : null;
    if (halfBefore !== null && halfBefore <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["earlyLeaveHalfDayBefore"],
        message: "Half-day leaving time must be after shift start",
      });
    }
    if (shortBefore !== null && shortBefore > end) {
      ctx.addIssue({
        code: "custom",
        path: ["earlyLeaveShortLeaveBefore"],
        message: "Short-leave leaving time must not be after shift end",
      });
    }
    if (
      halfBefore !== null &&
      shortBefore !== null &&
      halfBefore >= shortBefore
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["earlyLeaveShortLeaveBefore"],
        message:
          "Short-leave leaving time must be later than the half-day leaving time",
      });
    }
    if (v.halfDayAfterMinutes <= v.graceMinutes) {
      ctx.addIssue({
        code: "custom",
        path: ["halfDayAfterMinutes"],
        message: "Half-day threshold must be larger than the grace period",
      });
    }
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

export function settingsFromForm(fd: FormData) {
  return {
    shiftStart: fd.get("shiftStart"),
    shiftEnd: fd.get("shiftEnd"),
    graceMinutes: fd.get("graceMinutes"),
    halfDayAfterMinutes: fd.get("halfDayAfterMinutes"),
    duplicatePunchMinutes: fd.get("duplicatePunchMinutes"),
    earliestPunch: fd.get("earliestPunch"),
    latestPunch: fd.get("latestPunch"),
    overtimeMinMinutes: fd.get("overtimeMinMinutes"),
    offDayWorkIsOvertime: fd.get("offDayWorkIsOvertime") === "on",
    defaultWeeklyOffDays: fd.getAll("weeklyOffDays"),
    shortLeaveMaxMinutes: fd.get("shortLeaveMaxMinutes"),
    shortLeaveMonthlyLimit: fd.get("shortLeaveMonthlyLimit"),
    shortLeaveExcusesLateArrival:
      fd.get("shortLeaveExcusesLateArrival") === "on",
    earlyLeaveHalfDayBefore: fd.get("earlyLeaveHalfDayBefore"),
    earlyLeaveShortLeaveBefore: fd.get("earlyLeaveShortLeaveBefore"),
  };
}

export const monthOffSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  weeklyOffDays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
});

export const monthKeySchema = monthOffSchema.pick({ year: true, month: true });

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  title: z.string().trim().min(2, "Enter a holiday name").max(100),
});
