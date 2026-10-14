"use client";

import { ActionState } from "@/lib/action-state";
import { startTransition, useActionState } from "react";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  label: string;
  confirmMessage?: string;
  fields?: Record<string, string>;
  danger?: boolean;
};

export default function RowActionForm({
  action,
  id,
  label,
  confirmMessage,
  fields,
  danger,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="inline">
      <input type="hidden" name="id" value={id} />
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
          danger ? "border-red-300 text-red-700 hover:bg-red-50" : "hover:bg-zinc-100"
        }`}
      >
        {pending ? "..." : label}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}