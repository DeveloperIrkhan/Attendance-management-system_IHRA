import { z } from "zod";
import { toMinutes } from "@/lib/attendance/attendance-rules";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

/* ---------- Leave types ---------- */

const leaveTypeFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  isPaid: z.enum(["true", "false"]).transform((v) => v === "true"),
  yearlyQuotaDays: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 365),
      "Yearly quota must be a whole number between 0 and 365 (leave empty for no limit)",
    ),
};

export const leaveTypeSchema = z.object(leaveTypeFields);
export const leaveTypeUpdateSchema = z.object({
  id: z.string().min(1),
  ...leaveTypeFields,
});
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;

/* ---------- Leave requests ---------- */

export const leaveRequestSchema = z
  .object({
    // Only HR may name another employee; for everyone else the service uses their own record.
    employeeId: z.string().optional(),
    leaveTypeId: z.string().min(1, "Select a leave type"),
    startDate: z.string().regex(DATE, "Choose the first day"),
    endDate: z.string().regex(DATE, "Choose the last day"),
    reason: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (DATE.test(v.startDate) && DATE.test(v.endDate)) {
      if (v.endDate < v.startDate) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "The last day cannot be before the first day",
        });
      } else if (v.startDate.slice(0, 4) !== v.endDate.slice(0, 4)) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message:
            "A request cannot span two calendar years. Split it into two requests.",
        });
      }
    }
  });
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;


/* ---------- Short leaves ---------- */

export const shortLeaveSchema = z
  .object({
    employeeId: z.string().min(1, "Select an employee"),
    date: z.string().regex(DATE, "Choose the date"),
    startTime: z.string().regex(TIME, "Enter the start time"),
    endTime: z.string().regex(TIME, "Enter the end time"),
    reason: optionalText(300),
    approveNow: checkbox,
  })
  .superRefine((v, ctx) => {
    if (
      TIME.test(v.startTime) &&
      TIME.test(v.endTime) &&
      toMinutes(v.endTime) <= toMinutes(v.startTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
  });
export type ShortLeaveInput = z.infer<typeof shortLeaveSchema>;

/* ---------- Decisions ---------- */

export const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
});
