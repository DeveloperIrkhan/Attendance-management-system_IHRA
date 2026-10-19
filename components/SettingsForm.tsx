"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

export type SettingsValues = {
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  halfDayAfterMinutes: number;
  duplicatePunchMinutes: number;
  earliestPunch: string;
  latestPunch: string;
  overtimeMinMinutes: number;
  offDayWorkIsOvertime: boolean;
  defaultWeeklyOffDays: number[];
};

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const input = "w-full rounded custom-input px-3 py-2";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export default function SettingsForm({
  action,
  values,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values: SettingsValues;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-3xl space-y-6 rounded shadow-xl bg-white p-6"
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Shift start">
          <input
            type="time"
            name="shiftStart"
            defaultValue={values.shiftStart}
            required
            className={input}
          />
        </Field>
        <Field label="Shift end (overtime starts after this)">
          <input
            type="time"
            name="shiftEnd"
            defaultValue={values.shiftEnd}
            required
            className={input}
          />
        </Field>
        <Field
          label="Grace period (minutes)"
          hint="Arrival within this time after shift start counts as on time."
        >
          <input
            type="number"
            name="graceMinutes"
            min={0}
            max={120}
            defaultValue={values.graceMinutes}
            required
            className={input}
          />
        </Field>
        <Field
          label="Half day after (minutes late)"
          hint="Arrival later than grace but earlier than this is a short leave. At or after this it is a half day."
        >
          <input
            type="number"
            name="halfDayAfterMinutes"
            min={1}
            max={480}
            defaultValue={values.halfDayAfterMinutes}
            required
            className={input}
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Ignore repeated punches within (minutes)"
          hint="A punch this close to the previous counted punch is ignored."
        >
          <input
            type="number"
            name="duplicatePunchMinutes"
            min={0}
            max={120}
            defaultValue={values.duplicatePunchMinutes}
            required
            className={input}
          />
        </Field>
        <Field
          label="Minimum overtime (minutes)"
          hint="Time after shift end counts as overtime only if it reaches this. 0 counts every minute."
        >
          <input
            type="number"
            name="overtimeMinMinutes"
            min={0}
            max={480}
            defaultValue={values.overtimeMinMinutes}
            required
            className={input}
          />
        </Field>
        <Field
          label="Earliest punch counted"
          hint="Punches before this time are ignored."
        >
          <input
            type="time"
            name="earliestPunch"
            defaultValue={values.earliestPunch}
            required
            className={input}
          />
        </Field>
        <Field
          label="Latest punch counted"
          hint="Punches after this time are ignored (the day may then need HR review)."
        >
          <input
            type="time"
            name="latestPunch"
            defaultValue={values.latestPunch}
            required
            className={input}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Default weekly off days</p>
        <div className="flex flex-wrap gap-4">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="weeklyOffDays"
                value={d.value}
                defaultChecked={values.defaultWeeklyOffDays.includes(d.value)}
              />
              {d.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Used for every month unless you set different days on the Calendar
          page.
        </p>
      </section>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="offDayWorkIsOvertime"
          defaultChecked={values.offDayWorkIsOvertime}
        />
        Count time worked on weekly off days and holidays as overtime
      </label>

      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded bg-green-50 p-2 text-sm text-green-700">
          Saved. Existing imports are not changed until you click &quot;Process
          attendance&quot; on them.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save rules"}
      </button>
    </form>
  );
}
