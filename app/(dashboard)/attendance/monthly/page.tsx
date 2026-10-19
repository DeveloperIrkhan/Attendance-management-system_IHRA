import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMinutes } from "@/lib/attendance/attendance-rules";
import { MONTHS } from "@/lib/attendance/months";
import { monthParam, parseMonthParam } from "@/lib/attendance/dates";
import { getLatestAttendanceDate } from "@/services/attendance.service";
import { getMonthlySummary } from "@/services/monthly-summary.service";
import { listDepartments } from "@/services/department.service";
import ScrollTable from "@/components/ScrollTable";

type SearchParams = Promise<{ month?: string; department?: string }>;

const hours = (minutes: number) => (minutes ? formatMinutes(minutes) : "-");
const num = (n: number) => (n ? String(n) : "-");

export default async function MonthlySummaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_VIEW);
  const sp = await searchParams;

  let period = parseMonthParam(sp.month);
  if (!period) {
    const latest = await getLatestAttendanceDate();
    period = latest
      ? { year: latest.getUTCFullYear(), month: latest.getUTCMonth() + 1 }
      : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  }
  const { year, month } = period;

  const departmentId = sp.department || undefined;
  const [{ rows, totals }, departments] = await Promise.all([
    getMonthlySummary(year, month, departmentId),
    listDepartments(),
  ]);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const link = (y: number, m: number) => {
    const p = new URLSearchParams({ month: monthParam(y, m) });
    if (departmentId) p.set("department", departmentId);
    return `/attendance/monthly?${p.toString()}`;
  };

  const th = "p-3 text-right";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Monthly summary: {MONTHS[month - 1]} {year}
        </h1>
        <div className="space-x-2 text-sm">
          <Link
            href={link(prev.y, prev.m)}
            className="rounded-md border px-3 py-1 bg-green-800 text-white hoverEffect hover:text-green-800 hover:bg-white"
          >
            Previous month
          </Link>
          <Link
            href={link(next.y, next.m)}
            className="rounded-md border px-3 py-1 bg-green-800 text-white hoverEffect hover:text-green-800 hover:bg-white"
          >
            Next month
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-2 rounded-md shadow-lg bg-white p-3"
      >
        <input
          type="month"
          name="month"
          defaultValue={monthParam(year, month)}
          className="rounded border px-3 py-2 text-sm"
        />
        <select
          name="department"
          defaultValue={departmentId ?? ""}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border px-3 py-1 bg-green-800 text-white hoverEffect hover:text-green-800 hover:bg-white"
        >
          Show
        </button>
      </form>

      {totals.missingPunch > 0 && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {totals.missingPunch} day(s) still have a missing punch and count as
          absent until HR corrects them.{" "}
          <Link
            href={`/attendance/review?month=${monthParam(year, month)}`}
            className="underline"
          >
            Review them
          </Link>
        </div>
      )}

      <ScrollTable>
        <table className="w-full min-w-max text-sm shadow-md rounded-md p-2">
          <thead className="sticky top-0 z-10 bg-green-800 text-white text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Department</th>
              <th className={th}>Working days</th>
              <th className={th}>Present</th>
              <th className={th}>Short leave</th>
              <th className={th}>Half day</th>
              <th className={th}>Missing punch</th>
              <th className={th}>Absent</th>
              <th className={th}>On leave</th>
              <th className={th}>Late (min)</th>
              <th className={th}>Overtime</th>
              <th className={th}>Worked</th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="p-4 text-center text-zinc-500">
                  No employees found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-t">
                <td className="p-3">{r.code}</td>
                <td className="p-3 font-medium">
                  {r.name}
                  {!r.isActive && (
                    <span className="ml-2 text-xs text-zinc-500">
                      (inactive)
                    </span>
                  )}
                </td>
                <td className="p-3">{r.department}</td>
                {r.hasData ? (
                  <>
                    <td className="p-3 text-right">{r.workingDays}</td>
                    <td className="p-3 text-right">{num(r.present)}</td>
                    <td className="p-3 text-right">{num(r.shortLeave)}</td>
                    <td className="p-3 text-right">{num(r.halfDay)}</td>
                    <td className="p-3 text-right">{num(r.missingPunch)}</td>
                    <td className="p-3 text-right">{num(r.absent)}</td>
                    <td className="p-3 text-right">{num(r.onLeave)}</td>
                    <td className="p-3 text-right">{num(r.lateMinutes)}</td>
                    <td className="p-3 text-right">
                      {hours(r.overtimeMinutes)} hrs
                    </td>
                    <td className="p-3 text-right">{hours(r.workedMinutes)} hrs</td>
                  </>
                ) : (
                  <td colSpan={10} className="p-3 text-center text-zinc-400">
                    No attendance data for this month
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-green-100 font-medium">
              <tr>
                <td className="p-3" colSpan={3}>
                  Total
                </td>
                <td className="p-3 text-right">{totals.workingDays}</td>
                <td className="p-3 text-right">{totals.present}</td>
                <td className="p-3 text-right">{totals.shortLeave}</td>
                <td className="p-3 text-right">{totals.halfDay}</td>
                <td className="p-3 text-right">{totals.missingPunch}</td>
                <td className="p-3 text-right">{totals.absent}</td>
                <td className="p-3 text-right">{totals.onLeave}</td>
                <td className="p-3 text-right">{totals.lateMinutes}</td>
                <td className="p-3 text-right">
                  {hours(totals.overtimeMinutes)}
                </td>
                <td className="p-3 text-right">
                  {hours(totals.workedMinutes)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </ScrollTable>
    </div>
  );
}
