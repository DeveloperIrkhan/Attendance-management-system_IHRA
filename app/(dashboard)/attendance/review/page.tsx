import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { MONTHS } from "@/lib/attendance/months";
import { clockText, monthParam, parseMonthParam, toIsoDate } from "@/lib/attendance/dates";
import { listMissingPunches } from "@/services/attendance-correction.service";
import ScrollTable from "@/components/ScrollTable";

type SearchParams = Promise<{ month?: string }>;

export default async function MissingPunchesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission(PERMISSIONS.ATTENDANCE_EDIT);
  const sp = await searchParams;

  const period = parseMonthParam(sp.month) ?? undefined;
  const { items, total, limit } = await listMissingPunches(period);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        Missing punches
        {period && (
          <span className="text-sm font-normal text-zinc-500">
            {" "}
            {MONTHS[period.month - 1]} {period.year}
          </span>
        )}
      </h1>
      <p className="max-w-3xl text-sm text-zinc-600">
        These days have only one punch. They count as absent until corrected. Open a day, enter the
        real times (or mark the employee absent) and give a reason.
      </p>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded border bg-white p-3">
        <input
          type="month"
          name="month"
          defaultValue={period ? monthParam(period.year, period.month) : ""}
          className="rounded border px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border px-4 py-2 text-sm hover:bg-zinc-100">Filter</button>
        <Link href="/attendance/review" className="px-2 py-2 text-sm text-zinc-500 underline">All months</Link>
      </form>

      <p className="text-sm text-zinc-600">
        {total === 0
          ? "Nothing to review."
          : `${total} day(s) to review${total > limit ? `, showing the first ${limit}` : ""}.`}
      </p>

      <ScrollTable>
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-100 text-left">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Department</th>
              <th className="p-3">In</th>
              <th className="p-3">Out</th>
              <th className="p-3">Note</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-zinc-500">No missing punches.</td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{toIsoDate(r.date)}</td>
                <td className="p-3">{r.employee.employeeCode}</td>
                <td className="p-3 font-medium">{r.employee.name}</td>
                <td className="p-3">{r.employee.department.name}</td>
                <td className="p-3">{clockText(r.checkIn)}</td>
                <td className="p-3">{clockText(r.checkOut)}</td>
                <td className="max-w-xs whitespace-normal p-3 text-zinc-600">{r.remarks ?? ""}</td>
                <td className="p-3">
                  <Link href={`/attendance/records/${r.id}/edit`} className="rounded border px-2 py-1 text-xs hover:bg-zinc-100">
                    Correct
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}