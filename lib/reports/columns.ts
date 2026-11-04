// "Customized download": keep only the columns the person ticked. Pure functions, no database.
// Columns are chosen by position (0, 1, 2 ...) in the report, so two columns with the same
// heading can never be mixed up. The order of the report is always kept.
import type { ReportTable } from "./type";

/**
 * "0,2,5" -> [0, 2, 5]. Returns null when no list was given (= all columns), and an empty
 * array when a list was given but nothing valid is in it. Out-of-range or repeated numbers
 * are dropped.
 */
export function parseColumnList(
  value: string | null | undefined,
  columnCount: number,
): number[] | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const picked = new Set<number>();
  for (const part of value.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 0 && n < columnCount) picked.add(n);
  }
  return [...picked].sort((a, b) => a - b);
}

/** The same report with only the chosen columns: headings, every row, and the totals row. */
export function selectColumns(
  table: ReportTable,
  indexes: number[],
): ReportTable {
  const pick = (row: string[]) => indexes.map((i) => row[i] ?? "");
  return {
    ...table,
    column: indexes.map((i) => table.column[i]),
    rows: table.rows.map(pick),
    totals: table.totals ? pick(table.totals) : undefined,
  };
}
