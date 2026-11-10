"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  /** the name of the person asking, for the confirmation question */
  who: string;
};

/** Yes or No on a NOC request, with an optional note kept with the answer. */
export default function NocDecisionForm({ action, id, who }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter as HTMLElement | null);
    const yes = fd.get("decision") === "YES";
    if (!window.confirm(`${yes ? "Approve (Yes)" : "Reject (No)"} the NOC request of ${who}?`)) return;
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="note"
        maxLength={300}
        placeholder="Note (optional)"
        aria-label="Note for your answer"
        className="w-56 rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        name="decision"
        value="YES"
        disabled={pending}
        className="rounded border border-green-800 bg-green-800 px-3 py-1 text-sm text-white hover:bg-white hover:text-green-800 disabled:opacity-50"
      >
        Yes
      </button>
      <button
        type="submit"
        name="decision"
        value="NO"
        disabled={pending}
        className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        No
      </button>
      {state.error && <span className="basis-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
