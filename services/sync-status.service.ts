// The sync script's heartbeat. Used by the script (outside Next.js) and by the web app,
// so: relative imports only, and no "server-only".
import { prisma } from "../lib/prisma";
import type { SyncRow } from "../lib/sync/health";

/** Called by the script after a full successful round (device read, punches saved, days processed). */
export async function recordSyncSuccess(
  deviceId: string,
  retrieved: number,
  inserted: number,
  intervalSeconds: number,
) {
  const now = new Date();
  await prisma.syncStatus.upsert({
    where: { id: deviceId },
    create: {
      id: deviceId,
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastRetrieved: retrieved,
      lastInserted: inserted,
      intervalSeconds,
    },
    update: {
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastError: null,
      consecutiveFailures: 0,
      lastRetrieved: retrieved,
      lastInserted: inserted,
      intervalSeconds,
    },
  });
}

/** Called by the script when a round fails (device off, network down, database error ...). */
export async function recordSyncFailure(
  deviceId: string,
  message: string,
  intervalSeconds: number,
) {
  const now = new Date();
  const text = message.slice(0, 300);
  await prisma.syncStatus.upsert({
    where: { id: deviceId },
    create: {
      id: deviceId,
      lastAttemptAt: now,
      lastError: text,
      consecutiveFailures: 1,
      intervalSeconds,
    },
    update: {
      lastAttemptAt: now,
      lastError: text,
      consecutiveFailures: { increment: 1 },
      intervalSeconds,
    },
  });
}

/** The heartbeat of the most recently active device, as plain values (dates as ISO text). */
export async function getSyncRow(): Promise<
  (Omit<SyncRow, "lastSuccessAt" | "lastAttemptAt"> & {
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
  }) | null
> {
  const row = await prisma.syncStatus.findFirst({
    orderBy: { lastAttemptAt: "desc" },
  });
  if (!row) return null;
  return {
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastError: row.lastError,
    consecutiveFailures: row.consecutiveFailures,
    intervalSeconds: row.intervalSeconds,
  };
}

/** Does the device sync run on this machine? A Vercel deployment only reads a database synced elsewhere. */
export function syncRunsHere(): boolean {
  const mode = process.env.SYNC_HEALTH_MODE?.trim().toLowerCase();
  if (mode === "snapshot" || mode === "readonly" || mode === "display") {
    return false;
  }
  if (mode === "live") return true;
  return !process.env.VERCEL;
}

/** What the header badge needs: the heartbeat and the server's clock at this moment. */
export async function getSyncHealthProps() {
  const serverNow = Date.now();
  const live = syncRunsHere();
  try {
    return { row: await getSyncRow(), serverNow, live };
  } catch (error) {
    // The heartbeat is only decorative: never let it take the dashboard down. If the table is
    // missing or unreachable, the badge shows "not started" and the saved attendance stays visible.
    console.warn(
      "Could not read the device sync heartbeat:",
      error instanceof Error ? error.message : error,
    );
    return { row: null, serverNow, live };
  }
}
