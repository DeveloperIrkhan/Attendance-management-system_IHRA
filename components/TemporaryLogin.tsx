"use client";

import { startTransition, useActionState, useState } from "react";
import type { ActionState, IssuedLogin } from "@/lib/action-state";

/** Shows a one-time password once, with a copy button. Only the hash is stored on the server. */
export function CredentialsBox({
  login,
  title = "Login created",
}: {
  login: IssuedLogin;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${login.email}\nTemporary password: ${login.password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-green-300 bg-green-50 p-4 text-sm">
      <p className="font-semibold text-green-800">
        {title} for {login.name}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-600">Email</dt>
        <dd className="font-mono">{login.email}</dd>
        <dt className="text-slate-600">Temporary password</dt>
        <dd className="font-mono text-base font-semibold tracking-wide">
          {login.password}
        </dd>
      </dl>
      <p className="text-xs text-amber-800">
        Save or copy this now: it is shown only once and cannot be looked up
        later. The employee must choose a new password at first sign-in. If it
        is lost, reset it from the employee page.
      </p>
      <button
        type="button"
        onClick={copy}
        className="rounded border border-green-700 px-3 py-1 text-xs text-green-800 hover:bg-green-100"
      >
        {copied ? "Copied" : "Copy details"}
      </button>
    </div>
  );
}

/** Button that issues a new one-time password through `action` and shows it once. */
export function ResetLoginForm({
  action,
  id,
  label = "Reset password",
  confirmMessage = "Issue a new one-time password? The current password will stop working.",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  label?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    {} as ActionState,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!window.confirm(confirmMessage)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          className="green-button-inverse hoverEffect disabled:opacity-50"
        >
          {pending ? "Working..." : label}
        </button>
      </form>
      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.login && (
        <CredentialsBox login={state.login} title="New password issued" />
      )}
    </div>
  );
}