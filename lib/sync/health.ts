// Is the device sync alive? The sync script (on the office PC) writes a heartbeat after every
// successful round; this turns that heartbeat into ok / delayed / down for the header badge.
// Pure functions, no database, safe to import from client components.

export type SyncRow = {
  lastSuccessAt: Date | string | null;
  lastAttemptAt: Date | string | null;
  lastError: string | null;
  consecutiveFailures: number;
  /** how often the script polls, in seconds */
  intervalSeconds: number;
};

export type SyncState = "ok" | "delayed" | "down" | "never";

export type SyncHealth = {
  state: SyncState;
  /** minutes since the last successful sync, null when it never succeeded */
  minutesSince: number | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
};

const ms = (v: Date | string | null): number | null => {
  if (v === null) return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * ok       a sync finished within about 2.5 poll intervals (at least 3 minutes)
 * delayed  longer than that, but under 6 intervals (at least 10 minutes)
 * down     longer than that, or it never succeeded and has failed
 * never    no heartbeat at all yet (the script was never started)
 */
export function evaluateSyncHealth(
  row: SyncRow | null,
  nowMs: number,
): SyncHealth {
  if (!row) {
    return {
      state: "never",
      minutesSince: null,
      lastSuccessAt: null,
      lastError: null,
    };
  }
  const success = ms(row.lastSuccessAt);
  if (success === null) {
    return {
      state: row.consecutiveFailures > 0 ? "down" : "never",
      minutesSince: null,
      lastSuccessAt: null,
      lastError: row.lastError,
    };
  }
  const ageSeconds = Math.max(0, (nowMs - success) / 1000);
  const interval = Math.max(10, row.intervalSeconds);
  const okLimit = Math.max(180, 2.5 * interval);
  const downLimit = Math.max(600, 6 * interval);
  const state: SyncState =
    ageSeconds <= okLimit ? "ok" : ageSeconds <= downLimit ? "delayed" : "down";
  return {
    state,
    minutesSince: Math.floor(ageSeconds / 60),
    lastSuccessAt: new Date(success),
    lastError: row.lastError,
  };
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function describeAge(minutes: number | null): string {
  if (minutes === null) return "never";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export const SYNC_STATE_TEXT: Record<SyncState, string> = {
  ok: "Device sync: OK",
  delayed: "Device sync: delayed",
  down: "Device sync: stopped",
  never: "Device sync: not started",
};
