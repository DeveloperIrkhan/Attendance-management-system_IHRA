"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

type Option = { id: string; label: string };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  employees: Option[];
  leaveTypes: Option[];
};

const input = "w-full rounded border px-3 py-2";

export default function LeaveRequestForm({
  action,
  employees,
  leaveTypes,
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
        <div className="space-y-1">
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
          <label className="text-sm font-medium">Leave type</label>
          <select name="leaveTypeId" required defaultValue="" className={input}>
            <option value="">Select type</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">First day</label>
          <input type="date" name="startDate" required className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Last day</label>
          <input type="date" name="endDate" required className={input} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Reason</label>
        <input name="reason" maxLength={300} className={input} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approveNow" />
        Approve immediately (HR entering an already agreed leave)
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
      <button type="submit" disabled={pending} className="green-button">
        {pending ? "Saving..." : "Add leave request"}
      </button>
    </form>
  );
}
