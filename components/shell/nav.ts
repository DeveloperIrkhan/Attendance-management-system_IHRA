import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import type { DataScope } from "@/lib/auth/data-scope";

export type IconKey =
  | "dashboard"
  | "employees"
  | "departments"
  | "designations"
  | "daily"
  | "monthly"
  | "missing"
  | "leaves"
  | "import"
  | "history"
  | "calendar"
  | "rules";

export type NavItem = { href: string; label: string; icon: IconKey };
export type NavSection = { title: string; items: NavItem[] };

const P = PERMISSIONS;

/** Menu structure. Items the person has no permission for are removed. */
export function buildNav(
  can: (...p: Permission[]) => boolean,
  opts: {
    isApprover?: boolean;
    /** whose data the person may see: decides which attendance views the menu offers */
    scope?: DataScope;
    /** the account is linked to an employee record */
    hasEmployee?: boolean;
  } = {},
): NavSection[] {
  const sees = opts.scope ? opts.scope.kind !== "SELF" : can(P.ATTENDANCE_VIEW);
  const dashboardLabel =
    opts.scope?.kind === "DEPARTMENT"
      ? "Department dashboard"
      : opts.scope?.kind === "SELF"
        ? "My dashboard"
        : "Dashboard";
  const sections: { title: string; items: (NavItem & { show: boolean })[] }[] =
    [
      {
        title: "Overview",
        items: [
          {
            href: "/dashboard",
            label: dashboardLabel,
            icon: "dashboard",
            show:
              sees ||
              can(P.ATTENDANCE_VIEW, P.ATTENDANCE_VIEW_OWN, P.LEAVES_REQUEST),
          },
          {
            // managers keep their own personal dashboard next to the department / organization one
            href: "/my-dashboard",
            label: "My dashboard",
            icon: "dashboard",
            show: sees && Boolean(opts.hasEmployee),
          },
        ],
      },
      {
        title: "People",
        items: [
          {
            href: "/employees",
            label: "Employees",
            icon: "employees",
            show: can(P.EMPLOYEES_VIEW) || opts.scope?.kind === "DEPARTMENT",
          },
          {
            href: "/departments",
            label: "Departments",
            icon: "departments",
            show: can(P.DEPARTMENTS_MANAGE),
          },
          {
            href: "/designations",
            label: "Designations",
            icon: "designations",
            show: can(P.DEPARTMENTS_MANAGE),
          },
        ],
      },
      {
        title: "Attendance",
        items: [
          {
            href: "/attendance/daily",
            label: "Daily attendance",
            icon: "daily",
            show: sees,
          },
          {
            href: "/attendance/monthly",
            label: "Monthly summary",
            icon: "monthly",
            show: sees,
          },
          {
            href: "/attendance/review",
            label: "Missing punches",
            icon: "missing",
            show: can(P.ATTENDANCE_EDIT),
          },
          {
            href: "/leaves/my",
            label: "My leaves",
            icon: "leaves",
            show: can(P.LEAVES_REQUEST),
          },
          {
            href: "/leaves/approvals",
            label: "Leave approvals",
            icon: "leaves",
            show: Boolean(opts.isApprover),
          },
          {
            href: "/leaves",
            label: "Leave management",
            icon: "leaves",
            show: can(P.LEAVES_MANAGE),
          },
          {
            href: "/attendance/my",
            label: "My Attendance",
            icon: "daily",
            show: can(P.ATTENDANCE_VIEW_OWN),
          },
          {
            href: "/leaves/request",
            label: "Request for Leave",
            icon: "daily",
            show: can(P.LEAVES_REQUEST),
          },
        ],
      },
      {
        title: "Data",
        items: [
          {
            href: "/attendance/import",
            label: "Import Excel",
            icon: "import",
            show: can(P.ATTENDANCE_IMPORT),
          },
          {
            href: "/attendance/imports",
            label: "Import history",
            icon: "history",
            show: can(P.ATTENDANCE_IMPORT, P.ATTENDANCE_VIEW),
          },
        ],
      },
      {
        title: "Setup",
        items: [
          {
            href: "/attendance/calendar",
            label: "Calendar",
            icon: "calendar",
            show: can(P.ATTENDANCE_SETTINGS),
          },
          {
            href: "/attendance/settings",
            label: "Rules",
            icon: "rules",
            show: can(P.ATTENDANCE_SETTINGS),
          },
          {
            href: "/users",
            label: "Users",
            icon: "employees",
            show: can(P.USERS_MANAGE),
          },
        ],
      },
    ];

  return sections
    .map((s) => ({
      title: s.title,
      items: s.items
        .filter((i) => i.show)
        .map(({ href, label, icon }) => ({ href, label, icon })),
    }))
    .filter((s) => s.items.length > 0);
}
