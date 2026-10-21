import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

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
export function buildNav(can: (...p: Permission[]) => boolean): NavSection[] {
  const sections: { title: string; items: (NavItem & { show: boolean })[] }[] =
    [
      {
        title: "Overview",
        items: [
          {
            href: "/dashboard",
            label: "Dashboard",
            icon: "dashboard",
            show: can(P.ATTENDANCE_VIEW),
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
            show: can(P.EMPLOYEES_VIEW),
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
            show: can(P.ATTENDANCE_VIEW),
          },
          {
            href: "/attendance/monthly",
            label: "Monthly summary",
            icon: "monthly",
            show: can(P.ATTENDANCE_VIEW),
          },
          {
            href: "/attendance/review",
            label: "Missing punches",
            icon: "missing",
            show: can(P.ATTENDANCE_EDIT),
          },
          {
            href: "/leaves",
            label: "Leave management",
            icon: "leaves",
            show: can(P.LEAVES_MANAGE),
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
