export type DeviceTimeMode = "local" | "utc";

export function parseDeviceTimeMode(value: string | undefined): DeviceTimeMode {
  return value?.trim().toLowerCase() === "utc" ? "utc" : "local";
}

export function toOfficeClock(
  deviceDate: Date,
  mode: DeviceTimeMode = "local",
): Date {
  if (mode === "utc") return new Date(deviceDate.getTime());
  return new Date(
    Date.UTC(
      deviceDate.getFullYear(),
      deviceDate.getMonth(),
      deviceDate.getDate(),
      deviceDate.getHours(),
      deviceDate.getMinutes(),
      deviceDate.getSeconds(),
    ),
  );
}

/** Today's date (as UTC midnight) and the minutes since midnight, on the office clock = the server's clock. */
export function officeNow(now: Date = new Date()) {
  return {
    todayMs: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}
