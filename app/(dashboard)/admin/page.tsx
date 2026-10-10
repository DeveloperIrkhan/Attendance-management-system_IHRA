import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default async function AdminDashboardPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  return <h1 className="text-xl font-semibold">Admin Dashboard</h1>;
}