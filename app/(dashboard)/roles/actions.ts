"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { createRole, deleteRole, updateRole } from "@/services/role.service";
import { recordAudit } from "@/services/audit.service";
import { roleSchema, roleUpdateSchema } from "@/validations/role.validation";

// Checkboxes arrive as several "permissions" entries, which Object.fromEntries would collapse.
function readForm(formData: FormData) {
  return {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    permissions: formData.getAll("permissions").map(String),
  };
}

function refresh() {
  revalidatePath("/roles");
  revalidatePath("/users");
}

export async function createRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const parsed = roleSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const created = await createRole(parsed.data, actor);
    await recordAudit({
      action: "role.create",
      entity: "Role",
      entityId: created.id,
      summary: `Role created: ${parsed.data.name}`,
      after: parsed.data,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true, message: "Role created." };
}

export async function updateRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const parsed = roleUpdateSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { id, ...data } = parsed.data;
    await updateRole(id, data, actor);
    await recordAudit({
      action: "role.update",
      entity: "Role",
      entityId: id,
      summary: `Role updated: ${data.name}`,
      after: data,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true, message: "Role saved. It applies to everyone with this role straight away." };
}

export async function deleteRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing role id." };
  try {
    await deleteRole(id);
    await recordAudit({
      action: "role.delete",
      entity: "Role",
      entityId: id,
      summary: `Role deleted: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}
