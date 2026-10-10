
import * as XLSX from "xlsx";

export type RawAttendanceRow = {
  biometricId: string;
  employeeName: string;
  date: Date;
  clockIn: string | null;
  clockOut: string | null;
  rawAbsent: string | null;
  department: string | null;
  workTime: string | null;
  rawRow: Record<string, unknown>;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getValue(
  row: Record<string, unknown>,
  ...names: string[]
): unknown {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [
      normalizeHeader(key),
      value,
    ])
  );

  for (const name of names) {
    const value = normalized.get(normalizeHeader(name));

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  if (typeof value === "string" && value.trim()) {
    const text = value.trim();

    // Supports dates such as 6/1/2026 (month/day/year).
    const match = text.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    );

    if (match) {
      const month = Number(match[1]);
      const day = Number(match[2]);
      const year = Number(match[3]);

      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date;
      }

      return null;
    }
  }

  return null;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value).trim();
}

export function parseAttendanceExcel(
  buffer: Buffer
): RawAttendanceRow[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("The Excel file contains no worksheet.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    sheet,
    { defval: null, raw: true }
  );

  return rows.map((row, index) => {
    const biometricId = toText(
      getValue(row, "AC-No.", "AC No", "Biometric ID")
    );

    const employeeName = toText(getValue(row, "Name"));

    const date = parseExcelDate(getValue(row, "Date"));

    if (!biometricId || !employeeName || !date) {
      throw new Error(
        `Invalid employee ID, name, or date on spreadsheet row ${index + 2}.`
      );
    }

    return {
      biometricId,
      employeeName,
      date,
      clockIn: toText(getValue(row, "Clock In")),
      clockOut: toText(getValue(row, "Clock Out")),
      rawAbsent: toText(getValue(row, "Absent")),
      department: toText(getValue(row, "Department")),
      workTime: toText(getValue(row, "Work Time")),
      rawRow: row,
    };
  });
}
