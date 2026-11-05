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
  LEAVES_VIEW: "leaves:view", // see every leave request and balance, read only
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

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

/** Labels for the Roles screen, grouped so the checkboxes are easy to read. */
export const PERMISSION_GROUPS: {
  title: string;
  items: { key: Permission; label: string; hint?: string }[];
}[] = [
  {
    title: "People",
    items: [
      { key: "employees:view", label: "View all employees" },
      { key: "employees:manage", label: "Add and edit employees" },
      { key: "departments:manage", label: "Manage departments and designations" },
    ],
  },
  {
    title: "Attendance",
    items: [
      {
        key: "attendance:view",
        label: "View attendance of the whole organization",
        hint: "Also gives the organization-wide dashboard.",
      },
      { key: "attendance:view-own", label: "View own attendance" },
      { key: "attendance:import", label: "Import biometric Excel sheets" },
      { key: "attendance:edit", label: "Correct attendance records" },
      { key: "attendance:settings", label: "Change attendance rules and calendar" },
    ],
  },
  {
    title: "Leaves",
    items: [
      {
        key: "leaves:manage",
        label: "Manage leaves",
        hint: "File on behalf of staff, cancel, leave types, balances.",
      },
      {
        key: "leaves:view",
        label: "View all leave requests (read only)",
        hint: "Without this, a DD still sees their own department, and CEO / Chairman see everyone, by designation.",
      },
      { key: "leaves:request", label: "Apply for own leave" },
    ],
  },
  {
    title: "Reports",
    items: [
      { key: "reports:view", label: "View reports" },
      { key: "reports:export", label: "Export reports" },
    ],
  },
  {
    title: "Administration",
    items: [
      { key: "users:manage", label: "Manage users" },
      { key: "roles:manage", label: "Manage roles and permissions" },
      { key: "backup:manage", label: "Manage backups" },
      { key: "audit:view", label: "View audit log" },
    ],
  },
];

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
