"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";
import { PERMISSION_GROUPS } from "@/lib/auth/permissions";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  initial?: {
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
  };
  /** built-in roles keep their name */
  nameLocked?: boolean;
  /** the Admin role: every right, not editable */
  allLocked?: boolean;
  resetOnSuccess?: boolean;
};

export default function RoleForm({
  action,
  submitLabel,
  initial,
  nameLocked,
  allLocked,
  resetOnSuccess,
}: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const idSuffix = initial?.id ?? "new";

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const has = (key: string) => allLocked || initial?.permissions.includes(key);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="w-full space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`name-${idSuffix}`}>
            Role name
          </label>
          <input
            id={`name-${idSuffix}`}
            name="name"
            required
            readOnly={nameLocked}
            defaultValue={initial?.name}
            placeholder="e.g. HR Deputy Director"
            className="w-full rounded custom-input px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`desc-${idSuffix}`}>
            Description
          </label>
          <input
            id={`desc-${idSuffix}`}
            name="description"
            readOnly={allLocked}
            defaultValue={initial?.description ?? ""}
            placeholder="What is this role for?"
            className="w-full rounded custom-input px-3 py-2"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold text-green-800">
              {group.title}
            </legend>
            {group.items.map((p) => (
              <label key={p.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="permissions"
                  value={p.key}
                  defaultChecked={has(p.key)}
                  disabled={allLocked}
                  className="mt-1"
                />
                <span>
                  {p.label}
                  {p.hint && (
                    <span className="block text-xs text-zinc-500">
                      {p.hint}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      {allLocked ? (
        <p className="text-sm text-zinc-600">
          The Admin role always has every right and cannot be changed.
        </p>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="green-button hoverEffect"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
      )}

      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && state.message && (
        <div className="rounded bg-green-50 p-2 text-sm text-green-800">
          {state.message}
        </div>
      )}
    </form>
  );
}
