"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { rematchBatch } from "@/lib/attendance/import-service";

export async function rematchBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing batch id." };

  try {
    await rematchBatch(id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath(`/attendance/imports/${id}`);
  revalidatePath("/attendance/imports");
  return { ok: true };
}