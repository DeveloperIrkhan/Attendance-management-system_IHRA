import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { MONTHS } from "@/lib/attendance/months";
import ImportStatusBadge from "@/components/ImportStatusBadge";
import RowActionForm from "@/components/RowActionForm";
import { getImportBatchDetail } from "@/lib/attendance/import-service";
import { rematchBatchAction } from "../../import/actions";
import { processBatchAction } from "../action";
import ScrollTable from "@/components/ScrollTable";

export default async function ImportBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; unmatched?: string }>;
}) {
  const user = await requirePermission(
    PERMISSIONS.ATTENDANCE_IMPORT,
    PERMISSIONS.ATTENDANCE_VIEW,
  );
  const { id } = await params;
  const sp = await searchParams;
  const unmatchedOnly = sp.unmatched === "1";

  const detail = await getImportBatchDetail(
    id,
    Number(sp.page) || 1,
    unmatchedOnly,
  );
  if (!detail) notFound();
  const {
    batch,
    errors,
    errorCount,
    preview,
    rowCount,
    page,
    pageCount,
    pageSize,
  } = detail;
  const canImport = hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT);

  const rowsHref = (p: number, onlyUnmatched = unmatchedOnly) => {
    const q = new URLSearchParams();
    if (p > 1) q.set("page", String(p));
    if (onlyUnmatched) q.set("unmatched", "1");
    const s = q.toString();
    return `/attendance/imports/${batch.id}${s ? `?${s}` : ""}`;
  };
  const from = rowCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + preview.length;
  return (
    <div className="space-y-6">
      <Link
        href="/attendance/imports"
        className="text-sm text-zinc-500 underline"
      >
        Back to import history
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{batch.fileName}</h1>
          <p className="text-sm text-zinc-500">
            {MONTHS[batch.month - 1]} {batch.year} · uploaded by{" "}
            {batch.uploadedBy?.fullName ?? "unknown"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ImportStatusBadge status={batch.status} />
          {canImport && batch.failedRows > 0 && (
            <RowActionForm
              action={rematchBatchAction}
              id={batch.id}
              label="Re-match employees"
            />
          )}
        </div>
        {canImport && batch.successfulRows > 0 && (
          <RowActionForm
            action={processBatchAction}
            id={batch.id}
            label={
              batch.processedAt ? "Re-process attendance with new rules" : "Process attendance"
            }
          />
        )}
      </div>

      <div className="grid max-w-xl grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded border bg-white p-3">
          <div className="text-xl font-semibold">{batch.totalRows}</div>Total
          rows
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xl font-semibold">{batch.successfulRows}</div>
          Matched
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xl font-semibold">{batch.failedRows}</div>Need
          attention
        </div>
      </div>

      {errorCount > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">
            Issues ({errorCount}
            {errorCount > errors.length
              ? `, showing first ${errors.length}`
              : ""}
            )
          </h2>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left">
                <tr>
                  <th className="p-3">Row</th>
                  <th className="p-3">Column</th>
                  <th className="p-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3">{e.rowNumber ?? "-"}</td>
                    <td className="p-3">{e.columnName ?? "-"}</td>
                    <td className="p-3">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            Extracted rows ({from} to {to} of {rowCount}
            {unmatchedOnly ? ", unmatched only" : ""})
          </h2>
          <Link
            href={rowsHref(1, !unmatchedOnly)}
            className="rounded border px-3 py-1 text-sm hover:bg-zinc-100"
          >
            {unmatchedOnly ? "Show all rows" : "Show unmatched only"}
          </Link>
        </div>

        <ScrollTable>
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-100 text-left">
              <tr>
                <th className="p-3">Row</th>
                <th className="p-3">AC-No.</th>
                <th className="p-3">Name (sheet)</th>
                <th className="p-3">Date</th>
                <th className="p-3">In</th>
                <th className="p-3">Out</th>
                <th className="p-3">Matched employee</th>
              </tr>
            </thead>
            <tbody className="whitespace-nowrap">
              {preview.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    No rows to show.
                  </td>
                </tr>
              )}
              {preview.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.sourceRowNumber}</td>
                  <td className="p-3">{r.sourceBiometricId}</td>
                  <td className="p-3">{r.sourceEmployeeName ?? "-"}</td>
                  <td className="p-3">
                    {r.attendanceDate
                      ? r.attendanceDate.toISOString().slice(0, 10)
                      : "-"}
                  </td>
                  <td className="p-3">{r.sourceClockIn ?? "-"}</td>
                  <td className="p-3">{r.sourceClockOut ?? "-"}</td>
                  <td className="p-3">
                    {r.employee ? (
                      `${r.employee.name} (${r.employee.employeeCode})`
                    ) : (
                      <span className="text-red-600">Not matched</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>

        {pageCount > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">
              Page {page} of {pageCount}
            </span>
            <div className="space-x-2">
              {page > 1 && (
                <Link
                  href={rowsHref(page - 1)}
                  className="rounded border px-3 py-1 hover:bg-zinc-100"
                >
                  Previous
                </Link>
              )}
              {page < pageCount && (
                <Link
                  href={rowsHref(page + 1)}
                  className="rounded border px-3 py-1 hover:bg-zinc-100"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
