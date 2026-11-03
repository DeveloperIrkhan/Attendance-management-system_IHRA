// The daily page lists every employee, also those without an attendance record yet.
// This decides what to show for an employee who has NO record on the chosen day.
// Pure function, no database, so the rules are easy to test.

export type EmptyDayInput = {
  dayType: "WORKING" | "WEEKEND" | "HOLIDAY";
  /** an approved leave covers the day */
  onLeave: boolean;
  /** the day is after today */
  isFuture: boolean;
  isToday: boolean;
  /** today's shift has ended (only meaningful when isToday) */
  shiftOver: boolean;
  /** somebody has an attendance record on this day: the day was processed at all */
  dayHasRecords: boolean;
};

export type EmptyDayStatus =
  | "WEEKEND"
  | "HOLIDAY"
  | "ON_LEAVE"
  | "NOT_IN"
  | "ABSENT"
  | "NO_RECORD";

export function statusWithoutRecord(i: EmptyDayInput): EmptyDayStatus {
  if (i.dayType === "WEEKEND") return "WEEKEND";
  if (i.dayType === "HOLIDAY") return "HOLIDAY";
  if (i.onLeave) return "ON_LEAVE";
  if (i.isFuture) return "NO_RECORD";
  // Today, during the shift: nobody can be called absent yet, they may still arrive.
  if (i.isToday && !i.shiftOver) return "NOT_IN";
  // The day is over. Without any record for anybody it was never processed (before the system
  // or an import started), so "absent" would be a guess.
  return i.dayHasRecords ? "ABSENT" : "NO_RECORD";
}

/** Short text for the Remarks column of a row that has no record. */
export function emptyDayNote(status: EmptyDayStatus): string | null {
  switch (status) {
    case "NOT_IN":
      return "No punch yet today";
    case "ABSENT":
      return "No punch recorded";
    case "ON_LEAVE":
      return "Approved leave";
    default:
      return null;
  }
}
