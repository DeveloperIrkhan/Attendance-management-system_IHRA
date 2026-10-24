import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/attendance/dates";
import {
  listEmployeeOptions,
  listLeaveRequests,
  listLeaveTypes,
} from "@/services/leave.service";
import {
  createLeaveRequestAction,
  decideLeaveRequestAction,
  rerouteUnroutedAction,
} from "./actions";
import LeaveTabs from "@/components/LeaveTabs";
import LeaveStatusBadge from "@/components/LeaveStatusBadge";
import LeaveRequestForm from "@/components/LeaveRequestForm";
import RowActionForm from "@/components/RowActionForm";
import ScrollTable from "@/components/ScrollTable";
import { APPROVER_LABEL } from "@/lib/leave/approval-routing";
type SearchParams = Promise<{ status?: string }>;
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);

  const [requests, employees, types] = await Promise.all([
    listLeaveRequests(status),
    listEmployeeOptions(),
    listLeaveTypes(),
  ]);
  const activeTypes = types.filter((t) => t.isActive);
  const stuck = requests.filter(
    (r) => r.status === "PENDING" && !r.approverLevel,
  ).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Leaves</h1>
      <LeaveTabs active="/leaves" />

      {stuck > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <span>
            {stuck} pending request(s) were made before approval levels existed
            and have no approver.
          </span>
          <RowActionForm
            action={rerouteUnroutedAction}
            id="reroute"
            label="Assign approvers now"
          />
        </div>
      )}
      <LeaveTabs active="/leaves" />

      <details
        className="rounded-md shadow-md bg-white p-4"
        open={requests.length === 0}
      >
        <summary className="cursor-pointer font-medium">
          File a leave request for an employee
        </summary>
        <div className="mt-4">
          {activeTypes.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Create a leave type first, under the Leave types tab.
            </p>
          ) : (
            <LeaveRequestForm
              submitLabel="Send for approval"
              action={createLeaveRequestAction}
              employees={employees.map((e) => ({
                id: e.id,
                label: `${e.name} (${e.employeeCode})`,
              }))}
              leaveTypes={activeTypes.map((t) => ({
                id: t.id,
                label: `${t.name}${t.yearlyQuotaDays !== null ? ` (${t.yearlyQuotaDays} days/year)` : ""}`,
              }))}
            />
          )}
        </div>
      </details>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-md shadow-md bg-white p-3"
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
          className="rounded-md bg-green-800 text-white hover:bg-white
      hover:border hover:border-green-800 hover:text-green-800
      px-4 py-2 text-sm disabled:opacity-50 hoverEffect"
        >
          Filter
        </button>
      </form>

      <ScrollTable>
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-green-800 text-white text-left">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Type</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Working days</th>
              <th className="p-3">Status</th>
              <th className="p-3">Approver</th>
              <th className="p-3">Reason</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {requests.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-zinc-500">
                  No leave requests.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <span className="font-medium">{r.employee.name}</span>{" "}
                  <span className="text-xs text-zinc-500">
                    {r.employee.employeeCode}
                  </span>
                </td>
                <td className="p-3">{r.leaveType.name}</td>
                <td className="p-3">{toIsoDate(r.startDate)}</td>
                <td className="p-3">{toIsoDate(r.endDate)}</td>
                <td className="p-3">{r.days}</td>
                <td className="p-3">
                  <LeaveStatusBadge status={r.status} />
                </td>
                <td className="p-3">
                  {r.approverLevel && r.approverLevel !== "STAFF" ? (
                    APPROVER_LABEL[r.approverLevel]
                  ) : (
                    <span className="text-zinc-500">
                      Made before approval levels
                    </span>
                  )}
                  {r.routeNote && (
                    <div className="text-xs text-zinc-500">{r.routeNote}</div>
                  )}
                </td>
                <td className="max-w-xs whitespace-normal p-3 text-zinc-600">
                  {r.reason ?? ""}
                </td>
                <td className="space-x-2 p-3">
                  {(r.status === "PENDING" || r.status === "APPROVED") && (
                    <RowActionForm
                      action={decideLeaveRequestAction}
                      id={r.id}
                      label="Cancel"
                      fields={{ decision: "CANCELLED" }}
                      confirmMessage="Cancel this leave? Attendance for these days will be recalculated."
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
