import {
  getDataScope,
  hasPermission,
  requireUser,
} from "@/lib/auth/authorization";
import { scopeLabel } from "@/lib/auth/data-scope";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/attendance/dates";
import { prisma } from "@/lib/prisma";
import {
  getDashboardData,
  resolveDashboardDate,
} from "@/services/dashboard.service";
import {
  getMyDashboardData,
  resolveMyDate,
} from "@/services/my-dashboard.service";
import DashboardView from "@/components/dashboard/DashboardView";
import MyDashboard from "@/components/dashboard/MyDashboard";

type SearchParams = Promise<{
  date?: string;
  month?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = getDataScope(user);

  if (scope.kind !== "SELF") {
    // Manager dashboard. The scope limits every number on it:
    //   HR / IT Officer / Admin / CEO / Chairman -> the whole organization
    //   DD -> their own department only
    const date = await resolveDashboardDate(sp.date, sp.month, scope);
    // import batches and the activity feed are only for people who can see attendance data
    const data = await getDashboardData(
      date,
      scope,
      hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW),
    );
    const now = new Date();
    const hour = now.getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";

    let departmentName: string | undefined;
    if (scope.kind === "DEPARTMENT") {
      const dept = await prisma.department.findUnique({
        where: { id: scope.departmentId },
        select: { name: true },
      });
      departmentName = dept?.name;
    }

    return (
      <DashboardView
        data={data}
        greeting={greeting}
        firstName={user.fullName.split(" ")[0] ?? user.fullName}
        scopeLabel={scopeLabel(scope, departmentName)}
        todayIso={toIsoDate(
          new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
        )}
        perms={{
          canImport: hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT),
          canManageEmployees: hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE),
          canLeaves: hasPermission(user, PERMISSIONS.LEAVES_MANAGE),
          canEditAttendance: hasPermission(user, PERMISSIONS.ATTENDANCE_EDIT),
        }}
      />
    );
  }

  if (hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW_OWN)) {
    // EMPLOYEE: only their own records, picked by the logged-in user's own employee id
    // (never by an id from the URL).
    if (!user.employeeId) {
      return (
        <div className="p-6">
          Your login is not linked to an employee record. Please contact HR.
        </div>
      );
    }

    const date = await resolveMyDate(user.employeeId, sp.date, sp.month);
    const myData = await getMyDashboardData(user.employeeId, date);
    if (!myData) {
      return (
        <div className="p-6">No employee record was found for your login.</div>
      );
    }
    return (
      <MyDashboard
        data={myData}
        fullName={user.fullName}
        basePath="/dashboard"
      />
    );
  }

  return (
    <div className="p-6">
      You do not have permission to view this dashboard.
    </div>
  );
}
