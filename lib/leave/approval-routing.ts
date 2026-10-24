// Who must approve a leave request.
//
//  Requester        up to 3 working days        more than 3 working days
//  STAFF (AD, SO…)  DD of the same department   CEO
//  DD               CEO                         Chairman
//  CEO              Chairman                    Chairman
//  Chairman         (nobody: Admin records it)  (nobody: Admin records it)
//
// Parental rights: a higher level may also decide anything routed to a lower level
// (CEO over DD-level requests, Chairman over CEO-level and DD-level requests).

export type ApprovalLevel = "STAFF" | "DD" | "CEO" | "CHAIRMAN";
export type ApproverLevel = Exclude<ApprovalLevel, "STAFF">;

export const SHORT_ROUTE_MAX_DAYS = 3;

const RANK: Record<ApprovalLevel, number> = {
  STAFF: 0,
  DD: 1,
  CEO: 2,
  CHAIRMAN: 3,
};

//the ones holding parent rights over it
export function levelsAbove(level: ApprovalLevel): ApproverLevel[] {
  return (["DD", "CEO", "CHAIRMAN"] as const).filter(
    (l) => RANK[l] > RANK[level],
  );
}

export type Route = {
  /** null: no one in the chain can approve (Chairman's own leave) */
  approverLevel: ApproverLevel | null;
  /** true when only a DD of the requester's own department may decide */
  sameDepartment: boolean;
};

export function resolveApprovalRoute(
  requesterLevel: ApprovalLevel,
  workingDays: number,
): Route {
  const short = workingDays <= SHORT_ROUTE_MAX_DAYS;
  switch (requesterLevel) {
    case "STAFF":
      return short
        ? { approverLevel: "DD", sameDepartment: true }
        : { approverLevel: "CEO", sameDepartment: false };
    case "DD":
      return {
        approverLevel: short ? "CEO" : "CHAIRMAN",
        sameDepartment: false,
      };
    case "CEO":
      return { approverLevel: "CHAIRMAN", sameDepartment: false };
    case "CHAIRMAN":
      return { approverLevel: null, sameDepartment: false };
  }
}

export type ApproverIdentity = {
  employeeId: string;
  departmentId: string;
  level: ApprovalLevel;
};

export type RoutedRequest = {
  employeeId: string; // the requester
  approverLevel: ApprovalLevel | null;
  approverDepartmentId: string | null;
};

/**
 * May this person approve or reject this request?
 * - nobody decides their own request
 * - the level the request is routed to may decide (a DD only inside their own department)
 * - any higher level may decide too (parent rights)
 */
export function canDecideRequest(
  approver: ApproverIdentity | null,
  request: RoutedRequest,
): boolean {
  if (!approver) return false;
  if (approver.employeeId === request.employeeId) return false;
  if (!request.approverLevel || request.approverLevel === "STAFF") return false;
  if (approver.level === "STAFF") return false;

  if (RANK[approver.level] > RANK[request.approverLevel]) return true;
  if (approver.level !== request.approverLevel) return false;

  if (request.approverLevel === "DD") {
    return (
      request.approverDepartmentId !== null &&
      approver.departmentId === request.approverDepartmentId
    );
  }
  return true;
}

export const APPROVER_LABEL: Record<ApproverLevel, string> = {
  DD: "Department DD",
  CEO: "CEO",
  CHAIRMAN: "Chairman",
};
