"use client";

import { startTransition, useActionState, useRef } from "react";
import type { ActionState } from "@/lib/action-state";
import { CredentialsBox } from "@/components/TemporaryLogin";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  roles: { value: string; label: string }[];
};

/** Creates a login that is not an employee, then shows its one-time password once. */
export default function CreateUserForm({ action, roles }: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="grid max-w-3xl gap-3 sm:grid-cols-3"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="new-user-name">
            Full name
          </label>
          <input
            id="new-user-name"
            name="fullName"
            required
            className="w-full rounded custom-input px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="new-user-email">
            Email (used to sign in)
          </label>
          <input
            id="new-user-email"
            name="email"
            type="email"
            required
            className="w-full rounded custom-input px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="new-user-role">
            Role
          </label>
          <select
            id="new-user-role"
            name="roleId"
            required
            defaultValue=""
            className="w-full rounded custom-input px-3 py-2"
          >
            <option value="" disabled>
              Select a role
            </option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="green-button hoverEffect"
          >
            {pending ? "Creating..." : "Create user"}
          </button>
        </div>
      </form>

      {state.error && (
        <div className="max-w-3xl rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && state.login && (
        <div className="max-w-xl">
          <CredentialsBox login={state.login} />
        </div>
      )}
    </div>
  );
}
