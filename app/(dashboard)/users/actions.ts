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
import { recordAudit } from "@/services/audit.service";

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const login = await createUser(parsed.data, actor);
    await recordAudit({
      action: "user.create",
      entity: "User",
      entityId: login.email,
      summary: `User created: ${parsed.data.fullName}`,
      after: {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        roleId: parsed.data.roleId,
      },
      actor: { id: actor.id, name: actor.fullName },
    });
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
    await recordAudit({
      action: "user.update",
      entity: "User",
      entityId: parsed.data.id,
      summary: `User details updated: ${parsed.data.fullName}`,
      after: { fullName: parsed.data.fullName, email: parsed.data.email },
      actor: { id: actor.id, name: actor.fullName },
    });
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
    await recordAudit({
      action: "user.change-role",
      entity: "User",
      entityId: parsed.data.id,
      summary: `User role changed to ${parsed.data.roleId}.`,
      after: { roleId: parsed.data.roleId },
      actor: { id: actor.id, name: actor.fullName },
    });
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
    const active = formData.get("active") === "true";
    await setUserActive(id, active, actor);
    await recordAudit({
      action: active ? "user.activate" : "user.deactivate",
      entity: "User",
      entityId: id,
      summary: `User ${active ? "reactivated" : "deactivated"}.`,
      after: { isActive: active },
      actor: { id: actor.id, name: actor.fullName },
    });
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
    await recordAudit({
      action: "user.reset-password",
      entity: "User",
      entityId: id,
      summary: `Password reset for user: ${login.name}`,
      after: { name: login.name, email: login.email },
      actor: { id: actor.id, name: actor.fullName },
    });
    return { ok: true, login };
  } catch (e) {
    return toActionError(e);
  }
}
