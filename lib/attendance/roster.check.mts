// Run:  npx tsx lib/attendance/roster.check.mts
import assert from "node:assert/strict";
import { statusWithoutRecord as s, emptyDayNote, type EmptyDayInput } from "./roster.ts";

const base: EmptyDayInput = { dayType: "WORKING", onLeave: false, isFuture: false, isToday: false, shiftOver: false, dayHasRecords: true };
const t = (o: Partial<EmptyDayInput>) => s({ ...base, ...o });

assert.equal(t({ isToday: true, shiftOver: false }), "NOT_IN");              // during the shift: not absent yet
assert.equal(t({ isToday: true, shiftOver: true }), "ABSENT");               // shift over: absent
assert.equal(t({}), "ABSENT");                                                // a past day with records
assert.equal(t({ dayHasRecords: false }), "NO_RECORD");                       // a day that was never processed
assert.equal(t({ isFuture: true }), "NO_RECORD");                              // future
assert.equal(t({ dayType: "WEEKEND" }), "WEEKEND");
assert.equal(t({ dayType: "HOLIDAY", onLeave: true }), "HOLIDAY");            // a holiday wins over leave
assert.equal(t({ onLeave: true, isToday: true }), "ON_LEAVE");                // leave wins over "not in yet"
assert.equal(t({ onLeave: true, isFuture: true }), "ON_LEAVE");               // leave shows on a future day too
assert.equal(t({ dayType: "WEEKEND", isToday: true }), "WEEKEND");
assert.equal(emptyDayNote("NOT_IN"), "No punch yet today");
assert.equal(emptyDayNote("WEEKEND"), null);
console.log("roster: all checks passed");
