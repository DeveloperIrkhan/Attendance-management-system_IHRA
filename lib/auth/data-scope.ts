// Whose attendance and leave data a person may see. Follows the designation, not the role:
//
//   Admin / HR / IT Officer (permission attendance:view)  -> ALL
//   CEO, Chairman                                        -> ALL
//   DD (head of department)                              -> DEPARTMENT (their own, plus any additional charge)
//   everyone else                                        -> SELF (only their own data)
//
// Pure functions: no database, easy to test.
import { PERMISSIONS } from "./permissions";
import type { ApprovalLevel } from "@/lib/leave/approval-routing";

export type DataScope =
  | { kind: "ALL" }
  // departmentId is the DD's own department; departmentIds also has any additional charge
  | { kind: "DEPARTMENT"; departmentId: string; departmentIds: string[] }
  | { kind: "SELF"; employeeId: string | null };

export function resolveDataScope(input: {
  permissions: string[];
  level: ApprovalLevel;
  employeeId: string | null;
  departmentId: string | null;
  /** departments the DD also looks after */
  chargeDepartmentIds?: string[];
}): DataScope {
  if (input.permissions.includes(PERMISSIONS.ATTENDANCE_VIEW)) {
    return { kind: "ALL" };
  }
  if (input.level === "CEO" || input.level === "CHAIRMAN") {
    return { kind: "ALL" };
  }
  if (input.level === "DD" && input.departmentId) {
    return {
      kind: "DEPARTMENT",
      departmentId: input.departmentId,
      departmentIds: [
        ...new Set([input.departmentId, ...(input.chargeDepartmentIds ?? [])]),
      ],
    };
  }
  return { kind: "SELF", employeeId: input.employeeId };
}

/**
 * Prisma `where` for Employee rows this scope may see.
 * `requestedDepartmentId` is the department filter chosen on a page: it narrows ALL,
 * and for a DD it only narrows within their own departments (a DD can never widen their scope with ?department=).
 */
export function employeeWhereFor(
  scope: DataScope,
  requestedDepartmentId?: string,
): { departmentId?: string | { in: string[] }; id?: string } {
  switch (scope.kind) {
    case "ALL":
      return requestedDepartmentId
        ? { departmentId: requestedDepartmentId }
        : {};
    case "DEPARTMENT":
      // A DD may narrow to one of their departments, never widen beyond them.
      if (
        requestedDepartmentId &&
        scope.departmentIds.includes(requestedDepartmentId)
      ) {
        return { departmentId: requestedDepartmentId };
      }
      return scope.departmentIds.length === 1
        ? { departmentId: scope.departmentIds[0] }
        : { departmentId: { in: scope.departmentIds } };
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
      return scope.departmentIds.includes(employee.departmentId);
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
