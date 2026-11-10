import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { toIsoDate } from "@/lib/attendance/dates";
import { listMyNocRequests } from "@/services/noc.service";
import NocStatusBadge from "@/components/NocStatusBadge";
import RowActionForm from "@/components/RowActionForm";
import type { NocApproverLevel, NocStatus } from "@/lib/noc/flow";
import { decideNocAction } from "../actions";

const day = (d: Date) => toIsoDate(d);

export default async function MyNocPage() {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">My NOC requests</h1>
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Your login is not linked to an employee record. Please contact HR.
        </p>
      </div>
    );
  }

  const requests = await listMyNocRequests(user.employeeId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">My NOC requests</h1>
        <Link href="/noc/request" className="green-button hoverEffect">
          Apply for NOC
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md bg-white p-2 shadow-lg">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Applied</th>
              <th className="p-3">For</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Status</th>
              <th className="p-3">Decisions</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-zinc-500">
                  You have not applied for a NOC yet.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="whitespace-nowrap p-3">{day(r.createdAt)}</td>
                <td className="p-3">
                  {r.category}
                  {r.addressedTo && (
                    <div className="text-xs text-zinc-500">To: {r.addressedTo}</div>
                  )}
                  {r.neededBy && (
                    <div className="text-xs text-zinc-500">Needed by {day(r.neededBy)}</div>
                  )}
                </td>
                <td className="max-w-xs whitespace-normal p-3">{r.purpose}</td>
                <td className="p-3">
                  <NocStatusBadge
                    status={r.status as NocStatus}
                    approverLevel={r.approverLevel as NocApproverLevel | null}
                  />
                </td>
                <td className="p-3 text-xs text-zinc-600">
                  {r.ddName && (
                    <div>
                      DD: {r.ddName}
                      {r.ddNote && <span className="text-zinc-500"> ({r.ddNote})</span>}
                    </div>
                  )}
                  {r.finalName && (
                    <div>
                      {r.status === "REJECTED" && r.rejectedStage === "FINAL"
                        ? "CEO said No: "
                        : "CEO: "}
                      {r.finalName}
                      {r.finalNote && <span className="text-zinc-500"> ({r.finalNote})</span>}
                    </div>
                  )}
                  {r.status === "REJECTED" && r.rejectedStage === "DD" && r.ddName && (
                    <div className="text-red-700">The DD said No.</div>
                  )}
                  {r.issuedName && <div>Issued by {r.issuedName}</div>}
                </td>
                <td className="p-3">
                  {r.status === "ISSUED" && r.document && (
                    <a
                      href={`/api/noc/${r.id}/document`}
                      className="inline-block rounded border border-green-800 px-3 py-1 text-xs text-green-800 hover:bg-green-800 hover:text-white"
                    >
                      Download NOC
                    </a>
                  )}
                  {(r.status === "PENDING_DD" || r.status === "PENDING_FINAL") && (
                    <RowActionForm
                      action={decideNocAction}
                      id={r.id}
                      label="Cancel request"
                      fields={{ decision: "CANCEL" }}
                      confirmMessage="Cancel this NOC request?"
                      danger
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
