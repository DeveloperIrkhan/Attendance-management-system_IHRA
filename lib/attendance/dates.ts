export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  //Validate the date format using Regex and will aspect
  // date in this format YYYY-MM-DD
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!date) return null;

  //   [
  //   "2026-10-19", // date[0]: entire matched string
  //   "2026",       // date[1]: year
  //   "10",         // date[2]: month
  //   "19"          // date[3]: day
  // ]
  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);
  // month - 1 is because JavaScript numbers months from 0 to 11
  const aspectedDate = new Date(Date.UTC(year, month - 1, day));

  return aspectedDate.getUTCFullYear() === year &&
    aspectedDate.getUTCMonth() === month - 1 &&
    aspectedDate.getUTCDate() === day
    ? aspectedDate
    : null;
}

export function parseMonthParam(
  value: string | null | undefined,
): { year: number; month: number } | null {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 && year >= 2000 && year <= 2100
    ? { year, month }
    : null;
}

export const monthParam = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;
export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

//Time stored as office clock time written as UTC in this format HH:MM
export function clockText(d: Date | null): string {
  if (!d) return "-";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
