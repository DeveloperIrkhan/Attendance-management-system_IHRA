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
import { recordAudit } from "@/services/audit.service";

export async function createDesignationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = designationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const created = await createDesignation(parsed.data);
    await recordAudit({
      action: "designation.create",
      entity: "Designation",
      entityId: created.id,
      summary: `Designation created: ${parsed.data.title}`,
      after: parsed.data,
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const parsed = designationUpdateSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { id, ...data } = parsed.data;
    await updateDesignation(id, data);
    await recordAudit({
      action: "designation.update",
      entity: "Designation",
      entityId: id,
      summary: `Designation updated: ${data.title}`,
      after: data,
      actor: { id: actor.id, name: actor.fullName },
    });
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
  const actor = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing designation id." };

  try {
    await deleteDesignation(id);
    await recordAudit({
      action: "designation.delete",
      entity: "Designation",
      entityId: id,
      summary: `Designation deleted: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/designations");
  return { ok: true };
}
