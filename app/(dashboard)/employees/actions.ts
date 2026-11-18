"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { employeeSchema } from "@/validations/employee.validation";
import {
  createEmployee,
  getEmployee,
  resetEmployeeLogin,
  setEmployeeActive,
  updateEmployee,
} from "@/services/employee.service";
import { recordAudit } from "@/services/audit.service";

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    // The login is created together with the employee. The one-time password is
    // returned here so HR can see it once; it is not stored anywhere in readable form.
    const { employeeId, login } = await createEmployee(parsed.data);
    await recordAudit({
      action: "employee.create",
      entity: "Employee",
      entityId: employeeId,
      summary: `Employee added: ${parsed.data.name}`,
      after: {
        ...parsed.data,
        login: { name: login.name, email: login.email },
      },
      actor: { id: actor.id, name: actor.fullName },
    });
    revalidatePath("/employees");
    return { ok: true, login };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing employee id." };

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const before = await getEmployee(id);
    await updateEmployee(id, parsed.data);
    await recordAudit({
      action: "employee.update",
      entity: "Employee",
      entityId: id,
      summary: `Employee edited: ${parsed.data.name}`,
      before,
      after: parsed.data,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/employees");
  // Return instead of redirecting: the form shows the toast, then navigates.
  return { ok: true, message: "Employee updated." };
}

export async function toggleEmployeeActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { error: "Missing employee id." };

  try {
    const before = await getEmployee(id);
    await setEmployeeActive(id, active);
    await recordAudit({
      action: active ? "employee.activate" : "employee.deactivate",
      entity: "Employee",
      entityId: id,
      summary: `Employee ${active ? "reactivated" : "deactivated"}: ${before?.name ?? id}`,
      before: { isActive: before?.isActive ?? null, userIsActive: before?.user?.isActive ?? null },
      after: { isActive: active },
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/employees");
  return { ok: true };
}

export async function resetEmployeeLoginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing employee id." };

  try {
    const login = await resetEmployeeLogin(id);
    await recordAudit({
      action: "employee.reset-login",
      entity: "Employee",
      entityId: id,
      summary: `Login reset for employee: ${login.name}`,
      after: { name: login.name, email: login.email },
      actor: { id: actor.id, name: actor.fullName },
    });
    revalidatePath(`/employees/${id}/edit`);
    return { ok: true, login };
  } catch (e) {
    return toActionError(e);
  }
}
