"use server";

import { ActionState, toActionError } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  addActingApprover,
  addDepartmentCharge,
  createDepartment,
  deleteDepartment,
  removeActingApprover,
  removeDepartmentCharge,
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

/** A DD takes additional charge of this department (form field `id` is the department). */
export async function addDepartmentChargeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const departmentId = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!departmentId) return { error: "Missing department id." };
  if (!employeeId) return { error: "Select a DD." };

  try {
    await addDepartmentCharge(departmentId, employeeId);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  revalidatePath("/leaves/approvals");
  return { ok: true };
}

export async function removeDepartmentChargeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  try {
    await removeDepartmentCharge(id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  revalidatePath("/leaves/approvals");
  return { ok: true };
}

/** An employee (DD or above) acts as CEO or Chairman while that post is vacant. */
export async function addActingApproverAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const employeeId = String(formData.get("employeeId") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!employeeId) return { error: "Select an employee." };
  if (level !== "CEO" && level !== "CHAIRMAN") {
    return { error: "Choose CEO or Chairman." };
  }

  try {
    await addActingApprover(employeeId, level);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  revalidatePath("/leaves/approvals");
  return { ok: true };
}

export async function removeActingApproverAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  try {
    await removeActingApprover(id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  revalidatePath("/leaves/approvals");
  return { ok: true };
}
