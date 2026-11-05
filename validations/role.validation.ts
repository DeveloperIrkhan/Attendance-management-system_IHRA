import { z } from "zod";
import { isPermission, type Permission } from "@/lib/auth/permissions";

export const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters")
    .max(40, "Role name must be at most 40 characters")
    .regex(/^[A-Za-z0-9 _-]+$/, "Use letters, numbers, spaces, - and _ only")
    .transform((v) => v.replace(/\s+/g, " ")),
  description: z
    .string()
    .trim()
    .max(200, "Description must be at most 200 characters")
    .optional()
    .transform((v) => (v ? v : null)),
  permissions: z
    .array(z.string())
    .refine((list) => list.every(isPermission), "Unknown permission selected")
    .transform((list) => [...new Set(list)] as Permission[]),
});

export type RoleInput = z.infer<typeof roleSchema>;

export const roleUpdateSchema = roleSchema.extend({
  id: z.string().min(1),
});
