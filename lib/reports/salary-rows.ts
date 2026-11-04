// Day-by-day rows for the salary attendance sheet. Pure functions, no database.
// The counting rules are the same as the monthly summary, so the totals of this sheet
// always equal the monthly attendance report for the same period:
//   - a day counts as a working day when it has a record that is not Weekly off or Holiday
//   - Missing punch is counted on its own (HR decides how it is paid)
//   - late, overtime and worked minutes are summed as saved on the record

export type DayRecord = {
  status: string;
  lateMinutes: number;
  overtimeMinutes: number;
  workingMinutes: number;
};

export type SalaryCounters = {
  working: number;
  present: number;
  shortLeave: number;
  halfDay: number;
  missingPunch: number;
  absent: number;
  onLeave: number;
  lateMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number;
};

export const emptySalaryCounters = (): SalaryCounters => ({
  working: 0,
  present: 0,
  shortLeave: 0,
  halfDay: 0,
  missingPunch: 0,
  absent: 0,
  onLeave: 0,
  lateMinutes: 0,
  overtimeMinutes: 0,
  workedMinutes: 0,
});

/** Adds one day to the counters. A day without a record adds nothing. */
export function addSalaryDay(c: SalaryCounters, rec: DayRecord | null): void {
  if (!rec) return;
  if (rec.status !== "WEEKEND" && rec.status !== "HOLIDAY") c.working++;
  switch (rec.status) {
    case "PRESENT":
      c.present++;
      break;
    case "SHORT_LEAVE":
      c.shortLeave++;
      break;
    case "HALF_DAY":
      c.halfDay++;
      break;
    case "INCOMPLETE":
      c.missingPunch++;
      break;
    case "ABSENT":
      c.absent++;
      break;
    case "ON_LEAVE":
      c.onLeave++;
      break;
  }
  c.lateMinutes += rec.lateMinutes;
  c.overtimeMinutes += rec.overtimeMinutes;
  c.workedMinutes += rec.workingMinutes;
}

/** The ten number columns, in the order of the sheet: working days ... worked. */
export function salaryCells(
  c: SalaryCounters,
  minutes: (n: number) => string,
): string[] {
  return [
    String(c.working),
    String(c.present),
    String(c.shortLeave),
    String(c.halfDay),
    String(c.missingPunch),
    String(c.absent),
    String(c.onLeave),
    minutes(c.lateMinutes),
    minutes(c.overtimeMinutes),
    minutes(c.workedMinutes),
  ];
}

/** dd/mm/yyyy from a UTC-midnight date, as HR writes it. */
export function ddmmyyyy(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** What the Status column says for a day. */
export function dayStatusText(
  rec: DayRecord | null,
  dayType: "WORKING" | "WEEKEND" | "HOLIDAY",
  label: (status: string) => string,
): string {
  if (rec) return label(rec.status);
  if (dayType === "WEEKEND") return "Weekly off";
  if (dayType === "HOLIDAY") return "Holiday";
  return "No record";
}
