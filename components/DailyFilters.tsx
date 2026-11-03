"use client";

import Link from "next/link";
import { useState } from "react";
import { DAILY_STATUS_OPTIONS, type DailyMode } from "@/lib/attendance/daily-filters";

type Props = {
  basePath: string;
  mode: DailyMode;
  date: string; // YYYY-MM-DD
  from: string;
  to: string;
  month: string; // YYYY-MM
  department: string;
  status: string;
  q: string;
  /** departments the person may pick from; empty = fixed department shown as text */
  departments: { id: string; name: string }[];
  /** shown instead of the picker when the person sees one department only */
  fixedDepartment?: string;
  allDepartmentsLabel?: string;
};

const field = "block rounded border border-zinc-400 px-3 py-2 text-sm";
const labelCls = "text-xs font-medium text-zinc-600";

/**
 * One GET form: choose a single date, a date range or a month, plus department, status and a
 * search. Only the inputs of the chosen mode are rendered, so only those reach the URL.
 */
export default function DailyFilters({
  basePath,
  mode: initialMode,
  date,
  from,
  to,
  month,
  department,
  status,
  q,
  departments,
  fixedDepartment,
  allDepartmentsLabel = "All departments",
}: Props) {
  const [mode, setMode] = useState<DailyMode>(initialMode);
  const [fromValue, setFromValue] = useState(from);

  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-3 rounded bg-white p-3 shadow-lg"
    >
      <div className="space-y-1">
        <label htmlFor="d-mode" className={labelCls}>
          Filter by
        </label>
        <select
          id="d-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as DailyMode)}
          className={field}
        >
          <option value="day">Single date</option>
          <option value="range">Date range</option>
          <option value="month">Month</option>
        </select>
      </div>

      {mode === "day" && (
        <div className="space-y-1">
          <label htmlFor="d-date" className={labelCls}>
            Date
          </label>
          <input id="d-date" type="date" name="date" required defaultValue={date} className={field} />
        </div>
      )}

      {mode === "range" && (
        <>
          <div className="space-y-1">
            <label htmlFor="d-from" className={labelCls}>
              From
            </label>
            <input
              id="d-from"
              type="date"
              name="from"
              required
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="d-to" className={labelCls}>
              To
            </label>
            <input
              id="d-to"
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

      {mode === "month" && (
        <div className="space-y-1">
          <label htmlFor="d-month" className={labelCls}>
            Month
          </label>
          <input id="d-month" type="month" name="month" required defaultValue={month} className={field} />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="d-dept" className={labelCls}>
          Department
        </label>
        {departments.length > 0 ? (
          <select id="d-dept" name="department" defaultValue={department} className={field}>
            <option value="">{allDepartmentsLabel}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="py-2 text-sm text-zinc-700">{fixedDepartment}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="d-status" className={labelCls}>
          Status
        </label>
        <select id="d-status" name="status" defaultValue={status} className={field}>
          {DAILY_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="d-q" className={labelCls}>
          Search
        </label>
        <input
          id="d-q"
          type="search"
          name="q"
          maxLength={60}
          defaultValue={q}
          placeholder="Name, code or biometric id"
          className={`${field} w-56`}
        />
      </div>

      <button
        type="submit"
        className="rounded border border-green-800 bg-green-800 px-4 py-2 text-sm text-white hoverEffect hover:bg-white hover:text-green-800"
      >
        Show Result
      </button>
      <Link href={basePath} className="px-2 py-2 text-sm text-zinc-600 hover:underline">
        Reset
      </Link>
    </form>
  );
}
