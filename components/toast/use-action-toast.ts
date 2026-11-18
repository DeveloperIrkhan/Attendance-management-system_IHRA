"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";
import { notifyError, notifySuccess } from "./Toaster";

/**
 * Toast the result of any server action that returns an ActionState.
 *
 * The initial useActionState value is `{}`, which has neither `ok` nor `error`, so nothing is
 * shown on page load. Each completed action produces a new state object, which is toasted once.
 */
export function useActionToast(
  state: ActionState,
  successMessage = "Saved successfully.",
) {
  const lastNotified = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === lastNotified.current) return;
    if (!("ok" in state) && !("error" in state)) return;

    lastNotified.current = state;
    if (state.error) notifyError(state.error);
    else if (state.ok) notifySuccess(state.message ?? successMessage);
  }, [state, successMessage]);
}
