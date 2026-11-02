"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/action-state";

type Option = { id: string; label: string };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Only HR passes this, to file a request for someone else. Staff apply for themselves. */
  employees?: Option[];
  leaveTypes: Option[];
  submitLabel?: string;
  /** Fills the form, for "Request Again" on a rejected leave. */
  defaults?: {
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };
  /** Where to go after the request was sent (instead of clearing the form). */
  successHref?: string;
};

const input = "w-full rounded border px-3 py-2";

export default function LeaveRequestForm({
  action,
  employees,
  leaveTypes,
  submitLabel = "Submit leave request",
  defaults,
  successHref,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    if (successHref) router.push(successHref);
    else formRef.current?.reset();
  }, [state, successHref, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {employees && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Employee</label>
            <select
              name="employeeId"
              required
              defaultValue=""
              className={input}
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">Leave type</label>
          <select
            name="leaveTypeId"
            required
            defaultValue={defaults?.leaveTypeId ?? ""}
            className={input}
          >
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
          <input
            type="date"
            name="startDate"
            required
            defaultValue={defaults?.startDate}
            className={input}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Last day</label>
          <input
            type="date"
            name="endDate"
            required
            defaultValue={defaults?.endDate}
            className={input}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Reason</label>
        <input
          name="reason"
          maxLength={300}
          defaultValue={defaults?.reason ?? ""}
          className={input}
        />
      </div>
      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded bg-green-50 p-2 text-sm text-green-700">
          Request sent for approval.
        </div>
      )}
      <button type="submit" disabled={pending} className="green-button">
        {pending ? "Sending..." : submitLabel}
      </button>
    </form>
  );
}
