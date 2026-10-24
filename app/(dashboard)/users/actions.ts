"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { roleChangeSchema } from "@/validations/user.validation";
import {
  changeUserRole,
  resetUserPassword,
  setUserActive,
} from "@/services/user.service";

export async function changeUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = roleChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await changeUserRole(parsed.data.id, parsed.data.roleId, actor.id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function toggleUserActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing user id." };
  try {
    await setUserActive(id, formData.get("active") === "true", actor.id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing user id." };
  try {
    const login = await resetUserPassword(id);
    return { ok: true, login };
  } catch (e) {
    return toActionError(e);
  }
}
