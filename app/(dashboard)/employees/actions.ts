"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { employeeSchema } from "@/validations/employee.validation";
import {
  createEmployee,
  setEmployeeActive,
  updateEmployee,
} from "@/services/employee.service";

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await createEmployee(parsed.data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/employees");
  // must stay outside try/catch
  redirect("/employees");
}

export async function updateEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing employee id." };

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await updateEmployee(id, parsed.data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/employees");
  redirect("/employees");
}

export async function toggleEmployeeActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { error: "Missing employee id." };

  try {
    await setEmployeeActive(id, active);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/employees");
  return { ok: true };
}
