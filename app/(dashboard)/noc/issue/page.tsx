import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { canIssueNoc } from "@/lib/auth/permissions";
import { toIsoDate } from "@/lib/attendance/dates";
import NocStatusBadge from "@/components/NocStatusBadge";
import NocUploadForm from "@/components/NocUploadForm";
import type { NocApproverLevel, NocStatus } from "@/lib/noc/flow";
import { listNocForIssuers } from "@/services/noc.service";

const FILTERS: { value: NocStatus | "ALL"; label: string }[] = [
  { value: "APPROVED", label: "Waiting for the NOC document" },
  { value: "ISSUED", label: "Issued" },
  { value: "PENDING_DD", label: "With the DD" },
  { value: "PENDING_FINAL", label: "With the CEO" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export default async function IssueNocPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  if (!canIssueNoc(user.role.permissions)) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Issue NOC</h1>
        <p className="text-zinc-600">Only HR and Admin can issue NOC documents.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.value === sp.status)?.value ?? "APPROVED";
  const requests = await listNocForIssuers(
    user,
    filter === "ALL" ? undefined : (filter as NocStatus),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Issue NOC</h1>
      <p className="text-sm text-zinc-600">
        Requests the CEO has approved are waiting here. Upload the NOC (PDF,
        Word, PNG or JPG, up to 3 MB); the employee can then download it. You
        cannot issue your own NOC.
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/noc/issue?status=${f.value}`}
            aria-current={filter === f.value ? "true" : undefined}
            className={`rounded px-3 py-1 ${
              filter === f.value ? "bg-green-800 text-white" : "bg-white hover:bg-green-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md bg-white p-2 shadow-lg">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Applied</th>
              <th className="p-3">Employee</th>
              <th className="p-3">For</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Status</th>
              <th className="p-3">Decisions</th>
              <th className="p-3">NOC document</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  No requests here.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="whitespace-nowrap p-3">{toIsoDate(r.createdAt)}</td>
                <td className="p-3">
                  <div className="font-medium">{r.employee.name}</div>
                  <div className="text-xs text-zinc-500">
                    {r.employee.employeeCode} · {r.employee.department.name}
                    {r.employee.designation && `, ${r.employee.designation.title}`}
                  </div>
                </td>
                <td className="p-3">
                  {r.category}
                  {r.addressedTo && (
                    <div className="text-xs text-zinc-500">To: {r.addressedTo}</div>
                  )}
                  {r.neededBy && (
                    <div className="text-xs text-zinc-500">Needed by {toIsoDate(r.neededBy)}</div>
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
                  {r.ddName && <div>DD: {r.ddName}</div>}
                  {r.finalName && <div>CEO: {r.finalName}</div>}
                  {r.issuedName && <div>Issued by {r.issuedName}</div>}
                </td>
                <td className="p-3">
                  {r.status === "APPROVED" && <NocUploadForm id={r.id} label="Upload NOC" />}
                  {r.status === "ISSUED" && r.document && (
                    <div className="space-y-2">
                      <a
                        href={`/api/noc/${r.id}/document`}
                        className="text-green-800 underline"
                      >
                        {r.document.fileName}
                      </a>
                      <NocUploadForm id={r.id} label="Replace file" />
                    </div>
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
