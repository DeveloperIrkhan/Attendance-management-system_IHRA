// Run:  npx tsx lib/reports/columns.check.mts
import assert from "node:assert/strict";
import { parseColumnList, selectColumns } from "./columns.ts";

// parsing
assert.equal(parseColumnList(null, 5), null);                       // no list = all columns
assert.equal(parseColumnList("", 5), null);
assert.deepEqual(parseColumnList("0,2,4", 5), [0, 2, 4]);
assert.deepEqual(parseColumnList("4,0,2,2", 5), [0, 2, 4]);         // sorted, no repeats
assert.deepEqual(parseColumnList("1, 3", 5), [1, 3]);               // spaces are fine
assert.deepEqual(parseColumnList("0,9,-1,x,2.5", 5), [0]);          // bad numbers are dropped
assert.deepEqual(parseColumnList("9,x", 5), []);                     // a list with nothing valid
// selecting
const table = {
  title: "T", subtitle: "S",
  column: [{ label: "Code" }, { label: "Name" }, { label: "Absent", align: "right" as const }, { label: "Status" }],
  rows: [["01", "Abid", "1", "Absent"], ["02", "Irfan", "0", "Present"]],
  totals: ["", "Grand total", "1", ""],
  subtotalRows: [1], notes: ["n"],
};
const out = selectColumns(table, [0, 2]);
assert.deepEqual(out.column.map((c) => c.label), ["Code", "Absent"]);
assert.deepEqual(out.rows, [["01", "1"], ["02", "0"]]);
assert.deepEqual(out.totals, ["", "1"]);                             // totals follow the columns
assert.deepEqual(out.subtotalRows, [1]); assert.deepEqual(out.notes, ["n"]);
assert.equal(out.column[1].align, "right");                          // alignment kept
assert.equal(selectColumns({ ...table, totals: undefined }, [1]).totals, undefined);
assert.deepEqual(selectColumns({ ...table, rows: [["only one"]] }, [0, 3]).rows, [["only one", ""]]); // short rows are safe
console.log("columns: all checks passed");
