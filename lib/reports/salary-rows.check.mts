// Run:  npx tsx lib/reports/salary-rows.check.mts
import assert from "node:assert/strict";
import { addSalaryDay, emptySalaryCounters, salaryCells, ddmmyyyy, dayStatusText, type DayRecord } from "./salary-rows.ts";

const min = (n: number) => (n > 0 ? `${n}m` : "-");
const rec = (status: string, o: Partial<DayRecord> = {}): DayRecord => ({ status, lateMinutes: 0, overtimeMinutes: 0, workingMinutes: 0, ...o });

// one day
let c = emptySalaryCounters();
addSalaryDay(c, rec("SHORT_LEAVE", { lateMinutes: 59, workingMinutes: 18 }));
assert.deepEqual(salaryCells(c, min), ["1", "0", "1", "0", "0", "0", "0", "59m", "-", "18m"]);

// a day without a record adds nothing, weekly off / holiday add no working day
c = emptySalaryCounters();
addSalaryDay(c, null); addSalaryDay(c, rec("WEEKEND")); addSalaryDay(c, rec("HOLIDAY"));
assert.deepEqual(salaryCells(c, min), ["0", "0", "0", "0", "0", "0", "0", "-", "-", "-"]);

// the totals of the days equal what the monthly summary would give
c = emptySalaryCounters();
[rec("PRESENT", { workingMinutes: 480, overtimeMinutes: 30 }), rec("ABSENT"), rec("ON_LEAVE"), rec("INCOMPLETE"),
 rec("HALF_DAY", { lateMinutes: 200 }), rec("SHORT_LEAVE", { lateMinutes: 59, workingMinutes: 18 }), rec("WEEKEND"), null]
  .forEach((r) => addSalaryDay(c, r));
assert.deepEqual(salaryCells(c, min), ["6", "1", "1", "1", "1", "1", "1", "259m", "30m", "498m"]);
assert.equal(c.working, c.present + c.shortLeave + c.halfDay + c.missingPunch + c.absent + c.onLeave); // every working day has one status

// dates and status text
assert.equal(ddmmyyyy(new Date(Date.UTC(2026, 10, 1))), "01/11/2026");
assert.equal(ddmmyyyy(new Date(Date.UTC(2026, 11, 31))), "31/12/2026");
const lab = (s: string) => s.toLowerCase();
assert.equal(dayStatusText(rec("ABSENT"), "WORKING", lab), "absent");
assert.equal(dayStatusText(null, "WEEKEND", lab), "Weekly off");
assert.equal(dayStatusText(null, "HOLIDAY", lab), "Holiday");
assert.equal(dayStatusText(null, "WORKING", lab), "No record");
assert.equal(dayStatusText(rec("PRESENT"), "WEEKEND", lab), "present"); // worked on a weekly off
console.log("salary-rows: all checks passed");
