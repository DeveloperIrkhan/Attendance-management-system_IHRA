// NOC (No Objection Certificate) requests.
//
//   Employee  ->  Department DD  ->  CEO (acting CEO) says Yes or No  ->  HR / Admin issue the NOC
//
// Pure functions, no database, so the rules are easy to test. Who counts as "the department DD"
// or "the CEO" is worked out by the service (it already knows additional charge and acting CEO).

type Level = "STAFF" | "DD" | "CEO" | "CHAIRMAN";
const RANK: Record<Level, number> = { STAFF: 0, DD: 1, CEO: 2, CHAIRMAN: 3 };

export type NocStatus =
  | "PENDING_DD" // waiting for the department DD
  | "PENDING_FINAL" // waiting for the CEO (or the Chairman, for a CEO's own request)
  | "APPROVED" // the yes/no was Yes: HR / Admin now upload the NOC document
  | "ISSUED" // the document was uploaded
  | "REJECTED"
  | "CANCELLED";

export type NocApproverLevel = "DD" | "CEO" | "CHAIRMAN";

export const NOC_CATEGORIES = [
  "Visa / travel",
  "Higher education / admission",
  "Job in another organization",
  "Bank / loan",
  "Other",
] as const;

export function parseNocCategory(value: string | undefined | null): string {
  return NOC_CATEGORIES.find((c) => c === value) ?? "Other";
}

/**
 * Where a new request starts.
 *   staff                      -> their department DD, or the CEO if the department has none
 *   a DD                       -> the CEO
 *   the CEO                    -> the Chairman
 *   the Chairman               -> nobody above: straight to HR / Admin to issue
 */
export function startNocRoute(i: {
  requesterLevel: Level;
  hasDepartmentDd: boolean;
}): {
  status: "PENDING_DD" | "PENDING_FINAL" | "APPROVED";
  approverLevel: NocApproverLevel | null;
} {
  switch (i.requesterLevel) {
    case "CHAIRMAN":
      return { status: "APPROVED", approverLevel: null };
    case "CEO":
      return { status: "PENDING_FINAL", approverLevel: "CHAIRMAN" };
    case "DD":
      return { status: "PENDING_FINAL", approverLevel: "CEO" };
    default:
      return i.hasDepartmentDd
        ? { status: "PENDING_DD", approverLevel: "DD" }
        : { status: "PENDING_FINAL", approverLevel: "CEO" };
  }
}

export type NocDecision = "YES" | "NO" | "CANCEL";

export type NocDecisionResult =
  | {
      ok: true;
      next: {
        status: NocStatus;
        approverLevel: NocApproverLevel | null;
        /** the DD step is filled in with this decision */
        recordsDd: boolean;
        /** the CEO / final step is filled in with this decision */
        recordsFinal: boolean;
        rejectedStage: "DD" | "FINAL" | null;
      };
    }
  | { ok: false; error: string };

/**
 * What a decision does. `isDesignatedApprover` is the service's answer to "may this person decide
 * at the level the request is waiting for?" (the department DD, a DD with additional charge for
 * it, or someone higher such as the CEO or the acting CEO).
 */
export function checkNocDecision(i: {
  status: NocStatus;
  decision: NocDecision;
  isDesignatedApprover: boolean;
  isOwnRequest: boolean;
  /** the level the person decides at (an acting CEO counts as CEO) */
  deciderLevel: Level;
}): NocDecisionResult {
  const waiting = i.status === "PENDING_DD" || i.status === "PENDING_FINAL";

  if (i.decision === "CANCEL") {
    if (!waiting || !i.isOwnRequest) {
      return {
        ok: false,
        error: "Only the person who applied can cancel a request that is still waiting.",
      };
    }
    return {
      ok: true,
      next: { status: "CANCELLED", approverLevel: null, recordsDd: false, recordsFinal: false, rejectedStage: null },
    };
  }

  if (!waiting) {
    return {
      ok: false,
      error: `This request is ${i.status.toLowerCase().replace("_", " ")} and can no longer be decided.`,
    };
  }
  if (i.isOwnRequest || !i.isDesignatedApprover) {
    return { ok: false, error: "You are not the approver for this request." };
  }

  const stage: "DD" | "FINAL" = i.status === "PENDING_DD" ? "DD" : "FINAL";

  if (i.decision === "NO") {
    return {
      ok: true,
      next: {
        status: "REJECTED",
        approverLevel: null,
        recordsDd: stage === "DD",
        recordsFinal: stage === "FINAL",
        rejectedStage: stage,
      },
    };
  }

  // Yes
  if (stage === "FINAL") {
    return {
      ok: true,
      next: { status: "APPROVED", approverLevel: null, recordsDd: false, recordsFinal: true, rejectedStage: null },
    };
  }
  // The DD says yes: on to the CEO. If the CEO (or higher) said yes at the DD step, that is the
  // final yes already: the CEO is not asked twice.
  if (RANK[i.deciderLevel] >= RANK.CEO) {
    return {
      ok: true,
      next: { status: "APPROVED", approverLevel: null, recordsDd: true, recordsFinal: true, rejectedStage: null },
    };
  }
  return {
    ok: true,
    next: { status: "PENDING_FINAL", approverLevel: "CEO", recordsDd: true, recordsFinal: false, rejectedStage: null },
  };
}

/** The words shown to people for a status. */
export function nocStatusLabel(
  status: NocStatus,
  approverLevel: NocApproverLevel | null,
): string {
  switch (status) {
    case "PENDING_DD":
      return "Waiting for the department DD";
    case "PENDING_FINAL":
      return approverLevel === "CHAIRMAN"
        ? "Waiting for the Chairman"
        : "Waiting for the CEO";
    case "APPROVED":
      return "Approved: waiting for HR to issue the NOC";
    case "ISSUED":
      return "NOC issued";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
  }
}
