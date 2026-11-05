import { z } from "zod";

// Employee logins are created automatically with the employee.
// The Users screen also creates logins for staff who are not employees (HR, IT, Admin),
// changes a role, resets a password, and deactivates or reactivates a login.
export const roleChangeSchema = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1, "Select a role"),
});

export type RoleChangeInput = z.infer<typeof roleChangeSchema>;

// A login that is not an employee (Admin, HR or IT staff). It has no employee record,
// so it never shows up in attendance, leave balances or employee lists.
export const userCreateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  roleId: z.string().min(1, "Select a role"),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userDetailsSchema = userCreateSchema
  .pick({ fullName: true, email: true })
  .extend({ id: z.string().min(1) });

export type UserDetailsInput = z.infer<typeof userDetailsSchema>;