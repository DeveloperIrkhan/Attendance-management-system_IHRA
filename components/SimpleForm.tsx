"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

type Field = {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: "text" | "email" | "date" | "number" | "password";
  placeholder?: string;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  submitLabel: string;
  hidden?: Record<string, string>;
  resetOnSuccess?: boolean;
};

export default function SimpleForm({
  action,
  fields,
  submitLabel,
  hidden,
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
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3 w-full">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => (
        <div key={f.name} className="space-y-1">
          <label
            className="text-sm font-medium"
            htmlFor={`${f.name}-${hidden?.id ?? "new"}`}
          >
            {f.label}
          </label>
          <input
            id={`${f.name}-${hidden?.id ?? "new"}`}
            name={f.name}
            defaultValue={f.defaultValue}
            required={f.required}
            placeholder={f.placeholder}
            className="w-full rounded custom-input px-3 py-2"
          />
        </div>
      ))}
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
