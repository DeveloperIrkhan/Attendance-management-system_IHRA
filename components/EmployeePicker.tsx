"use client";

import { useMemo, useState } from "react";

export type PickerEmployee = {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  departmentName: string;
  isActive: boolean;
};

type Props = {
  employees: PickerEmployee[];
  /** ids selected when the page opens */
  selected: string[];
  /** name of the form field that carries the ids, separated by commas */
  name?: string;
  max?: number;
};

const field = "rounded border border-zinc-400 px-3 py-2 text-sm";

/**
 * Choose any employees, from one department or several: search by name or code, narrow the list
 * by department, tick people, or use "Select shown" for everybody in the list. The ticked ids
 * travel in one hidden field, so the report form stays a plain GET form.
 */
export default function EmployeePicker({
  employees,
  selected,
  name = "employees",
  max = 200,
}: Props) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(selected.filter((id) => employees.some((e) => e.id === id))),
  );
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.departmentId, e.departmentName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [employees]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (!department || e.departmentId === department) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q)),
    );
  }, [employees, query, department]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < max) next.add(id);
      return next;
    });

  const selectShown = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const e of shown) {
        if (next.size >= max) break;
        next.add(e.id);
      }
      return next;
    });

  return (
    <fieldset className="basis-full space-y-2 rounded border border-zinc-300 p-3">
      <legend className="px-1 text-sm font-medium">Employees</legend>
      <input type="hidden" name={name} value={[...picked].join(",")} />

      <div className="flex flex-wrap items-end gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or code"
          aria-label="Search employees"
          className={`${field} w-56`}
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Show employees of"
          className={field}
        >
          <option value="">All departments</option>
          {departments.map(([id, deptName]) => (
            <option key={id} value={id}>
              {deptName}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={selectShown}
          className="rounded border border-green-800 px-3 py-2 text-sm text-green-800 hover:bg-green-50"
        >
          Select shown ({shown.length})
        </button>
        <button
          type="button"
          onClick={() => setPicked(new Set())}
          className="px-2 py-2 text-sm text-zinc-600 hover:underline"
        >
          Clear
        </button>
        <span className="text-sm text-zinc-600" aria-live="polite">
          {picked.size === 0
            ? "None selected: everybody (or the department chosen below)"
            : `${picked.size} selected${picked.size >= max ? " (the most allowed)" : ""}`}
        </span>
      </div>

      <ul className="max-h-56 overflow-auto rounded border border-zinc-200 bg-white p-1 text-sm">
        {shown.length === 0 && (
          <li className="p-2 text-zinc-500">No employee matches.</li>
        )}
        {shown.map((e) => (
          <li key={e.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-green-50">
              <input
                type="checkbox"
                checked={picked.has(e.id)}
                onChange={() => toggle(e.id)}
              />
              <span>
                {e.name}{" "}
                <span className="text-zinc-500">
                  ({e.code}) · {e.departmentName}
                </span>
                {!e.isActive && (
                  <span className="ml-1 text-xs text-amber-700">inactive</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
