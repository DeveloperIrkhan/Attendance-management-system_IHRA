export type ApprovalLevel = "STAFF" | "DD" | "CEO" | "CHAIRMAN";
export type ApproverLevel = Exclude<ApprovalLevel, "STAFF">;

export const SHORT_ROUTE_MAX_DAYS = 3;

export type Route = {
  approverLevel: ApproverLevel | null;
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

/** May this person approve or reject this request? Nobody decides their own. */
export function canDecideRequest(
  approver: ApproverIdentity | null,
  request: RoutedRequest,
): boolean {
  if (!approver) return false;
  if (approver.employeeId === request.employeeId) return false;
  if (!request.approverLevel || request.approverLevel === "STAFF") return false;
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
