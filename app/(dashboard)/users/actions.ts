"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import {
  resetPasswordSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/validations/user.validation";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "@/services/user.service";

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createUser(parsed.data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await updateUser(parsed.data, actor.id);
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
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await resetUserPassword(parsed.data.id, parsed.data.password);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/users");
  return { ok: true };
}
