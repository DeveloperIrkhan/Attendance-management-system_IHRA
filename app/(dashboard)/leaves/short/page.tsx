import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { clockText, toIsoDate } from "@/lib/attendance/dates";
import { listEmployeeOptions } from "@/services/leave.service";
import { listShortLeaves } from "@/services/short-leave.service";
import { getSettings } from "@/services/settings.service";
import LeaveTabs from "@/components/LeaveTabs";
import LeaveStatusBadge from "@/components/LeaveStatusBadge";
import ShortLeaveForm from "@/components/ShortLeaveForm";
import RowActionForm from "@/components/RowActionForm";
import ScrollTable from "@/components/ScrollTable";
import { createShortLeaveAction, decideShortLeaveAction } from "../actions";

type SearchParams = Promise<{ status?: string }>;
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export default async function ShortLeavesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);

  const [items, employees, settings] = await Promise.all([
    listShortLeaves(status),
    listEmployeeOptions(),
    getSettings(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Short leaves</h1>
      <LeaveTabs active="/leaves/short" />
      <p className="max-w-3xl text-sm text-zinc-600">
        Up to {settings.shortLeaveMaxMinutes} minutes within shift hours
        {settings.shortLeaveMonthlyLimit > 0
          ? `, at most ${settings.shortLeaveMonthlyLimit} per employee per month`
          : ", no monthly limit"}
        .{" "}
        {settings.shortLeaveExcusesLateArrival
          ? "An approved short leave that covers a late arrival makes that day Present."
          : "An approved short leave does not change the automatic Short leave status."}{" "}
        These can be changed under Rules.
      </p>

      <details
        className="shadow-lg rounded-md bg-white p-4"
        open={items.length === 0}
      >
        <summary className="cursor-pointer font-medium">
          Add a short leave
        </summary>
        <div className="mt-4">
          <ShortLeaveForm
            action={createShortLeaveAction}
            employees={employees.map((e) => ({
              id: e.id,
              label: `${e.name} (${e.employeeCode})`,
            }))}
            shiftStart={settings.shiftStart}
            shiftEnd={settings.shiftEnd}
          />
        </div>
      </details>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-md shadow-md  bg-white p-3"
      >
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="green-button"
        >
          Filter
        </button>
      </form>

      <ScrollTable>
        <table className="w-full min-w-max text-sm shadow-md">
          <thead className="sticky top-0 z-10 bg-green-800 text-white text-left">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Date</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Minutes</th>
              <th className="p-3">Status</th>
              <th className="p-3">Reason</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-zinc-500">
                  No short leaves.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <span className="font-medium">{r.employee.name}</span>{" "}
                  <span className="text-xs text-zinc-500">
                    {r.employee.employeeCode}
                  </span>
                </td>
                <td className="p-3">{toIsoDate(r.date)}</td>
                <td className="p-3">{clockText(r.startTime)}</td>
                <td className="p-3">{clockText(r.endTime)}</td>
                <td className="p-3">{r.durationMinutes}</td>
                <td className="p-3">
                  <LeaveStatusBadge status={r.status} />
                </td>
                <td className="max-w-xs whitespace-normal p-3 text-zinc-600">
                  {r.reason ?? ""}
                </td>
                <td className="space-x-2 p-3">
                  {r.status === "PENDING" && (
                    <>
                      <RowActionForm
                        action={decideShortLeaveAction}
                        id={r.id}
                        label="Approve"
                        fields={{ decision: "APPROVED" }}
                      />
                      <RowActionForm
                        action={decideShortLeaveAction}
                        id={r.id}
                        label="Reject"
                        danger
                        fields={{ decision: "REJECTED" }}
                        confirmMessage="Reject this short leave?"
                      />
                    </>
                  )}
                  {(r.status === "PENDING" || r.status === "APPROVED") && (
                    <RowActionForm
                      action={decideShortLeaveAction}
                      id={r.id}
                      label="Cancel"
                      fields={{ decision: "CANCELLED" }}
                      confirmMessage="Cancel this short leave? Attendance for that day will be recalculated."
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
