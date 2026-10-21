import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/attendance/dates";
import {
  getDashboardData,
  resolveDashboardDate,
} from "@/services/dashboard.service";
import DashboardView from "@/components/dashboard/DashboardView";

type SearchParams = Promise<{ date?: string; month?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_VIEW);
  const sp = await searchParams;

  const date = await resolveDashboardDate(sp.date, sp.month);
  const data = await getDashboardData(date);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayIso = toIsoDate(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );

  return (
    <DashboardView
      data={data}
      greeting={greeting}
      firstName={user.fullName.split(" ")[0] ?? user.fullName}
      todayIso={todayIso}
      perms={{
        canImport: hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT),
        canManageEmployees: hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE),
        canLeaves: hasPermission(user, PERMISSIONS.LEAVES_MANAGE),
        canEditAttendance: hasPermission(user, PERMISSIONS.ATTENDANCE_EDIT),
      }}
    />
  );
}
