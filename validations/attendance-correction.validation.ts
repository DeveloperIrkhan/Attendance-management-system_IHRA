import { z } from "zod";
import { toMinutes } from "@/lib/attendance/attendance-rules";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const correctionSchema = z
  .object({
    id: z.string().min(1),
    mode: z.enum(["times", "absent"]),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    reason: z
      .string()
      .trim()
      .min(5, "Enter a reason (at least 5 characters)")
      .max(300, "Reason must be at most 300 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "times") return;
    const inOk = TIME.test(v.checkIn ?? "");
    const outOk = TIME.test(v.checkOut ?? "");
    if (!inOk) {
      ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Enter the check-in time" });
    }
    if (!outOk) {
      ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Enter the check-out time" });
    }
    if (inOk && outOk && toMinutes(v.checkOut!) <= toMinutes(v.checkIn!)) {
      ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
    }
  });

export type CorrectionInput = z.infer<typeof correctionSchema>;