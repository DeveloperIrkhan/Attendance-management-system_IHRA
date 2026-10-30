import { getApproverIdentity, requireUser } from "@/lib/auth/authorization";
import { toIsoDate } from "@/lib/attendance/dates";
import { APPROVER_LABEL } from "@/lib/leave/approval-routing";
import { listPendingForApprover } from "@/services/leave.service";
import RowActionForm from "@/components/RowActionForm";
import ScrollTable from "@/components/ScrollTable";
import { decideLeaveRequestAction } from "../actions";

const SCOPE: Record<string, string> = {
  DD: "leave requests of staff in your department, and in any department you hold additional charge of (up to 3 working days)",
  CEO: "requests routed to the CEO, and requests routed to a DD (you hold parent rights over DDs)",
  CHAIRMAN:
    "requests routed to the Chairman, and requests routed to the CEO or a DD (you hold parent rights over both)",
};

export default async function LeaveApprovalsPage() {
  // Access follows the designation, not the role: DD, CEO and Chairman may open this page.
  const user = await requireUser();
  const me = getApproverIdentity(user);

  if (!me || me.level === "STAFF") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Leave approvals</h1>
        <p className="rounded bg-zinc-100 p-3 text-sm text-zinc-700">
          Your designation does not approve leave. If it should, ask HR to set
          its approval level under Designations.
        </p>
      </div>
    );
  }

  const requests = await listPendingForApprover(user);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Leave approvals</h1>
        <p className="text-sm text-zinc-600">
          Waiting for your decision: {SCOPE[me.level]}.
        </p>
      </div>

      <ScrollTable>
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Department</th>
              <th className="p-3">Type</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Working days</th>
              <th className="p-3">Routed to</th>
              <th className="p-3">Reason</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {requests.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-zinc-500">
                  Nothing is waiting for you.
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
                  {r.routeNote && (
                    <div className="text-xs text-zinc-500">{r.routeNote}</div>
                  )}
                </td>
                <td className="p-3">{r.employee.department.name}</td>
                <td className="p-3">{r.leaveType.name}</td>
                <td className="p-3">{toIsoDate(r.startDate)}</td>
                <td className="p-3">{toIsoDate(r.endDate)}</td>
                <td className="p-3">{r.days}</td>
                <td className="p-3">
                  {r.approverLevel && r.approverLevel !== "STAFF"
                    ? APPROVER_LABEL[r.approverLevel]
                    : ""}
                  {r.approverLevel !== me.level && (
                    <div className="text-xs text-zinc-500">Parent rights</div>
                  )}
                </td>
                <td className="max-w-xs whitespace-normal p-3 text-zinc-600">
                  {r.reason ?? ""}
                </td>
                <td className="space-x-2 p-3">
                  <RowActionForm
                    action={decideLeaveRequestAction}
                    id={r.id}
                    label="Approve"
                    fields={{ decision: "APPROVED" }}
                  />
                  <RowActionForm
                    action={decideLeaveRequestAction}
                    id={r.id}
                    label="Reject"
                    danger
                    fields={{ decision: "REJECTED" }}
                    confirmMessage="Reject this request?"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
