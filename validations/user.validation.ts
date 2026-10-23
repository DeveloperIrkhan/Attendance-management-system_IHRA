import { z } from "zod";
import { passwordRule } from "./auth.validation";

const base = {
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  roleId: z.string().min(1, "Select a role"),
  employeeId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
};

export const userCreateSchema = z.object({ ...base, password: passwordRule });
export const userUpdateSchema = z.object({ id: z.string().min(1), ...base });
export const resetPasswordSchema = z.object({
  id: z.string().min(1),
  password: passwordRule,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;