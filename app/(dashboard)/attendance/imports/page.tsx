import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { MONTHS } from "@/lib/attendance/months";
import ImportStatusBadge from "@/components/ImportStatusBadge";
import { listImportBatches } from "@/lib/attendance/import-service";

export default async function ImportHistoryPage() {
  await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT, PERMISSIONS.ATTENDANCE_VIEW);
  const batches = await listImportBatches();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Import history</h1>
        <Link href="/attendance/import" className="rounded bg-black px-4 py-2 text-sm text-white">
          New import
        </Link>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="p-3">File</th>
              <th className="p-3">Period</th>
              <th className="p-3">Status</th>
              <th className="p-3">Rows</th>
              <th className="p-3">Matched</th>
              <th className="p-3">Attention</th>
              <th className="p-3">Uploaded (UTC)</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-zinc-500">No imports yet.</td>
              </tr>
            )}
            {batches.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">{b.fileName}</td>
                <td className="p-3">{MONTHS[b.month - 1]} {b.year}</td>
                <td className="p-3"><ImportStatusBadge status={b.status} /></td>
                <td className="p-3">{b.totalRows}</td>
                <td className="p-3">{b.successfulRows}</td>
                <td className="p-3">{b.failedRows}</td>
                <td className="p-3">
                  {b.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  <div className="text-xs text-zinc-500">{b.uploadedBy?.fullName ?? ""}</div>
                </td>
                <td className="p-3">
                  <Link href={`/attendance/imports/${b.id}`} className="underline">Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}