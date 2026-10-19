"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MONTHS } from "@/lib/attendance/months";
import type { ImportSummary } from "@/lib/attendance/import-types";
import ImportStatusBadge from "./ImportStatusBadge";

export default function ImportForm({
  defaultMonth,
  defaultYear,
}: {
  defaultMonth: number;
  defaultYear: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose an Excel file.");
      return;
    }

    const fd = new FormData();
    fd.set("file", file);
    fd.set("month", String(month));
    fd.set("year", String(year));

    setLoading(true);
    try {
      const res = await fetch("/api/attendance/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.batchId) {
        setResult(data as ImportSummary);
      } else {
        setError(data.error ?? "Import failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const field = "rounded border px-3 py-2";

  return (
    <div className="max-w-2xl space-y-4">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-md shadow-lg bg-white p-6"
      >
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={`${field} block`}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Year</label>
            <input
              type="number"
              value={year}
              min={2000}
              max={2100}
              onChange={(e) => setYear(Number(e.target.value))}
              className={`${field} block w-28`}
            />
          </div>
        </div>

        <div className="w-full border p-4 border-dashed border-green-800 rounded-md h-1/2">
          <label className="text-sm font-medium">
            Attendance file (.xlsx or .xls, max 10 MB)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm"
          />
        </div>

        {error && (
          <div className="rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-green-600 hover:bg-green-800 duration-300 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Importing..." : "Upload and import"}
        </button>
      </form>

      {result && (
        <div className="space-y-3 rounded border bg-white p-6">
          <div className="flex items-center gap-3">
            <h2 className="font-medium">Import result</h2>
            <ImportStatusBadge status={result.status} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded bg-zinc-50 p-3">
              <div className="text-xl font-semibold">{result.totalRows}</div>
              Total rows
            </div>
            <div className="rounded bg-green-50 p-3">
              <div className="text-xl font-semibold">
                {result.successfulRows}
              </div>
              Matched
            </div>
            <div className="rounded bg-red-50 p-3">
              <div className="text-xl font-semibold">{result.failedRows}</div>
              Need attention
            </div>
          </div>

          {result.unmatched.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 font-medium">
                Biometric IDs with no matching employee:
              </p>
              <ul className="list-disc pl-5 text-zinc-700">
                {result.unmatched.slice(0, 10).map((u) => (
                  <li key={u.biometricId}>
                    {u.biometricId}
                    {u.name ? ` (${u.name})` : ""}, {u.rows} row(s)
                  </li>
                ))}
              </ul>
              {result.unmatched.length > 10 && (
                <p className="text-zinc-500">
                  ...and {result.unmatched.length - 10} more.
                </p>
              )}
            </div>
          )}
          {result.processing && (
            <p className="text-sm text-zinc-700">
              Attendance processed for {result.processing.processed} days
              {result.processing.byStatus.INCOMPLETE
                ? `, ${result.processing.byStatus.INCOMPLETE} with a missing punch (HR review needed)`
                : ""}
              .{" "}
              <Link href="/attendance/daily" className="underline">
                View daily attendance
              </Link>
            </p>
          )}
          {result.processingError && (
            <p className="text-sm text-red-700">{result.processingError}</p>
          )}
          <Link
            href={`/attendance/imports/${result.batchId}`}
            className="inline-block text-sm underline"
          >
            View batch details
          </Link>
        </div>
      )}
    </div>
  );
}
