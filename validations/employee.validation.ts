import { z } from "zod";
import { normalizeBiometricId } from "@/lib/attendance/biometric-id";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `must be at least ${max} characters`)
    .optional()
    .transform((x) => (x ? x : null));

export const employeeSchema = z.object({
  employeeCode: z.string().trim().min(2, "must at least 2 characters").max(100),
  biometricId: z
    .string()
    .trim()
    .min(1, "Biometric ID (AC-No.) is required")
    .max(30)
    .transform(normalizeBiometricId),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100),

  email: z.string().trim().toLowerCase().email("enter a valid email address"),
  phoneNumber: optionalText(20),
  joiningDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (x) =>
        !x || (/^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x))),
      "Invalid joining date",
    ),
  departmentId: z.string().min(1, "Select a department"),
  designationId: optionalText(40),
  isActive: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;
