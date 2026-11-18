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
import { recordAudit } from "@/services/audit.service";

export const createDepartmentActionAsync = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    const created = await createDepartment(parsed.data);
    await recordAudit({
      action: "department.create",
      entity: "Department",
      entityId: created.id,
      summary: `Department created: ${parsed.data.name}`,
      after: parsed.data,
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = departmentUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { id, ...data } = parsed.data;
    await updateDepartment(id, data);
    await recordAudit({
      action: "department.update",
      entity: "Department",
      entityId: id,
      summary: `Department updated: ${data.name}`,
      after: data,
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing department id." };

  try {
    await deleteDepartment(id);
    await recordAudit({
      action: "department.delete",
      entity: "Department",
      entityId: id,
      summary: `Department deleted: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const departmentId = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!departmentId) return { error: "Missing department id." };
  if (!employeeId) return { error: "Select a DD." };

  try {
    const created = await addDepartmentCharge(departmentId, employeeId);
    await recordAudit({
      action: "department.charge-add",
      entity: "DepartmentCharge",
      entityId: created.id,
      summary: `Additional charge assigned (department ${departmentId}, employee ${employeeId}).`,
      after: { departmentId, employeeId },
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  try {
    await removeDepartmentCharge(id);
    await recordAudit({
      action: "department.charge-remove",
      entity: "DepartmentCharge",
      entityId: id,
      summary: `Additional charge removed: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const employeeId = String(formData.get("employeeId") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!employeeId) return { error: "Select an employee." };
  if (level !== "CEO" && level !== "CHAIRMAN") {
    return { error: "Choose CEO or Chairman." };
  }

  try {
    const created = await addActingApprover(employeeId, level);
    await recordAudit({
      action: "department.acting-add",
      entity: "ActingApprover",
      entityId: created.id,
      summary: `Acting ${level} assigned (employee ${employeeId}).`,
      after: { employeeId, level },
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  try {
    await removeActingApprover(id);
    await recordAudit({
      action: "department.acting-remove",
      entity: "ActingApprover",
      entityId: id,
      summary: `Acting approver removed: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/departments");
  revalidatePath("/leaves/approvals");
  return { ok: true };
}
