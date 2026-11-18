// import { revalidatePath } from 'next/cache';
// import { ActionState, toActionError } from "@/lib/action-state";
// import { requirePermission } from "@/lib/auth/authorization";
// import { PERMISSIONS } from "@/lib/auth/permissions";
// import { processBatch } from "@/services/attendance.service";

// export async function processBatchAction(
//   _prev: ActionState,
//   formData: FormData,
// ): Promise<ActionState> {
//   await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT);
//   const id = String(formData.get("id") ?? "");
//   if (!id) return { error: "Missing batch id." };

//   try {
//     await processBatch(id);
//   } catch (e) {
//     return toActionError(e);
//   }
//   revalidatePath(`/attendance/imports/${id}`);
//   revalidatePath("/attendance/imports");
//   revalidatePath("/attendance/daily");
//   return { ok: true };
// }


"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { processBatch } from "@/services/attendance.service";
import { rematchBatch } from "@/lib/attendance/import-service";
import { recordAudit } from "@/services/audit.service";

function refresh(id: string) {
  revalidatePath(`/attendance/imports/${id}`);
  revalidatePath("/attendance/imports");
  revalidatePath("/attendance/daily");
}

export async function rematchBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing batch id." };

  try {
    await rematchBatch(id); // also re-processes attendance
    await recordAudit({
      action: "attendance.import",
      entity: "AttendanceImportBatch",
      entityId: id,
      summary: `Attendance batch rematched: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  refresh(id);
  return { ok: true };
}

export async function processBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing batch id." };

  try {
    await processBatch(id);
    await recordAudit({
      action: "attendance.import",
      entity: "AttendanceImportBatch",
      entityId: id,
      summary: `Attendance batch processed: ${id}`,
      actor: { id: actor.id, name: actor.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  refresh(id);
  return { ok: true };
}