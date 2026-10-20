"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  id?: string;
  initial?: { name: string; isPaid: boolean; yearlyQuotaDays: number | null };
  resetOnSuccess?: boolean;
};

export default function LeaveTypeForm({
  action,
  submitLabel,
  id,
  initial,
  resetOnSuccess,
}: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="space-y-1">
        <label className="text-sm font-medium">Name</label>
        <input
          name="name"
          required
          defaultValue={initial?.name}
          placeholder="e.g. Casual leave"
          className={"custom-input w-full  px-3 py-2"}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Yearly quota (days)</label>
        <input
          name="yearlyQuotaDays"
          type="number"
          min={0}
          max={365}
          defaultValue={initial?.yearlyQuotaDays ?? ""}
          placeholder="Leave empty for no limit"
          className={"custom-input w-full  px-3 py-2"}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Paid or unpaid</label>
        <select
          name="isPaid"
          defaultValue={initial ? String(initial.isPaid) : "true"}
          className={"custom-input w-full  px-3 py-2"}
        >
          <option value="true">Paid</option>
          <option value="false">Unpaid</option>
        </select>
      </div>
      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="green-button hoverEffect"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
