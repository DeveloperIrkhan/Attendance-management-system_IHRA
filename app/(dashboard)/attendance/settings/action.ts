"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import { settingsFromForm, settingsSchema } from "@/validations/attendance-settings.validation";
import { updateSettings } from "@/services/settings.service";
import { processDevicePunches } from "@/services/device-attendance.service";
import { officeNow } from "@/lib/attendance/office-clock";

const DAY_MS = 86_400_000;

/** How many days back to recalculate for the chosen scope (null = all device history). */
function sinceDaysFor(scope: string): number | null {
  if (scope === "all") return null;
  const { todayMs } = officeNow();
  const t = new Date(todayMs);
  const monthsBack = scope === "three_months" ? 2 : 0;
  const start = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - monthsBack, 1);
  return Math.ceil((todayMs - start) / DAY_MS);
}

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

  // Apply the new rules to the attendance that came from the device (the live data), so there
  // is no separate button to press. "none" keeps old days as they are.
  const scope = String(formData.get("applyTo") ?? "month");
  let message = "";
  if (scope !== "none") {
    try {
      const days = sinceDaysFor(scope);
      const result = await processDevicePunches(
        days === null ? {} : { sinceDays: days },
      );
      const label =
        scope === "all"
          ? "all device history"
          : scope === "three_months"
            ? "the last 3 months"
            : "this month";
      message = `Device attendance for ${label} was recalculated (${result.processed} employee-days updated).`;
    } catch (e) {
      console.error("Could not recalculate device attendance:", e);
      message =
        "The rules were saved, but recalculating the device attendance failed. The sync will still apply them to the last 2 days.";
    }
  }
  revalidatePath("/attendance/settings");
  revalidatePath("/dashboard");
  return { ok: true, message };
}