import "dotenv/config";
import { createHash } from "node:crypto";
import { ZKTecoClient } from "@graphland/zkteco";
import { prisma } from "../lib/prisma";
import { processDevicePunches } from "../services/device-attendance.service";
import {
  parseDeviceTimeMode,
  toOfficeClock,
} from "../lib/attendance/office-clock";

const DEVICE_ID = process.env.ZK_DEVICE_ID ?? "uface800-main";
const DEVICE_IP = process.env.ZK_DEVICE_IP;
const DEVICE_PORT = Number(process.env.ZK_DEVICE_PORT ?? 4370);
const COMM_KEY = Number(process.env.ZK_COMM_KEY ?? 0);
const POLL_INTERVAL_MS = Number(process.env.ZK_POLL_INTERVAL_MS ?? 60_000);
// "local" (default): the device library builds each punch time from local parts, in this
// computer's time zone. Use ZK_TIME_MODE=utc only if the first record printed at startup
// shows the device's wall-clock time with a trailing Z.
const TIME_MODE = parseDeviceTimeMode(process.env.ZK_TIME_MODE);

if (!DEVICE_IP) {
  throw new Error("Missing ZK_DEVICE_IP in .env");
}

type DeviceRecord = {
  userSn?: number;
  deviceUserId: string;
  recordTime: Date;
  punch?: number;
  punchLabel?: string;
  status?: number;
  statusLabel?: string;
  [key: string]: unknown;
};

function normalizeRecord(record: DeviceRecord) {
  const deviceUserId = String(record.deviceUserId ?? "").trim();
  // Saved as office clock time (08:15 on the device screen = 08:15 UTC in the database),
  // the way the rest of the app stores attendance times. See lib/attendance/office-clock.ts.
  const punchedAt = toOfficeClock(new Date(record.recordTime), TIME_MODE);
  // console.log("Punch time diagnostic:", {
  //   serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  //   serverLocal: record.recordTime.toString(),
  //   sdkISOString: record.recordTime.toISOString(),
  //   mode: TIME_MODE,
  //   savedOfficeClock: toOfficeClock(
  //     new Date(record.recordTime),
  //     TIME_MODE,
  //   ).toISOString(),
  // });
  if (!deviceUserId || Number.isNaN(punchedAt.getTime())) {
    console.warn("Skipping invalid device record:", record);
    return null;
  }

  // Include the available event fields in the deduplication key.
  const sourceKey = createHash("sha256")
    .update(
      JSON.stringify([
        DEVICE_ID,
        record.userSn ?? null,
        deviceUserId,
        punchedAt.toISOString(),
        record.punch ?? null,
        record.status ?? null,
      ]),
    )
    .digest("hex");

  return {
    deviceId: DEVICE_ID,
    deviceUserId,
    punchedAt,
    punchState: record.punch ?? null,
    verifyMode: record.status ?? null,
    sourceKey,
    rawData: JSON.parse(JSON.stringify(record)),
  };
}

async function syncOnce() {
  const client = new ZKTecoClient({
    ip: DEVICE_IP!,
    port: DEVICE_PORT,
    timeout: 10_000,
    commKey: COMM_KEY,
  });

  let connected = false;

  try {
    console.log(
      `[${new Date().toISOString()}] Connecting to ${DEVICE_IP}:${DEVICE_PORT}`,
    );

    await client.connect();
    connected = true;

    const info = await client.getInfo();
    console.log("Device information:", info);

    const records = (await client.getAttendances()) as DeviceRecord[];
    console.log(`Retrieved ${records.length} attendance records.`);

    // Printed once so the time handling can be checked against the device screen.
    if (!timeChecked && records.length > 0) {
      const last = records[records.length - 1];
      const raw = new Date(last.recordTime);
      console.log(
        `Time check (latest punch of user ${last.deviceUserId}): ` +
          `library gave ${raw.toString()} = ${raw.toISOString()}; ` +
          `saved as office time ${toOfficeClock(raw, TIME_MODE).toISOString()} ` +
          `(mode "${TIME_MODE}"). The saved time should equal the time shown on the device.`,
      );
      timeChecked = true;
    }

    let inserted = 0;
    let invalid = 0;

    for (let i = 0; i < records.length; i += 500) {
      const normalized = records.slice(i, i + 500).map(normalizeRecord);

      invalid += normalized.filter((record) => record === null).length;

      const validRecords = normalized.filter(
        (record): record is NonNullable<typeof record> => record !== null,
      );

      if (!validRecords.length) continue;

      const result = await prisma.devicePunch.createMany({
        data: validRecords,
        skipDuplicates: true,
      });

      inserted += result.count;
    }

    console.log(
      `Sync finished: retrieved=${records.length}, ` +
        `inserted=${inserted}, invalid=${invalid}`,
    );

    // Full history once after startup, then only the last two days on every poll. Running it
    // every time (not only when new punches arrive) lets a day close by itself after the shift
    // ends: employees who never punched become Absent, and a lone check-in turns into Missing punch.
    await processDevicePunches(attendanceInitialized ? { sinceDays: 2 } : {});
    attendanceInitialized = true;
  } finally {
    if (connected) {
      await client.disconnect();
    }
  }
}

let stopping = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let attendanceInitialized = false;
let timeChecked = false;

async function poll() {
  if (stopping || running) return;

  running = true;

  try {
    await syncOnce();
  } catch (error) {
    console.error("uFace800 sync failed:", error);
  } finally {
    running = false;
  }

  if (!stopping) {
    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;

  if (timer) clearTimeout(timer);

  console.log("Stopping synchronization worker...");

  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await prisma.$disconnect();
  console.log("Worker stopped.");
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

console.log("Starting uFace800 attendance synchronization...");
void poll();
