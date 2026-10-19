"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  year: number;
  month: number;
  selected: number[];
};

export default function WeeklyOffForm({ action, year, month, selected }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <div className="flex flex-wrap gap-4">
        {DAYS.map((d) => (
          <label key={`${year}-${month}-${d.value}`} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="weeklyOffDays"
              value={d.value}
              defaultChecked={selected.includes(d.value)}
            />
            {d.label}
          </label>
        ))}
      </div>
      {state.error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded bg-green-50 p-2 text-sm text-green-700">Saved for this month.</div>}
      <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {pending ? "Saving..." : "Save weekly off days for this month"}
      </button>
    </form>
  );
}