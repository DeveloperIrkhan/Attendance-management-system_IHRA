// Whose attendance and leave data a person may see. Follows the designation, not the role:
//
//   Admin / HR / IT Officer (permission attendance:view)  -> ALL
//   CEO, Chairman                                        -> ALL
//   DD (head of department)                              -> DEPARTMENT (their own)
//   everyone else                                        -> SELF (only their own data)
//
// Pure functions: no database, easy to test.
import { PERMISSIONS } from "./permissions";
import type { ApprovalLevel } from "@/lib/leave/approval-routing";

export type DataScope =
  | { kind: "ALL" }
  | { kind: "DEPARTMENT"; departmentId: string }
  | { kind: "SELF"; employeeId: string | null };

export function resolveDataScope(input: {
  permissions: string[];
  level: ApprovalLevel;
  employeeId: string | null;
  departmentId: string | null;
}): DataScope {
  if (input.permissions.includes(PERMISSIONS.ATTENDANCE_VIEW)) {
    return { kind: "ALL" };
  }
  if (input.level === "CEO" || input.level === "CHAIRMAN") {
    return { kind: "ALL" };
  }
  if (input.level === "DD" && input.departmentId) {
    return { kind: "DEPARTMENT", departmentId: input.departmentId };
  }
  return { kind: "SELF", employeeId: input.employeeId };
}

/**
 * Prisma `where` for Employee rows this scope may see.
 * `requestedDepartmentId` is the department filter chosen on a page: it narrows ALL,
 * and is ignored for DEPARTMENT (a DD can never widen their own scope with ?department=).
 */
export function employeeWhereFor(
  scope: DataScope,
  requestedDepartmentId?: string,
): { departmentId?: string; id?: string } {
  switch (scope.kind) {
    case "ALL":
      return requestedDepartmentId
        ? { departmentId: requestedDepartmentId }
        : {};
    case "DEPARTMENT":
      return { departmentId: scope.departmentId };
    case "SELF":
      // "none" matches nobody when the account is not linked to an employee
      return { id: scope.employeeId ?? "none" };
  }
}

export function scopeAllowsEmployee(
  scope: DataScope,
  employee: { id: string; departmentId: string },
): boolean {
  switch (scope.kind) {
    case "ALL":
      return true;
    case "DEPARTMENT":
      return employee.departmentId === scope.departmentId;
    case "SELF":
      return scope.employeeId === employee.id;
  }
}

/** Short text for page headers. */
export function scopeLabel(scope: DataScope, departmentName?: string): string {
  switch (scope.kind) {
    case "ALL":
      return "Whole organization";
    case "DEPARTMENT":
      return departmentName
        ? `Department: ${departmentName}`
        : "Your department";
    case "SELF":
      return "Only you";
  }
}
