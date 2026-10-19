"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { settingsFromForm, settingsSchema } from "@/validations/attendance-settings.validation";
import { updateSettings } from "@/services/settings.service";

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);

  const parsed = settingsSchema.safeParse(settingsFromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await updateSettings(parsed.data, user.id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/settings");
  return { ok: true };
}