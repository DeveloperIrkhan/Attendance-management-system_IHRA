export const PERMISSIONS = {
  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",
  EMPLOYEES_VIEW: "employees:view",
  EMPLOYEES_MANAGE: "employees:manage",
  DEPARTMENTS_MANAGE: "departments:manage",
  ATTENDANCE_IMPORT: "attendance:import",
  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_VIEW_OWN: "attendance:view-own",
  ATTENDANCE_SETTINGS: "attendance:settings",
  ATTENDANCE_EDIT: "attendance:edit",
  LEAVES_MANAGE: "leaves:manage", // HR: file on behalf of staff, see everything, cancel
  LEAVES_REQUEST: "leaves:request", // apply for own leave
  // Approving leave is not a role permission: it follows the designation's approval level
  // (DD, CEO, Chairman), see lib/leave/approval-routing.ts.
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  BACKUP_MANAGE: "backup:manage",
  AUDIT_VIEW: "audit:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const P = PERMISSIONS;

export const SYSTEM_ROLES: {
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    name: "ADMIN",
    description: "Full system access",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "HR",
    description: "Manages employees, leaves and reports",
    permissions: [
      P.EMPLOYEES_VIEW,
      P.EMPLOYEES_MANAGE,
      P.DEPARTMENTS_MANAGE,
      P.ATTENDANCE_IMPORT,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_VIEW_OWN,
      P.ATTENDANCE_EDIT,
      P.ATTENDANCE_SETTINGS,
      P.LEAVES_MANAGE,
      P.LEAVES_REQUEST,
      P.REPORTS_VIEW,
      P.REPORTS_EXPORT,
    ],
  },
  {
    name: "IT_OFFICER",
    description: "Uploads biometric attendance sheets",
    permissions: [
      P.EMPLOYEES_VIEW,
      P.ATTENDANCE_IMPORT,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_VIEW_OWN,
      P.REPORTS_VIEW,
      P.LEAVES_REQUEST,
      P.REPORTS_EXPORT,
    ],
  },
  {
    name: "EMPLOYEE",
    description: "Views own attendance and applies for leave",
    permissions: [P.ATTENDANCE_VIEW_OWN, P.LEAVES_REQUEST],
  },
];

// Every role lands on /dashboard: managers see the organization dashboard,
// employees see their own (MyDashboard).
export function getHomePath(_permissions: string[]): string {
  void _permissions;
  return "/dashboard";
}
// export function getHomePath(permissions: string[]): string {
//   // Management users
//   if (
//     permissions.includes(P.USERS_MANAGE) ||
//     permissions.includes(P.ATTENDANCE_VIEW) ||
//     permissions.includes(P.ATTENDANCE_IMPORT)
//   ) {
//     return "/dashboard";
//   }

//   // Employees who can request leave should land here first
//   if (permissions.includes(P.LEAVES_REQUEST)) {
//     return "/leaves/my";
//   }

//   // Employees who can only view their own attendance
//   if (permissions.includes(P.ATTENDANCE_VIEW_OWN)) {
//     return "/attendance/my";
//   }

//   return "/unauthorized";
// }

// ADMIN: sees all dashboard statistics, user management, imports, settings, and reports.
// HR: sees employee management, attendance, leaves, and reports.
// IT_OFFICER: sees attendance statistics and Excel import features.
// EMPLOYEE: sees only personal attendance and personal leave information.
