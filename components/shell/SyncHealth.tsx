"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SYNC_STATE_TEXT,
  describeAge,
  evaluateSyncHealth,
  type SyncRow,
  type SyncState,
} from "@/lib/sync/health";

export type SyncHealthProps = {
  /** the heartbeat row, or null when the sync script never reported */
  row: SyncRow | null;
  /** the server's time when the page was built, so the first paint matches the server */
  serverNow: number;
};

const DOT: Record<SyncState, string> = {
  ok: "bg-green-500",
  delayed: "bg-amber-500",
  down: "bg-red-500",
  never: "bg-zinc-400",
};

/** Keeps "5 min ago" current, and asks the server for a fresh heartbeat every two minutes. */
function useSyncHealth({ row, serverNow }: SyncHealthProps) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    let ticks = 0;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      ticks += 1;
      if (ticks % 4 === 0) router.refresh(); // every 4 x 30 s
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return evaluateSyncHealth(row, now);
}

/** Small status pill for the header: a coloured dot and how long ago the device was last read. */
export function SyncHealthBadge(props: SyncHealthProps) {
  const health = useSyncHealth(props);
  const detail =
    health.state === "never"
      ? "the sync has not reported yet"
      : `last sync ${describeAge(health.minutesSince)}`;
  const title = `${SYNC_STATE_TEXT[health.state]} (${detail})${
    health.lastError ? `. Last error: ${health.lastError}` : ""
  }`;

  return (
    <span
      title={title}
      role="status"
      className="hidden items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 md:inline-flex"
    >
      <span className={`h-2 w-2 rounded-full ${DOT[health.state]}`} aria-hidden />
      <span>
        Sync{" "}
        {health.state === "never"
          ? "not started"
          : describeAge(health.minutesSince)}
      </span>
    </span>
  );
}

/** A red bar across the page when the sync has stopped: new punches are not arriving. */
export function SyncHealthBanner(props: SyncHealthProps) {
  const health = useSyncHealth(props);
  if (health.state !== "down") return null;

  return (
    <div
      role="alert"
      className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-6"
    >
      <strong>The attendance device sync has stopped.</strong> New punches are
      not arriving, so today&apos;s attendance may be incomplete. Last
      successful sync: {describeAge(health.minutesSince)}.
      {health.lastError && <> Last error: {health.lastError}.</>} Check that the
      computer running the sync is on and connected to the device.
    </div>
  );
}
