"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  initialIn: string;
  initialOut: string;
};

const input = "w-full rounded custom-input px-3 py-2 disabled:bg-zinc-100 disabled:text-zinc-400";

export default function CorrectionForm({ action, id, initialIn, initialOut }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [mode, setMode] = useState<"times" | "absent">("times");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-md shadow-lg  bg-white p-6">
      <input type="hidden" name="id" value={id} />

      <fieldset className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mode" value="times" checked={mode === "times"} onChange={() => setMode("times")} />
          The employee was present. Enter the real times.
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mode" value="absent" checked={mode === "absent"} onChange={() => setMode("absent")} />
          Mark as absent.
        </label>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Check-in</label>
          <input type="time" name="checkIn" defaultValue={initialIn} disabled={mode === "absent"} required={mode === "times"} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Check-out</label>
          <input type="time" name="checkOut" defaultValue={initialOut} disabled={mode === "absent"} required={mode === "times"} className={input} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Reason (required)</label>
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={300}
          rows={3}
          placeholder="e.g. Employee confirmed he left at 16:30 and forgot to punch out"
          className="w-full rounded border px-3 py-2"
        />
      </div>

      {state.error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}

      <p className="text-xs text-zinc-500">
        Status, late minutes and overtime are recalculated from the times using the current rules.
        Once corrected, this day is protected: re-processing an import will not overwrite it.
      </p>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} 
        className="custom-button border border-green-800 bg-green-800 text-white hover:text-green-800 hover:bg-white  px-4 py-2 text-sm text-white disabled:opacity-50">
          {pending ? "Saving..." : "Save correction"}
        </button>
        <Link href="/attendance/review" className="rounded border px-4 py-2 text-sm hover:bg-zinc-100">
          Cancel
        </Link>
      </div>
    </form>
  );
}