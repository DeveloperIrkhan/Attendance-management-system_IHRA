"use client";

import { useEffect } from "react";

/**
 * Shown inside the app shell when a page under (dashboard) throws.
 *
 * The layout (sidebar, header, sync status line) is outside this boundary and keeps
 * rendering, so a database problem on one page no longer replaces the whole app with
 * "This page couldn't load". `retry` re-renders just this segment.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h2 className="text-base font-semibold">This page could not be loaded</h2>
      <p className="mt-2 text-sm">
        The rest of the app still works — try another page, or reload this one.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-amber-800">
          Reference: <code>{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Try again
      </button>
    </div>
  );
}
