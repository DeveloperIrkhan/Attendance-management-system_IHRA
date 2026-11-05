"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import {
  roleChangeSchema,
  userCreateSchema,
  userDetailsSchema,
} from "@/validations/user.validation";
import {
  changeUserRole,
  createUser,
  resetUserPassword,
  setUserActive,
  updateUserDetails,
} from "@/services/user.service";

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const login = await createUser(parsed.data, actor);
    revalidatePath("/users");
    return { ok: true, login };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateUserDetailsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = userDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await updateUserDetails(parsed.data, actor);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function changeUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = roleChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await changeUserRole(parsed.data.id, parsed.data.roleId, actor);
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
    await setUserActive(id, formData.get("active") === "true", actor);
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
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing user id." };
  try {
    const login = await resetUserPassword(id, actor);
    return { ok: true, login };
  } catch (e) {
    return toActionError(e);
  }
}
