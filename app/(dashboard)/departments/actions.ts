"use server";

import { ActionState, toActionError } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/services/department.service";
import {
  departmentSchema,
  departmentUpdateSchema,
} from "@/validations/department.validation";
import { revalidatePath } from "next/cache";

export const createDepartmentActionAsync = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    await createDepartment(parsed.data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  return { ok: true };
};

export async function updateDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = departmentUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { id, ...data } = parsed.data;
    await updateDepartment(id, data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  return { ok: true };
}

export async function deleteDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing department id." };

  try {
    await deleteDepartment(id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  return { ok: true };
}
