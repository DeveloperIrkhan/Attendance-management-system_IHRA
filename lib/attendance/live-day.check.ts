// Run:  npx tsx lib/attendance/live-day.check.ts   (try it with TZ=Asia/Karachi and with TZ=UTC)
import assert from "node:assert/strict";
import { evaluateDay, toRuleConfig } from "./attendance-rules";
import { toOfficeClock, parseDeviceTimeMode } from "./office-clock";
import { evaluateLiveDay } from "./live-day";

const cfg = toRuleConfig({ shiftStart: "08:00", shiftEnd: "16:00", graceMinutes: 15, halfDayAfterMinutes: 180, duplicatePunchMinutes: 15, earliestPunch: "07:00", latestPunch: "22:00", overtimeMinMinutes: 0, offDayWorkIsOvertime: false });
const m = (h: number, mm = 0) => h * 60 + mm;

// 1) The reported bug: server is UTC+5, device shows 08:12. The library's Date is the instant 03:12Z.
const wrong = new Date("2026-10-28T03:12:00.000Z");            // what the library gave (+05:00 server)
const asStored = wrong.getUTCHours() * 60 + wrong.getUTCMinutes();
const r1 = evaluateDay({ dayType: "WORKING", punches: [asStored] }, cfg);
console.log("BUG  : stored 03:12 ->", r1.status, "|", r1.remarks);
assert.equal(r1.status, "ABSENT");

// 2) toOfficeClock: run this file with TZ=Asia/Karachi to prove it (checked below)
const device = new Date(2026, 9, 28, 8, 12, 0);                 // device 08:12, built with local parts
const fixed = toOfficeClock(device, "local");
console.log("FIXED:", fixed.toISOString(), "(TZ =", process.env.TZ ?? "system", ")");
assert.equal(fixed.toISOString(), "2026-10-28T08:12:00.000Z");
assert.equal(toOfficeClock(new Date("2026-10-28T08:12:00.000Z"), "utc").toISOString(), "2026-10-28T08:12:00.000Z");
assert.equal(parseDeviceTimeMode("UTC"), "utc");
assert.equal(parseDeviceTimeMode(undefined), "local");

// 3) live day: lone check-in during the day
const early = evaluateLiveDay({ dayType: "WORKING", punches: [m(8, 5)], isToday: true, nowMinutes: m(11) }, cfg);
console.log("LIVE 08:05 at 11:00 ->", early.result.status, early.note);
assert.equal(early.result.status, "PRESENT"); assert.equal(early.result.checkOut, null); assert.equal(early.result.workingMinutes, 0);
const late = evaluateLiveDay({ dayType: "WORKING", punches: [m(9, 30)], isToday: true, nowMinutes: m(12) }, cfg);
console.log("LIVE 09:30 at 12:00 ->", late.result.status, "late", late.result.lateMinutes);
assert.equal(late.result.status, "SHORT_LEAVE"); assert.equal(late.result.lateMinutes, 90);
const half = evaluateLiveDay({ dayType: "WORKING", punches: [m(11, 20)], isToday: true, nowMinutes: m(13) }, cfg);
assert.equal(half.result.status, "HALF_DAY");
// after the shift ends a lone punch is a real missing punch again
const after = evaluateLiveDay({ dayType: "WORKING", punches: [m(8, 5)], isToday: true, nowMinutes: m(16, 30) }, cfg);
assert.equal(after.result.status, "INCOMPLETE"); assert.equal(after.note, null);
// a past day is never provisional
const past = evaluateLiveDay({ dayType: "WORKING", punches: [m(8, 5)], isToday: false, nowMinutes: m(11) }, cfg);
assert.equal(past.result.status, "INCOMPLETE");
// two punches behave as before
const two = evaluateLiveDay({ dayType: "WORKING", punches: [m(8, 5), m(16, 10)], isToday: true, nowMinutes: m(17) }, cfg);
assert.equal(two.result.status, "PRESENT"); assert.equal(two.note, null);
// weekly off day with one punch is not touched
const off = evaluateLiveDay({ dayType: "WEEKEND", punches: [m(9)], isToday: true, nowMinutes: m(10) }, cfg);
assert.equal(off.note, null);
console.log("live-day + office-clock: all checks passed");
