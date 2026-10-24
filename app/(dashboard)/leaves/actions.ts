"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission, requireUser } from "@/lib/auth/authorization";
import { toActionError, type ActionState } from "@/lib/action-state";
import {
  decisionSchema,
  leaveRequestSchema,
  leaveTypeSchema,
  leaveTypeUpdateSchema,
  shortLeaveSchema,
} from "@/validations/leave.validation";
import {
  createLeaveRequest,
  createLeaveType,
  decideLeaveRequest,
  setLeaveTypeActive,
  updateLeaveType,
  rerouteUnroutedRequests,
} from "@/services/leave.service";
import {
  createShortLeave,
  decideShortLeave,
} from "@/services/short-leave.service";

function refresh() {
  revalidatePath("/leaves");
  revalidatePath("/leaves/short");
  revalidatePath("/leaves/types");
  revalidatePath("/leaves/balances");
  revalidatePath("/leaves/my");
  revalidatePath("/leaves/approvals");
  revalidatePath("/attendance/daily");
  revalidatePath("/attendance/monthly");
  revalidatePath("/attendance/review");
}

export async function createLeaveTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const parsed = leaveTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createLeaveType(parsed.data);
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}

export async function updateLeaveTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const parsed = leaveTypeUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { id, ...data } = parsed.data;
    await updateLeaveType(id, data);
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}

export async function toggleLeaveTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing leave type id." };
  try {
    await setLeaveTypeActive(id, formData.get("active") === "true");
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}

export async function createLeaveRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Staff apply for themselves, HR may file on behalf of someone (checked in the service).
  const user = await requirePermission(
    PERMISSIONS.LEAVES_REQUEST,
    PERMISSIONS.LEAVES_MANAGE,
  );
  const parsed = leaveRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createLeaveRequest(parsed.data, user);
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}

export async function decideLeaveRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // The service decides who may approve, reject or cancel this particular request.
  const user = await requireUser();
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  try {
    await decideLeaveRequest(parsed.data.id, parsed.data.decision, user);
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}
export async function rerouteUnroutedAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _formData;
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  try {
    const { routed, failed } = await rerouteUnroutedRequests();
    refresh();
    if (failed.length > 0) {
      return {
        error: `${routed} request(s) routed, ${failed.length} could not be: ${failed[0]}`,
      };
    }
  } catch (e) {
    return toActionError(e);
  }
  return { ok: true };
}
export async function createShortLeaveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const parsed = shortLeaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createShortLeave(parsed.data, user.id);
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}

export async function decideShortLeaveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  try {
    await decideShortLeave(parsed.data.id, parsed.data.decision, user.id);
  } catch (e) {
    return toActionError(e);
  }
  refresh();
  return { ok: true };
}
