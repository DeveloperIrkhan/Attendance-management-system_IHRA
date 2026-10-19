"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { correctionSchema } from "@/validations/attendance-correction.validation";
import { correctAttendance } from "@/services/attendance-correction.service";

export async function correctAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_EDIT);

  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await correctAttendance(parsed.data, user.id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/review");
  revalidatePath("/attendance/daily");
  revalidatePath("/attendance/monthly");
  redirect("/attendance/review"); // must stay outside try/catch
}