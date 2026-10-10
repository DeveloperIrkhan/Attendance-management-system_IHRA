import { requireUser } from "@/lib/auth/authorization";

export default async function EmployeeDashboardPage() {
  const user = await requireUser();
  return <h1 className="text-xl font-semibold">Welcome, {user.fullName}</h1>;
}