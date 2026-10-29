// Filters for an employee's own attendance views (/attendance/my and the dashboards).
//
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   a custom date range
//   ?month=YYYY-MM                   one month
//   ?year=YYYY                       a whole year
//   ?status=ABSENT                   only days with this status (any of the above)
//
// Pure functions: no database, safe to import from client components.
import { addDays, monthParam, parseIsoDate, toIsoDate } from "./dates";
import { MONTHS } from "./months";

export type PeriodKind = "month" | "range" | "year";

export type Period = {
  kind: PeriodKind;
  /** first day, inclusive (UTC midnight) */
  start: Date;
  /** last day, inclusive (UTC midnight) */
  end: Date;
  label: string;
  /** true when a custom range was longer than MAX_RANGE_DAYS and was shortened */
  clamped: boolean;
};

/** A custom range longer than this is shortened, so one request stays small. */
export const MAX_RANGE_DAYS = 366;

export const STATUS_FILTERS = [
  { value: "ALL", label: "All days" },
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late (short leave / half day)" },
  { value: "ABSENT", label: "Absent" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "INCOMPLETE", label: "Missing punch" },
  { value: "WEEKEND", label: "Weekly off" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "NO_RECORD", label: "No record" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export function parseStatusFilter(value: string | undefined): StatusFilter {
  const found = STATUS_FILTERS.find((s) => s.value === value);
  return found ? found.value : "ALL";
}

/** Does a day with this attendance status belong to the chosen filter? */
export function matchesStatus(status: string, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "LATE") {
    return status === "SHORT_LEAVE" || status === "HALF_DAY" || status === "LATE";
  }
  return status === filter;
}

export function statusFilterLabel(filter: StatusFilter): string {
  return STATUS_FILTERS.find((s) => s.value === filter)?.label ?? "All days";
}

const longDay = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function monthPeriod(year: number, month: number): Period {
  return {
    kind: "month",
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
    label: `${MONTHS[month - 1]} ${year}`,
    clamped: false,
  };
}

export function yearPeriod(year: number): Period {
  return {
    kind: "year",
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
    label: String(year),
    clamped: false,
  };
}

export function rangePeriod(a: Date, b: Date): Period {
  let start = a <= b ? a : b;
  const end = a <= b ? b : a;
  let clamped = false;
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (spanDays + 1 > MAX_RANGE_DAYS) {
    // keep the most recent part of the range
    start = addDays(end, -(MAX_RANGE_DAYS - 1));
    clamped = true;
  }
  return {
    kind: "range",
    start,
    end,
    label:
      toIsoDate(start) === toIsoDate(end)
        ? longDay(start)
        : `${longDay(start)} to ${longDay(end)}`,
    clamped,
  };
}

export type PeriodParams = {
  from?: string;
  to?: string;
  month?: string;
  year?: string;
  date?: string;
};

/**
 * The custom period asked for in the URL, or null when the URL asks for nothing
 * special (then the page keeps its normal "month of the selected day" behaviour).
 * A valid from/to range wins over ?year=, and ?year= wins over ?month=.
 */
export function parseCustomPeriod(sp: PeriodParams): Period | null {
  const from = parseIsoDate(sp.from);
  const to = parseIsoDate(sp.to);
  if (from || to) return rangePeriod((from ?? to)!, (to ?? from)!);

  if (sp.year && /^\d{4}$/.test(sp.year) && !sp.month && !sp.date) {
    const year = Number(sp.year);
    if (year >= 2000 && year <= 2100) return yearPeriod(year);
  }
  return null;
}

/** Keeps the status filter when moving to another month / day. */
export function withStatus(
  query: Record<string, string>,
  status: StatusFilter,
): string {
  const params = new URLSearchParams(query);
  if (status !== "ALL") params.set("status", status);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The query string that reproduces a period exactly (used for status pills and links). */
export function periodQuery(period: Period): Record<string, string> {
  switch (period.kind) {
    case "month":
      return {
        month: monthParam(
          period.start.getUTCFullYear(),
          period.start.getUTCMonth() + 1,
        ),
      };
    case "year":
      return { year: String(period.start.getUTCFullYear()) };
    case "range":
      return { from: toIsoDate(period.start), to: toIsoDate(period.end) };
  }
}
