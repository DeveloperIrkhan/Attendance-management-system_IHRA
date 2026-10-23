import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  description: optionalText(500),
});

export const departmentUpdateSchema = departmentSchema.extend({
  id: z.string().min(1),
});

export const designationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(100),
  approvalLevel: z.enum(["STAFF", "DD", "CEO", "CHAIRMAN"]).default("STAFF"),
});
export const designationUpdateSchema = designationSchema.extend({
  id: z.string().min(1),
});
