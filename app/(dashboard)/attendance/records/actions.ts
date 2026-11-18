"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { correctionSchema } from "@/validations/attendance-correction.validation";
import {
  correctAttendance,
  getAttendanceRecord,
} from "@/services/attendance-correction.service";
import { recordAudit } from "@/services/audit.service";

export async function correctAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_EDIT);

  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const before = await getAttendanceRecord(parsed.data.id);
    const after = await correctAttendance(parsed.data, user.id);
    const person = before?.employee?.name ? ` for ${before.employee.name}` : "";
    await recordAudit({
      action: "attendance.correct",
      entity: "Attendance",
      entityId: parsed.data.id,
      summary: `Attendance corrected${person}: ${parsed.data.reason}`,
      before,
      after,
      actor: { id: user.id, name: user.fullName },
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/review");
  revalidatePath("/attendance/daily");
  revalidatePath("/attendance/monthly");
  // Return instead of redirecting: the form shows the success toast, then navigates.
  return { ok: true, message: "Attendance corrected." };
}