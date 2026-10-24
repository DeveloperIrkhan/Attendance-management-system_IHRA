import { z } from "zod";

// Logins are created automatically 
// The Users screen only changes the role 
// (for example to HR or IT_OFFICER), 
// resets the // password, and deactivates or reactivates a login.
export const roleChangeSchema = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1, "Select a role"),
});

export type RoleChangeInput = z.infer<typeof roleChangeSchema>;