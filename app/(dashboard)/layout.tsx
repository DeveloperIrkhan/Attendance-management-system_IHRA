import { getSyncHealthProps } from "@/services/sync-status.service";
import AppShell from "../../components/shell/AppShell";
import { buildNav } from "../../components/shell/nav";
import { getApproverIdentity, getDataScope, hasPermission, requireUser } from "../../lib/auth/authorization";
import { Permission, PERMISSIONS } from "../../lib/auth/permissions";
import { getShellData } from "../../services/dashboard.service";
import { countPendingForApprover } from "../../services/leave.service";
import {
  countNocAwaitingIssue,
  countPendingNocForApprover,
} from "../../services/noc.service";

async function AuthShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const can = (...p: Permission[]) => hasPermission(user, ...p);

  const level = getApproverIdentity(user)?.level ?? "STAFF";
  const isApprover = level !== "STAFF";
  const scope = getDataScope(user);
  const shell = await getShellData({
    missingPunches: can(PERMISSIONS.ATTENDANCE_EDIT),
    leaves: can(PERMISSIONS.LEAVES_MANAGE),
    // leave requests and NOC requests waiting for this person, plus NOCs HR still has to issue
    approvals:
      (isApprover ? await countPendingForApprover(user) : 0) +
      (isApprover ? await countPendingNocForApprover(user) : 0) +
      (can(PERMISSIONS.NOC_ISSUE, PERMISSIONS.LEAVES_MANAGE)
        ? await countNocAwaitingIssue()
        : 0),
    imports: can(PERMISSIONS.ATTENDANCE_IMPORT, PERMISSIONS.ATTENDANCE_VIEW),
  });

  // Only people who work with attendance see the device sync status.
  const showSync = can(
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_IMPORT,
    PERMISSIONS.ATTENDANCE_SETTINGS,
  );
  const syncHealth = showSync ? await getSyncHealthProps() : null;

  return (
    <AppShell
      user={{ fullName: user.fullName, roleName: user.role.name }}
      sections={buildNav(can, {
        isApprover,
        scope,
        hasEmployee: Boolean(user.employeeId),
      })}
      canSearchEmployees={can(PERMISSIONS.EMPLOYEES_VIEW)}
      notifications={shell.notifications}
      lastImport={shell.lastImport}
      canViewImports={can(
        PERMISSIONS.ATTENDANCE_IMPORT,
        PERMISSIONS.ATTENDANCE_VIEW,
      )}
      syncHealth={syncHealth}
    >
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <Suspense fallback={<Spinner/>}>
    <AuthShell>{children}</AuthShell>
    // </Suspense>
  );
}
