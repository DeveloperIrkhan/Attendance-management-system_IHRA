"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

type Option = { id: string; label: string };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  employees: Option[];
  shiftStart: string;
  shiftEnd: string;
};

const input = "w-full custom-input";

export default function ShortLeaveForm({
  action,
  employees,
  shiftStart,
  shiftEnd,
}: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Employee</label>
          <select name="employeeId" required defaultValue="" className={input}>
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <input type="date" name="date" required className={input} />
        </div>
        <div />
        <div className="space-y-1">
          <label className="text-sm font-medium">From</label>
          <input
            type="time"
            name="startTime"
            required
            defaultValue={shiftStart}
            className={input}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">To</label>
          <input type="time" name="endTime" required className={input} />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Must be within shift hours ({shiftStart} to {shiftEnd}). For a late
        arrival, start at the shift start and end at the expected arrival time.
      </p>
      <div className="space-y-1">
        <label className="text-sm font-medium">Reason</label>
        <input name="reason" maxLength={300} className={input} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approveNow" />
        Approve immediately
      </label>
      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded bg-green-50 p-2 text-sm text-green-700">
          Saved.
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="green-button hoverEffect"
      >
        {pending ? "Saving..." : "Add short leave"}
      </button>
    </form>
  );
}
