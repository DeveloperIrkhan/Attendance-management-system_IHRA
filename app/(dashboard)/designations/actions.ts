"use server";

import { ActionState, toActionError } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  createDesignation,
  deleteDesignation,
  updateDesignation,
} from "@/services/designation.service";
import {
  designationSchema,
  designationUpdateSchema,
} from "@/validations/department.validation";
import { revalidatePath } from "next/cache";

export async function createDesignationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = designationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await createDesignation(parsed.data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/designations");
  return { ok: true };
}

export async function updateDesignationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = designationUpdateSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { id, ...data } = parsed.data;
    await updateDesignation(id, data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/designations");
  return { ok: true };
}

export async function deleteDesignationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing designation id." };

  try {
    await deleteDesignation(id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/designations");
  return { ok: true };
}
