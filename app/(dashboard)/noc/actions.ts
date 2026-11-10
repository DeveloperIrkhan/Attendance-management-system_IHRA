"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, toActionError } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/authorization";
import { parseIsoDate } from "@/lib/attendance/dates";
import {
  createNocRequest,
  decideNocRequest,
} from "@/services/noc.service";

const requestSchema = z.object({
  category: z.string().max(60),
  purpose: z
    .string()
    .trim()
    .min(10, "Please explain what the NOC is for (at least 10 characters)")
    .max(500, "The reason is too long (500 characters at most)"),
  addressedTo: z.string().trim().max(120, "Addressed to is too long").optional(),
  neededBy: z.string().optional(),
});

function revalidateNoc() {
  revalidatePath("/noc/my");
  revalidatePath("/noc/approvals");
  revalidatePath("/noc/issue");
}

/** An employee applies for a NOC. */
export async function createNocAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse({
    category: String(formData.get("category") ?? ""),
    purpose: String(formData.get("purpose") ?? ""),
    addressedTo: String(formData.get("addressedTo") ?? "") || undefined,
    neededBy: String(formData.get("neededBy") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const neededBy = parsed.data.neededBy ? parseIsoDate(parsed.data.neededBy) : null;
  if (parsed.data.neededBy && !neededBy) {
    return { error: "The date needed is not a valid date." };
  }

  try {
    await createNocRequest(user, {
      category: parsed.data.category,
      purpose: parsed.data.purpose,
      addressedTo: parsed.data.addressedTo || null,
      neededBy,
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidateNoc();
  return { ok: true };
}

const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["YES", "NO", "CANCEL"]),
  note: z.string().trim().max(300).optional(),
});

/** The department DD or the CEO answers Yes or No, or the applicant cancels. */
export async function decideNocAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) return { error: "Invalid request." };

  try {
    await decideNocRequest(parsed.data.id, parsed.data.decision, user, parsed.data.note);
  } catch (e) {
    return toActionError(e);
  }
  revalidateNoc();
  return { ok: true };
}
