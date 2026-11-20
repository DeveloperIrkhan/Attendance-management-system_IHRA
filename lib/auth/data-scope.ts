// Whose attendance and leave data a person may see. Follows the designation, not the role:
//
//   Admin / HR / IT Officer (permission attendance:view)  -> ALL
//   CEO, Chairman                                        -> ALL
//   DD (head of department)                              -> DEPARTMENT (their own, plus any additional charge)
//   everyone else                                        -> SELF (only their own data)
//
import { PERMISSIONS } from "./permissions";
import type { ApprovalLevel } from "@/lib/leave/approval-routing";

export type DataScope =
  | { kind: "ALL" }
  // departmentId is the DD's own department
  // departmentIds also has any additional charge
  | { kind: "DEPARTMENT"; departmentId: string; departmentIds: string[] }
  | { kind: "SELF"; employeeId: string | null };

export function resolveDataScope(input: {
  permissions: string[];
  level: ApprovalLevel;
  employeeId: string | null;
  departmentId: string | null;
  // departments the DD also looks after 
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

 // Whose LEAVE requests a person may look at (the Leaves pages). 
 // an IT Officer sees everyone's attendance 
 //   leaves:manage (HR) or leaves:view   -> ALL
 //   CEO, Chairman (by designation)      -> ALL
 //   DD (by designation)                 -> DEPARTMENT onlly
 //   everyone else                       -> null
export function resolveLeaveScope(input: {
  permissions: string[];
  level: ApprovalLevel;
  departmentId: string | null;
  chargeDepartmentIds?: string[];
}): DataScope | null {
  if (
    input.permissions.includes(PERMISSIONS.LEAVES_MANAGE) ||
    input.permissions.includes(PERMISSIONS.LEAVES_VIEW)
  ) {
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
  return null;
}

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
