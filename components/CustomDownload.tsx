"use client";

import { useState } from "react";

type Props = {
  /** the report's own query string (type, month, department, employees ...), without format */
  baseQuery: string;
  /** the report's column headings, in order */
  columns: string[];
  /** remembers the last choice for this kind of report in this browser */
  storageKey: string;
};

type Format = "pdf" | "csv";

/** The headings ticked last time on this browser, or everything when there is nothing saved. */
function loadSelection(storageKey: string, columns: string[]): boolean[] {
  const all = columns.map(() => true);
  if (typeof window === "undefined") return all;
  try {
    const saved: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null",
    );
    if (!Array.isArray(saved)) return all;
    const next = columns.map((c) => saved.includes(c));
    return next.some(Boolean) ? next : all;
  } catch {
    return all;
  }
}

/**
 * "Customized download": opens a small panel to tick the columns wanted, pick PDF or CSV, and
 * download only those columns. The report itself and its filters are not changed.
 */
export default function CustomDownload({ baseQuery, columns, storageKey }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<boolean[]>(() =>
    loadSelection(storageKey, columns),
  );
  const [format, setFormat] = useState<Format>("pdf");

  const count = selected.filter(Boolean).length;

  const toggle = (i: number) =>
    setSelected((prev) => prev.map((on, j) => (j === i ? !on : on)));

  const download = () => {
    if (count === 0) return;
    const query = new URLSearchParams(baseQuery);
    query.set("format", format);
    // every column ticked = the normal download
    if (count < columns.length) {
      query.set(
        "columns",
        selected.flatMap((on, i) => (on ? [i] : [])).join(","),
      );
    }
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(columns.filter((_, i) => selected[i])),
      );
    } catch {
      // saving the choice is a convenience only
    }
    window.location.assign(`/api/reports?${query.toString()}`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-lg border border-green-800 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50"
      >
        Customized download
      </button>

      {open && (
        <div
          role="group"
          aria-label="Customized download"
          className="absolute right-0 top-full z-30 mt-2 w-80 space-y-3 rounded-lg border border-zinc-300 bg-white p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Columns to download</p>
            <div className="space-x-3 text-xs">
              <button
                type="button"
                onClick={() => setSelected(columns.map(() => true))}
                className="text-green-800 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelected(columns.map(() => false))}
                className="text-zinc-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="max-h-64 space-y-1 overflow-auto rounded border border-zinc-200 p-2 text-sm">
            {columns.map((label, i) => (
              <li key={`${i}-${label}`}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-green-50">
                  <input
                    type="checkbox"
                    checked={selected[i] ?? false}
                    onChange={() => toggle(i)}
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>

          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="sr-only">File type</legend>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="custom-format"
                checked={format === "pdf"}
                onChange={() => setFormat("pdf")}
              />
              PDF
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="custom-format"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
              />
              CSV (Excel)
            </label>
          </fieldset>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {count} of {columns.length} columns
            </span>
            <button
              type="button"
              onClick={download}
              disabled={count === 0}
              className="green-button hoverEffect disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
