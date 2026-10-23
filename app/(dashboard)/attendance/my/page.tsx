import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import { clockText } from "@/lib/attendance/dates";
import { requirePermission, requireUser } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveDashboardDate } from "@/services/dashboard.service";
import { getMyDashboardData } from "@/services/my-dashboard.service";
type SearchParams = Promise<{
  date?: string;
  month?: string;
}>;

export default async function MyAttendance({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN);

  const sp = await searchParams;
  const date = await resolveDashboardDate(sp.date, sp.month);
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
        Your user account is not linked to an employee record. Ask an Admin to
        link it under Users.
      </p>
    );
  }

  const data = await getMyDashboardData(user.employeeId, date);
  const shortDate = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const card = "rounded-xl border border-slate-200 bg-white shadow-md";

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="font-semibold">My recent attendance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your latest attendance records
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Check in</th>
              <th className="px-3 py-3 font-medium">Check out</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            {data?.attendance.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  No attendance records found.
                </td>
              </tr>
            ) : (
              data?.attendance.map((record) => (
                <tr key={record.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-5 py-3">
                    {shortDate(record.date)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-3">
                    {clockText(record.checkIn)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-3">
                    {clockText(record.checkOut)}
                  </td>

                  <td className="px-5 py-3">
                    <AttendanceStatusBadge status={record.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
