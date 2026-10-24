import { requireUser } from "@/lib/auth/authorization";
import {
  getMyDashboardData,
  resolveMyDate,
} from "@/services/my-dashboard.service";
import MyDashboard from "@/components/dashboard/MyDashboard";

type SearchParams = Promise<{
  date?: string;
  month?: string;
}>;

// A person's own attendance, by day and by month. Available to everyone who has an
// employee record, including DD, CEO, Chairman, HR and IT Officers, whose main
// dashboard shows department or organization data instead.
export default async function MyDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  if (!user.employeeId) {
    return (
      <div className="p-6">
        Your login is not linked to an employee record, so there is no personal
        attendance to show.
      </div>
    );
  }

  // the id comes from the session, never from the URL
  const date = await resolveMyDate(user.employeeId, sp.date, sp.month);
  const data = await getMyDashboardData(user.employeeId, date);
  if (!data) {
    return (
      <div className="p-6">No employee record was found for your login.</div>
    );
  }
  return (
    <MyDashboard
      data={data}
      fullName={user.fullName}
      basePath="/my-dashboard"
    />
  );
}
