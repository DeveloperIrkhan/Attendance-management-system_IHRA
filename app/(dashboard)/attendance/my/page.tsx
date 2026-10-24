import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import { clockText, monthParam } from "@/lib/attendance/dates";
import { formatMinutes } from "@/lib/attendance/duration";
import { MONTHS } from "@/lib/attendance/months";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  getMyDashboardData,
  resolveMyDate,
} from "@/services/my-dashboard.service";

type SearchParams = Promise<{
  date?: string;
  month?: string;
}>;

const card = "rounded-xl border border-slate-200 bg-white shadow-md";

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN);
  const sp = await searchParams;

  if (!user.employeeId) {
    return (
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
        Your login is not linked to an employee record. Please contact HR.
      </p>
    );
  }

  // Only this employee's own records are read (the id comes from the session).
  const date = await resolveMyDate(user.employeeId, sp.date, sp.month);
  const data = await getMyDashboardData(user.employeeId, date);
  if (!data) {
    return (
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
        No employee record was found for your login.
      </p>
    );
  }

  const { year, month, summary } = data;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const selectedIso = data.selected.iso;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-green-800">
            My attendance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every day of {MONTHS[month - 1]} {year}. Attended {summary.attended}
            , absent {summary.absent}, late {summary.lateDays}, missing punch{" "}
            {summary.missingPunch}, on leave {summary.onLeave}.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-1">
            <Link
              href={`/attendance/my?month=${monthParam(prev.y, prev.m)}`}
              aria-label="Previous month"
              className="rounded-md border p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft size={16} aria-hidden />
            </Link>
            <Link
              href={`/attendance/my?month=${monthParam(next.y, next.m)}`}
              aria-label="Next month"
              className="rounded-md border p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>

          <form method="get" className="flex items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="att-month" className="text-sm font-medium">
                Month
              </label>
              <input
                id="att-month"
                type="month"
                name="month"
                required
                defaultValue={monthParam(year, month)}
                className="block rounded border px-3 py-2 custom-input"
              />
            </div>
            <button type="submit" className="green-button hoverEffect">
              Show
            </button>
          </form>

          <form method="get" className="flex items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="att-date" className="text-sm font-medium">
                Go to a day
              </label>
              <input
                id="att-date"
                type="date"
                name="date"
                required
                defaultValue={selectedIso}
                className="block rounded border px-3 py-2 custom-input"
              />
            </div>
            <button type="submit" className="green-button hoverEffect">
              Go
            </button>
          </form>
        </div>
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Check in</th>
                <th className="px-3 py-3 font-medium">Check out</th>
                <th className="px-3 py-3 font-medium">Worked</th>
                <th className="px-3 py-3 font-medium">Late by</th>
                <th className="px-3 py-3 font-medium">Overtime</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => {
                const weekday = new Date(
                  `${d.iso}T00:00:00Z`,
                ).toLocaleDateString("en-GB", {
                  weekday: "short",
                  timeZone: "UTC",
                });
                const quiet = d.status === "WEEKEND" || d.status === "HOLIDAY";
                return (
                  <tr
                    key={d.iso}
                    className={`border-t border-slate-100 ${
                      d.iso === selectedIso ? "bg-green-50" : ""
                    } ${quiet ? "text-slate-500" : ""}`}
                  >
                    <td className="whitespace-nowrap px-5 py-3">
                      {d.day} {MONTHS[month - 1].slice(0, 3)}{" "}
                      <span className="text-xs text-slate-400">{weekday}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {clockText(d.checkIn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {clockText(d.checkOut)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {d.checkIn && d.checkOut
                        ? formatMinutes(d.workingMinutes)
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {d.lateMinutes > 0 ? formatMinutes(d.lateMinutes) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {d.overtimeMinutes > 0
                        ? formatMinutes(d.overtimeMinutes)
                        : "-"}
                    </td>
                    <td className="px-5 py-3">
                      <AttendanceStatusBadge status={d.status} />
                      {d.status === "HOLIDAY" && d.note && (
                        <span className="ml-2 text-xs">{d.note}</span>
                      )}
                      {d.status === "INCOMPLETE" && (
                        <span className="ml-2 text-xs text-purple-700">
                          Contact HR
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-slate-500">
        <Link
          href={`/dashboard?month=${monthParam(year, month)}`}
          className="font-medium text-green-700 hover:underline"
        >
          Back to my dashboard
        </Link>
      </p>
    </div>
  );
}
