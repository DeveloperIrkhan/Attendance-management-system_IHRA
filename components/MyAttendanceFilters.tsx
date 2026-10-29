"use client";

import { PeriodKind, STATUS_FILTERS } from "@/lib/attendance/period";
import Link from "next/link";
import { useState } from "react";

type Props = {
  /** page the filter form submits to, e.g. /attendance/my */
  basePath: string;
  /** what the page is currently showing */
  kind: PeriodKind;
  month: string; // YYYY-MM
  year: number;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  status: string;
  /** hide the status picker where it makes no sense */
  showStatus?: boolean;
};

const field = "block rounded border px-3 py-2 custom-input";
const labelCls = "text-sm font-medium";

/**
 * One GET form: pick Month, Date range or Whole year, and optionally a status
 * (for example Absent). Only the inputs of the chosen mode are rendered,
 * so only those end up in the URL.
 */
export default function MyAttendanceFilters({
  basePath,
  kind,
  month,
  year,
  from,
  to,
  status,
  showStatus = true,
}: Props) {
  const [mode, setMode] = useState<PeriodKind>(kind);
  const [fromValue, setFromValue] = useState(from);

  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(thisYear - 5, year);
  const lastYear = Math.max(thisYear + 1, year);
  const years: number[] = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);

  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1">
        <label htmlFor="flt-mode" className={labelCls}>
          Filter by
        </label>
        <select
          id="flt-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as PeriodKind)}
          className={field}
        >
          <option value="month">Month</option>
          <option value="range">Date range</option>
          <option value="year">Whole year</option>
        </select>
      </div>

      {mode === "month" && (
        <div className="space-y-1">
          <label htmlFor="flt-month" className={labelCls}>
            Month
          </label>
          <input
            id="flt-month"
            type="month"
            name="month"
            required
            defaultValue={month}
            className={field}
          />
        </div>
      )}

      {mode === "range" && (
        <>
          <div className="space-y-1">
            <label htmlFor="flt-from" className={labelCls}>
              From
            </label>
            <input
              id="flt-from"
              type="date"
              name="from"
              required
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="flt-to" className={labelCls}>
              To
            </label>
            <input
              id="flt-to"
              type="date"
              name="to"
              required
              min={fromValue || undefined}
              defaultValue={to}
              className={field}
            />
          </div>
        </>
      )}

      {mode === "year" && (
        <div className="space-y-1">
          <label htmlFor="flt-year" className={labelCls}>
            Year
          </label>
          <select
            id="flt-year"
            name="year"
            defaultValue={String(year)}
            className={field}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {showStatus && (
        <div className="space-y-1">
          <label htmlFor="flt-status" className={labelCls}>
            Status
          </label>
          <select
            id="flt-status"
            name="status"
            defaultValue={status}
            className={field}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" className="green-button hoverEffect">
        Apply
      </button>
      <Link
        href={basePath}
        className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:underline"
      >
        Reset
      </Link>
    </form>
  );
}
