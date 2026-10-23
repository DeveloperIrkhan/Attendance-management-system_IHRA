import { hasPermission, requireUser } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/attendance/dates";

import {
  getDashboardData,
  resolveDashboardDate,
} from "@/services/dashboard.service";

import DashboardView from "@/components/dashboard/DashboardView";
import MyDashboard from "@/components/dashboard/MyDashboard";
import { getMyDashboardData } from "@/services/my-dashboard.service";

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

  const date = await resolveDashboardDate(sp.date, sp.month);

  const canViewAllAttendance = hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW);

  if (canViewAllAttendance) {
    // ADMIN, HR, IT_OFFICER: organization-wide dashboard
    const data = await getDashboardData(date);

    return (
      <DashboardView
        data={data}
        greeting="Welcome back"
        firstName={user.fullName.split(" ")[0] ?? user.fullName}
        todayIso={toIsoDate(new Date())}
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
    // EMPLOYEE: load only their own records
    if (!user.employeeId) {
      return (
        <div className="p-6">
          Your user account is not linked to an employee record. Please contact
          the administrator.
        </div>
      );
    }

    const myData = await getMyDashboardData(user.employeeId, date);
    if (!myData) {
      return (
        <div className="p-6">
          No employee record was found for your account.
        </div>
      );
    }

    return <MyDashboard data={myData} fullName={user.fullName} />;
  }

  return (
    <div className="p-6">
      You do not have permission to view this dashboard.
    </div>
  );
}
