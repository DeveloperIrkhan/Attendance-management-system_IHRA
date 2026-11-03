// Filters of the daily attendance page:
//   ?date=YYYY-MM-DD                one day
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  a date range
//   ?month=YYYY-MM                  one month
//   ?department=<id>  ?status=ABSENT  ?q=name, code or biometric id  ?page=2
// Pure functions, safe to import from client components.
import { monthParam, parseIsoDate, parseMonthParam, toIsoDate } from "./dates";
import { monthPeriod, rangePeriod } from "./period";

export type DailyMode = "day" | "range" | "month";

export type DailyRange = {
  mode: DailyMode;
  /** first and last day, inclusive (UTC midnight) */
  start: Date;
  end: Date;
  label: string;
  /** a range longer than a year was shortened to its last 366 days */
  clamped: boolean;
};

export const DAILY_STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "PRESENT", label: "Present" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "NOT_IN", label: "Not in yet (today)" },
  { value: "ABSENT", label: "Absent" },
  { value: "INCOMPLETE", label: "Missing punch" },
  { value: "SHORT_LEAVE", label: "Short leave" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "WEEKEND", label: "Weekly off" },
] as const;

export type DailyStatus = (typeof DAILY_STATUS_OPTIONS)[number]["value"];

export function parseDailyStatus(value: string | undefined): DailyStatus {
  const found = DAILY_STATUS_OPTIONS.find((s) => s.value === value);
  return found ? found.value : "ALL";
}

export function dailyStatusLabel(status: DailyStatus): string {
  return DAILY_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? "All statuses";
}

export type DailyParams = {
  date?: string;
  from?: string;
  to?: string;
  month?: string;
};

const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Which days the page shows. A from/to range wins over ?month=, which wins over ?date=.
 * With nothing valid in the URL it shows `fallback` (the latest day with attendance), or null
 * when there is no attendance at all.
 */
export function resolveDailyRange(
  sp: DailyParams,
  fallback: Date | null,
): DailyRange | null {
  const from = parseIsoDate(sp.from);
  const to = parseIsoDate(sp.to);
  if (from || to) {
    const p = rangePeriod((from ?? to)!, (to ?? from)!);
    return { mode: "range", start: p.start, end: p.end, label: p.label, clamped: p.clamped };
  }

  const m = parseMonthParam(sp.month);
  if (m) {
    const p = monthPeriod(m.year, m.month);
    return { mode: "month", start: p.start, end: p.end, label: p.label, clamped: false };
  }

  const day = parseIsoDate(sp.date) ?? fallback;
  if (!day) return null;
  return { mode: "day", start: day, end: day, label: dayLabel(day), clamped: false };
}

/** The query string that reproduces the filters (used by pills, paging and previous/next day). */
export function dailyQuery(
  range: DailyRange,
  extra: { department?: string; status?: DailyStatus; q?: string; page?: number },
): string {
  const p = new URLSearchParams();
  if (range.mode === "day") p.set("date", toIsoDate(range.start));
  else if (range.mode === "month")
    p.set("month", monthParam(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1));
  else {
    p.set("from", toIsoDate(range.start));
    p.set("to", toIsoDate(range.end));
  }
  if (extra.department) p.set("department", extra.department);
  if (extra.status && extra.status !== "ALL") p.set("status", extra.status);
  if (extra.q) p.set("q", extra.q);
  if (extra.page && extra.page > 1) p.set("page", String(extra.page));
  return `?${p.toString()}`;
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}
