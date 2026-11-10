"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { NOC_CATEGORIES } from "@/lib/noc/flow";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

const input = "block w-full rounded border border-zinc-400 px-3 py-2 text-sm";

/** The employee's NOC application: what it is for, who it is addressed to, and by when. */
export default function NocRequestForm({ action }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  useEffect(() => {
    if (state.ok) router.push("/noc/my");
  }, [state, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <div className="space-y-1">
        <label htmlFor="noc-category" className="text-sm font-medium">
          What is the NOC for?
        </label>
        <select id="noc-category" name="category" defaultValue="Other" className={input}>
          {NOC_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="noc-purpose" className="text-sm font-medium">
          Reason
        </label>
        <textarea
          id="noc-purpose"
          name="purpose"
          required
          minLength={10}
          maxLength={500}
          rows={4}
          placeholder="For example: I am applying for a visa to attend a course in ... from ... to ..."
          className={input}
        />
        <p className="text-xs text-zinc-500">At least 10 characters, 500 at most.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="noc-to" className="text-sm font-medium">
            Addressed to (optional)
          </label>
          <input
            id="noc-to"
            name="addressedTo"
            maxLength={120}
            placeholder="Embassy, university, bank ..."
            className={input}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="noc-by" className="text-sm font-medium">
            Needed by (optional)
          </label>
          <input id="noc-by" type="date" name="neededBy" className={input} />
        </div>
      </div>

      <p className="rounded bg-zinc-50 p-3 text-xs text-zinc-600">
        Your request goes to your department DD first, then to the CEO for a
        Yes or No. If both agree, HR will issue the NOC and you can download it
        here.
      </p>

      {state.error && (
        <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="green-button hoverEffect disabled:opacity-50">
        {pending ? "Sending..." : "Send request"}
      </button>
    </form>
  );
}
