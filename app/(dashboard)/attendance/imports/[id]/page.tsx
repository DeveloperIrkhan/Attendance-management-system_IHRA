import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { MONTHS } from "@/lib/attendance/months";
import ImportStatusBadge from "@/components/ImportStatusBadge";
import RowActionForm from "@/components/RowActionForm";
import { getImportBatchDetail } from "@/lib/attendance/import-service";
import { rematchBatchAction } from "../../import/actions";

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT, PERMISSIONS.ATTENDANCE_VIEW);
  const { id } = await params;

  const detail = await getImportBatchDetail(id);
  if (!detail) notFound();
  const { batch, errors, errorCount, preview } = detail;
  const canImport = hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT);

  return (
    <div className="space-y-6">
      <Link href="/attendance/imports" className="text-sm text-zinc-500 underline">
        Back to import history
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{batch.fileName}</h1>
          <p className="text-sm text-zinc-500">
            {MONTHS[batch.month - 1]} {batch.year} · uploaded by {batch.uploadedBy?.fullName ?? "unknown"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ImportStatusBadge status={batch.status} />
          {canImport && batch.failedRows > 0 && (
            <RowActionForm action={rematchBatchAction} id={batch.id} label="Re-match employees" />
          )}
        </div>
      </div>

      <div className="grid max-w-xl grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded border bg-white p-3">
          <div className="text-xl font-semibold">{batch.totalRows}</div>Total rows
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xl font-semibold">{batch.successfulRows}</div>Matched
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xl font-semibold">{batch.failedRows}</div>Need attention
        </div>
      </div>

      {errorCount > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Issues ({errorCount}{errorCount > errors.length ? `, showing first ${errors.length}` : ""})</h2>
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

      <section className="space-y-2">
        <h2 className="font-medium">Extracted rows (first {preview.length})</h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
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
            <tbody>
              {preview.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.sourceRowNumber}</td>
                  <td className="p-3">{r.sourceBiometricId}</td>
                  <td className="p-3">{r.sourceEmployeeName ?? "-"}</td>
                  <td className="p-3">{r.attendanceDate ? r.attendanceDate.toISOString().slice(0, 10) : "-"}</td>
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
        </div>
      </section>
    </div>
  );
}