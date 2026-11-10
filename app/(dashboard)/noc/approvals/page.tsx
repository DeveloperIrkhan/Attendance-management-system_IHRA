import { requireUser, getApproverIdentity } from "@/lib/auth/authorization";
import { toIsoDate } from "@/lib/attendance/dates";
import { listPendingNocForApprover } from "@/services/noc.service";
import NocStatusBadge from "@/components/NocStatusBadge";
import NocDecisionForm from "@/components/NocDecisionForm";
import type { NocApproverLevel, NocStatus } from "@/lib/noc/flow";
import { decideNocAction } from "../actions";

export default async function NocApprovalsPage() {
  const user = await requireUser();
  const me = getApproverIdentity(user);

  if (!me || me.level === "STAFF") {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">NOC approvals</h1>
        <p className="text-zinc-600">
          You are not an approver. NOC requests are decided by department DDs
          and the CEO.
        </p>
      </div>
    );
  }

  const requests = await listPendingNocForApprover(user);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">NOC approvals</h1>
      <p className="text-sm text-zinc-600">
        Answer Yes or No. A DD&apos;s Yes sends the request on to the CEO; a No
        ends it. After the CEO&apos;s Yes, HR issues the NOC.
      </p>

      {requests.length === 0 && (
        <p className="rounded-md bg-white p-6 text-center text-zinc-500 shadow-md">
          No NOC request is waiting for you.
        </p>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="space-y-2 rounded-md bg-white p-4 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {r.employee.name}{" "}
                  <span className="text-sm font-normal text-zinc-500">
                    ({r.employee.employeeCode}) · {r.employee.department.name}
                    {r.employee.designation && `, ${r.employee.designation.title}`}
                  </span>
                </p>
                <p className="text-xs text-zinc-500">Applied {toIsoDate(r.createdAt)}</p>
              </div>
              <NocStatusBadge
                status={r.status as NocStatus}
                approverLevel={r.approverLevel as NocApproverLevel | null}
              />
            </div>

            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">For</dt>
                <dd>{r.category}</dd>
              </div>
              {r.addressedTo && (
                <div>
                  <dt className="text-xs text-zinc-500">Addressed to</dt>
                  <dd>{r.addressedTo}</dd>
                </div>
              )}
              {r.neededBy && (
                <div>
                  <dt className="text-xs text-zinc-500">Needed by</dt>
                  <dd>{toIsoDate(r.neededBy)}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Reason</dt>
                <dd className="whitespace-pre-wrap">{r.purpose}</dd>
              </div>
              {r.ddName && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-zinc-500">Department DD</dt>
                  <dd>
                    {r.ddName} said Yes
                    {r.ddNote && <span className="text-zinc-500"> ({r.ddNote})</span>}
                  </dd>
                </div>
              )}
            </dl>

            <NocDecisionForm action={decideNocAction} id={r.id} who={r.employee.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
