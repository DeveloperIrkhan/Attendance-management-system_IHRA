"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toActionError, type ActionState } from "@/lib/action-state";
import {
  holidaySchema,
  monthKeySchema,
  monthOffSchema,
} from "@/validations/attendance-settings.validation";
import {
  addHoliday,
  clearMonthlyOffDays,
  deleteHoliday,
  setMonthlyOffDays,
} from "@/services/settings.service";

export async function setMonthlyOffDaysAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);
  const parsed = monthOffSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    weeklyOffDays: formData.getAll("weeklyOffDays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await setMonthlyOffDays(parsed.data.year, parsed.data.month, parsed.data.weeklyOffDays);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/calendar");
  return { ok: true };
}

export async function resetMonthlyOffDaysAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);
  const parsed = monthKeySchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await clearMonthlyOffDays(parsed.data.year, parsed.data.month);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/calendar");
  return { ok: true };
}

export async function addHolidayAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await addHoliday(parsed.data.date, parsed.data.title);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/calendar");
  return { ok: true };
}

export async function deleteHolidayAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing holiday id." };

  try {
    await deleteHoliday(id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/attendance/calendar");
  return { ok: true };
}