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
  LEAVES_MANAGE: "leaves:manage",
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
      P.LEAVES_MANAGE,
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
      P.REPORTS_VIEW,
    ],
  },
  {
    name: "EMPLOYEE",
    description: "Views own attendance",
    permissions: [P.ATTENDANCE_VIEW_OWN],
  },
];

// Where a user go after login, based on what they can do.
// export function getHomePath(permissions: string[]): string {
//   if (permissions.includes(P.USERS_MANAGE)) return "/admin";
//   if (
//     permissions.includes(P.EMPLOYEES_VIEW) ||
//     permissions.includes(P.ATTENDANCE_IMPORT)
//   )
//     return "/hr";
//   return "/employee";
// }

export function getHomePath(permissions: string[]): string {
  if (permissions.includes(P.ATTENDANCE_VIEW)) return "/";
  return "/employee";
}
