// Run:  node --experimental-strip-types lib/attendance/leave-sync.check.mts
import assert from "node:assert/strict";
import { planLeaveSync, LEAVE_REMARK, type ExistingRow } from "./leave-sync.ts";

const D = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
// Mon 2026-10-26 .. Sun 2026-11-01 ; Saturday 31 Oct and Sunday 1 Nov are off
const dayTypeOf = (ms: number) => ([0, 6].includes(new Date(ms).getUTCDay()) ? "WEEKEND" : "WORKING") as "WEEKEND" | "WORKING";
const row = (o: Partial<ExistingRow>): ExistingRow => ({ status: "ABSENT", isManual: false, hasCheckIn: false, remarks: null, ...o });
const base = { shiftEndMinutes: 16 * 60, joiningMs: null, dayTypeOf };

// approval after the fact: Mon-Wed leave, today is Thu 29 Oct after shift end
let p = planLeaveSync({ ...base, fromMs: day("2026-10-26"), toMs: day("2026-10-28"), todayMs: day("2026-10-29"), nowMinutes: 17 * 60,
  leaves: [{ startMs: day("2026-10-26"), endMs: day("2026-10-28") }],
  rows: new Map([["2026-10-26", row({ status: "ABSENT" })], ["2026-10-27", row({ status: "INCOMPLETE", hasCheckIn: true })], ["2026-10-28", row({ status: "PRESENT", hasCheckIn: true })]]) });
assert.deepEqual(p.toOnLeave.map((x) => x.dateMs), [day("2026-10-26"), day("2026-10-27")]); // absent + missing punch become on leave
assert.equal(p.create.length, 0); // present day is left alone

// no row yet, leave covers today before shift end -> a row is created now
p = planLeaveSync({ ...base, fromMs: day("2026-10-29"), toMs: day("2026-10-30"), todayMs: day("2026-10-29"), nowMinutes: 9 * 60,
  leaves: [{ startMs: day("2026-10-29"), endMs: day("2026-10-30") }], rows: new Map() });
assert.deepEqual(p.create.map((x) => x.dateMs), [day("2026-10-29")]); // tomorrow is not written yet

// future days are not written at all
p = planLeaveSync({ ...base, fromMs: day("2026-11-02"), toMs: day("2026-11-04"), todayMs: day("2026-10-29"), nowMinutes: 9 * 60,
  leaves: [{ startMs: day("2026-11-02"), endMs: day("2026-11-04") }], rows: new Map() });
assert.equal(p.create.length + p.toOnLeave.length, 0);

// weekends / holidays inside a leave are skipped
p = planLeaveSync({ ...base, fromMs: day("2026-10-29"), toMs: day("2026-11-01"), todayMs: day("2026-11-01"), nowMinutes: 17 * 60,
  leaves: [{ startMs: day("2026-10-29"), endMs: day("2026-11-01") }], rows: new Map() });
assert.deepEqual(p.create.map((x) => x.dateMs), [day("2026-10-29"), day("2026-10-30")]); // Thu, Fri only

// manual rows are never changed
p = planLeaveSync({ ...base, fromMs: day("2026-10-26"), toMs: day("2026-10-26"), todayMs: day("2026-10-29"), nowMinutes: 17 * 60,
  leaves: [{ startMs: day("2026-10-26"), endMs: day("2026-10-26") }], rows: new Map([["2026-10-26", row({ isManual: true })]]) });
assert.equal(p.toOnLeave.length, 0);

// before the joining date: nothing
p = planLeaveSync({ ...base, joiningMs: day("2026-10-28"), fromMs: day("2026-10-26"), toMs: day("2026-10-27"), todayMs: day("2026-10-29"), nowMinutes: 17 * 60,
  leaves: [{ startMs: day("2026-10-26"), endMs: day("2026-10-27") }], rows: new Map() });
assert.equal(p.create.length, 0);

// leave cancelled: the on-leave rows go back
const onLeave = (o: Partial<ExistingRow> = {}) => row({ status: "ON_LEAVE", remarks: `${LEAVE_REMARK}; Source: uFace800`, ...o });
p = planLeaveSync({ ...base, fromMs: day("2026-10-27"), toMs: day("2026-10-29"), todayMs: day("2026-10-29"), nowMinutes: 9 * 60,
  leaves: [], rows: new Map([["2026-10-27", onLeave()], ["2026-10-28", onLeave({ hasCheckIn: true })], ["2026-10-29", onLeave()]]) });
assert.deepEqual(p.toAbsent.map((x) => x.dateMs), [day("2026-10-27")]);      // past day, no check-in -> absent
assert.deepEqual(p.toIncomplete.map((x) => x.dateMs), [day("2026-10-28")]);  // had a check-in -> missing punch
assert.deepEqual(p.remove.map((x) => x.dateMs), [day("2026-10-29")]);        // today, shift not over -> removed
// an on-leave row that did not come from a leave is kept
p = planLeaveSync({ ...base, fromMs: day("2026-10-27"), toMs: day("2026-10-27"), todayMs: day("2026-10-29"), nowMinutes: 17 * 60,
  leaves: [], rows: new Map([["2026-10-27", row({ status: "ON_LEAVE", remarks: "HR set" })]]) });
assert.equal(p.toAbsent.length + p.remove.length + p.toIncomplete.length, 0);
// two leaves back to back are both honoured
p = planLeaveSync({ ...base, fromMs: day("2026-10-26"), toMs: day("2026-10-27"), todayMs: day("2026-10-29"), nowMinutes: 17 * 60,
  leaves: [{ startMs: day("2026-10-26"), endMs: day("2026-10-26") }, { startMs: day("2026-10-27"), endMs: day("2026-10-27") }], rows: new Map() });
assert.equal(p.create.length, 2);
console.log("leave-sync: all checks passed");
