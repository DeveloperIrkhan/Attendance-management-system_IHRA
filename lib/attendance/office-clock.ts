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

/**
 * Today's date (as UTC midnight) and the minutes since midnight on the office clock.
 * By default that is the server's own clock. The sync on the office PC is right that way, but a
 * web server in another time zone (Vercel runs in UTC) would see a different "today" and "now".
 * Set OFFICE_TIMEZONE (for example "Asia/Karachi") on every machine to make them all agree.
 */
export function officeNow(now: Date = new Date()) {
  const zone = process.env.OFFICE_TIMEZONE?.trim();
  if (zone) {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .formatToParts(now)
          .map((p) => [p.type, p.value]),
      );
      return {
        todayMs: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
      };
    } catch {
      // an unknown zone name: fall back to the server's clock
    }
  }
  return {
    todayMs: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}
