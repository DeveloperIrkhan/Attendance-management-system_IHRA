import * as XLSX from "xlsx";
import { normalizeBiometricId } from "./biometric-id";

/** Fatal problem with the file itself (unreadable, wrong layout). */
export class ExcelFileError extends Error {}

export type ParsedRow = {
  rowNumber: number; // real Excel row number
  biometricId: string; // normalized
  employeeName: string | null;
  date: Date; // UTC midnight
  clockIn: string | null; // "HH:mm"
  clockOut: string | null; // "HH:mm"
  absent: boolean | null;
  workTime: string | null;
  attTime: string | null;
  punches: string | null;
  rawRow: Record<string, unknown>;
};

export type ParseIssue = {
  rowNumber: number | null;
  column: string | null;
  message: string;
};

export type ParseResult = {
  sheetName: string;
  totalRows: number; // non-blank data rows
  rows: ParsedRow[];
  issues: ParseIssue[];
};

type HeaderKey =
  | "biometricId" | "name" | "date" | "clockIn" | "clockOut"
  | "absent" | "workTime" | "attTime" | "punches";

const HEADERS: Record<HeaderKey, { label: string; aliases: string[] }> = {
  biometricId: { label: "AC-No.", aliases: ["acno", "biometricid"] },
  name: { label: "Name", aliases: ["name", "employeename"] },
  date: { label: "Date", aliases: ["date"] },
  clockIn: { label: "Clock In", aliases: ["clockin"] },
  clockOut: { label: "Clock Out", aliases: ["clockout"] },
  absent: { label: "Absent", aliases: ["absent"] },
  workTime: { label: "Work Time", aliases: ["worktime"] },
  attTime: { label: "Att. Time", aliases: ["atttime"] },
  punches: { label: "Punches", aliases: ["punches"] },
};

const REQUIRED: HeaderKey[] = ["biometricId", "date", "clockIn", "clockOut"];
const MAX_ROWS = 50_000;

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumns(headerRow: unknown[]): Partial<Record<HeaderKey, number>> {
  const normalized = headerRow.map(normalizeHeader);
  const result: Partial<Record<HeaderKey, number>> = {};
  for (const key of Object.keys(HEADERS) as HeaderKey[]) {
    const idx = normalized.findIndex((h) => HEADERS[key].aliases.includes(h));
    if (idx >= 0) result[key] = idx;
  }
  return result;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function toText(v: unknown): string | null {
  return isEmpty(v) ? null : String(v).trim();
}

function utcDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt
    : null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return utcDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") {
    const p = XLSX.SSF.parse_date_code(value);
    return p ? utcDate(p.y, p.m, p.d) : null;
  }
  if (typeof value === "string") {
    const text = value.trim();
    // month/day/year (same convention as your original parser)
    let m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return utcDate(Number(m[3]), Number(m[1]), Number(m[2]));
    m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return utcDate(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** null = empty cell, undefined = present but unreadable. */
function parseTime(value: unknown): string | null | undefined {
  if (isEmpty(value)) return null;
  if (value instanceof Date) return `${pad(value.getHours())}:${pad(value.getMinutes())}`;

  if (typeof value === "number") {
    if (value < 0) return undefined;
    if (value === 0) return null;
    // Excel stores time as a fraction of a day (0.5 = 12:00)
    const minutes = Math.round((value - Math.floor(value)) * 1440) % 1440;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (/^[-–—]+$/.test(text) || text.toLowerCase() === "n/a") return null;
    const m = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
    if (!m) return undefined;
    let h = Number(m[1]);
    const min = Number(m[2]);
    const meridiem = m[3]?.toLowerCase();
    if (min > 59) return undefined;
    if (meridiem) {
      if (h < 1 || h > 12) return undefined;
      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
    } else if (h > 23) {
      return undefined;
    }
    return `${pad(h)}:${pad(min)}`;
  }
  return undefined;
}

function parseBool(value: unknown): boolean | null {
  if (isEmpty(value)) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const t = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1", "absent"].includes(t)) return true;
  if (["false", "no", "n", "0", "present"].includes(t)) return false;
  return null;
}

export function parseAttendanceExcel(buffer: Buffer): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    throw new ExcelFileError("The file could not be read as an Excel workbook.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new ExcelFileError("The Excel file contains no worksheet.");

  // header:1 gives an array of arrays, so array index + 1 = real Excel row number
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  if (grid.length > MAX_ROWS) {
    throw new ExcelFileError(`The sheet has more than ${MAX_ROWS} rows.`);
  }

  // Find the header row (allow title rows above it)
  let headerIndex = -1;
  let cols: Partial<Record<HeaderKey, number>> = {};
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const found = findColumns(grid[i] ?? []);
    if (found.biometricId !== undefined && found.date !== undefined) {
      headerIndex = i;
      cols = found;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new ExcelFileError(
      "Could not find the header row. The first sheet must contain the columns: AC-No., Date, Clock In, Clock Out.",
    );
  }
  const missing = REQUIRED.filter((k) => cols[k] === undefined).map((k) => HEADERS[k].label);
  if (missing.length) {
    throw new ExcelFileError(`Missing required column(s): ${missing.join(", ")}.`);
  }

  const headerLabels = (grid[headerIndex] ?? []).map((v) => toText(v) ?? "");
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  let totalRows = 0;

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const rowNumber = i + 1;
    const at = (key: HeaderKey) => (cols[key] === undefined ? null : (row[cols[key]!] ?? null));

    // Skip rows with no ID, name or date at all (trailing formatting rows)
    if (isEmpty(at("biometricId")) && isEmpty(at("name")) && isEmpty(at("date"))) continue;
    totalRows++;

    const problems: ParseIssue[] = [];

    const rawId = toText(at("biometricId"));
    if (!rawId) {
      problems.push({ rowNumber, column: HEADERS.biometricId.label, message: "AC-No. is empty." });
    }

    const date = parseDate(at("date"));
    if (!date) {
      problems.push({
        rowNumber,
        column: HEADERS.date.label,
        message: `Invalid date "${toText(at("date")) ?? ""}".`,
      });
    }

    const clockIn = parseTime(at("clockIn"));
    if (clockIn === undefined) {
      problems.push({
        rowNumber,
        column: HEADERS.clockIn.label,
        message: `Unreadable time "${toText(at("clockIn"))}".`,
      });
    }
    const clockOut = parseTime(at("clockOut"));
    if (clockOut === undefined) {
      problems.push({
        rowNumber,
        column: HEADERS.clockOut.label,
        message: `Unreadable time "${toText(at("clockOut"))}".`,
      });
    }

    if (problems.length || !rawId || !date) {
      issues.push(...problems);
      continue;
    }

    const workTimeParsed = parseTime(at("workTime"));
    const rawRow: Record<string, unknown> = {};
    headerLabels.forEach((label, j) => {
      if (label) rawRow[label] = row[j] ?? null;
    });

    rows.push({
      rowNumber,
      biometricId: normalizeBiometricId(rawId),
      employeeName: toText(at("name")),
      date,
      clockIn: clockIn ?? null,
      clockOut: clockOut ?? null,
      absent: parseBool(at("absent")),
      workTime: workTimeParsed === undefined ? toText(at("workTime")) : workTimeParsed,
      attTime: toText(at("attTime")),
      punches: toText(at("punches")),
      rawRow,
    });
  }

  return { sheetName, totalRows, rows, issues };
}