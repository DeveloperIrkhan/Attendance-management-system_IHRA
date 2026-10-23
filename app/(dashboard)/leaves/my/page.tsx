import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/attendance/dates";
import { APPROVER_LABEL } from "@/lib/leave/approval-routing";
import { listMyLeaveRequests } from "@/services/leave.service";
import LeaveStatusBadge from "@/components/LeaveStatusBadge";
import RowActionForm from "@/components/RowActionForm";
import ScrollTable from "@/components/ScrollTable";
import { decideLeaveRequestAction } from "../actions";

export default async function MyLeavesPage() {
  const user = await requirePermission(PERMISSIONS.LEAVES_REQUEST);

  if (!user.employee) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">My leaves</h1>
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Your user account is not linked to an employee record yet, so you
          cannot apply for leave. Ask an Admin to link it under Users.
        </p>
      </div>
    );
  }

  const [requests] = await Promise.all([listMyLeaveRequests(user.employee.id)]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My leaves</h1>

      <ScrollTable>
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Working days</th>
              <th className="p-3">Status</th>
              <th className="p-3">Approver</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-500">
                  You have not applied for any leave yet.
                </td>
              </tr>
            )}
            {requests.map((leave) => (
              <tr key={leave.id} className="border-t">
                <td className="p-3">{leave.leaveType.name}</td>
                <td className="p-3">{toIsoDate(leave.startDate)}</td>
                <td className="p-3">{toIsoDate(leave.endDate)}</td>
                <td className="p-3">{leave.days}</td>
                <td className="p-3">
                  <LeaveStatusBadge status={leave.status} />
                </td>
                <td className="p-3">
                  {leave.approverLevel && leave.approverLevel !== "STAFF"
                    ? APPROVER_LABEL[leave.approverLevel]
                    : ""}
                  {leave.routeNote && (
                    <div className="text-xs text-zinc-500">
                      {leave.routeNote}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {leave.status === "PENDING" && (
                    <RowActionForm
                      action={decideLeaveRequestAction}
                      id={leave.id}
                      label="Cancel request"
                      fields={{ decision: "CANCELLED" }}
                      confirmMessage="Cancel this leave request?"
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
