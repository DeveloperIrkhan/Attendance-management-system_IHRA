import { Suspense } from "react";
import {
  getApproverIdentity,
  hasPermission,
  requireUser,
} from "@/lib/auth/authorization";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import AppShell from "@/components/shell/AppShell";
import { buildNav } from "@/components/shell/nav";
import { getShellData } from "@/services/dashboard.service";
import Spinner from "@/components/Spinner";
import { countPendingForApprover } from "@/services/leave.service";

async function AuthShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const can = (...p: Permission[]) => hasPermission(user, ...p);

  const level = getApproverIdentity(user)?.level ?? "STAFF";
  const isApprover = level !== "STAFF" && can(PERMISSIONS.LEAVES_APPROVE);

  const shell = await getShellData({
    missingPunches: can(PERMISSIONS.ATTENDANCE_EDIT),
    leaves: can(PERMISSIONS.LEAVES_MANAGE),
    approvals: isApprover ? await countPendingForApprover(user) : 0,
    imports: can(PERMISSIONS.ATTENDANCE_IMPORT, PERMISSIONS.ATTENDANCE_VIEW),
  });

  return (
    <AppShell
      user={{ fullName: user.fullName, roleName: user.role.name }}
      sections={buildNav(can, { isApprover })}
      canSearchEmployees={can(PERMISSIONS.EMPLOYEES_VIEW)}
      notifications={shell.notifications}
      lastImport={shell.lastImport}
      canViewImports={can(
        PERMISSIONS.ATTENDANCE_IMPORT,
        PERMISSIONS.ATTENDANCE_VIEW,
      )}
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
