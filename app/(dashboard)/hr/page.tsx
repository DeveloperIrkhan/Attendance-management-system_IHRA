import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default async function HRDashboardPage() {
  await requirePermission(PERMISSIONS.EMPLOYEES_VIEW, PERMISSIONS.ATTENDANCE_IMPORT);
  return <h1 className="text-xl font-semibold">HR Dashboard</h1>;
}