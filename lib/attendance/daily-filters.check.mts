// Run:  npx tsx lib/attendance/daily-filters.check.mts
import assert from "node:assert/strict";
import { resolveDailyRange, dailyQuery, parseDailyStatus, parsePage } from "./daily-filters.ts";
import { toIsoDate } from "./dates.ts";

const latest = new Date(Date.UTC(2026, 9, 28));
const iso = (d: Date) => toIsoDate(d);

let r = resolveDailyRange({}, latest)!;                       // nothing -> latest day
assert.equal(r.mode, "day"); assert.equal(iso(r.start), "2026-10-28");
r = resolveDailyRange({ date: "2026-10-05" }, latest)!;       // one date
assert.equal(iso(r.start), "2026-10-05"); assert.equal(iso(r.end), "2026-10-05");
r = resolveDailyRange({ from: "2026-10-20", to: "2026-10-05" }, latest)!; // swapped range
assert.equal(r.mode, "range"); assert.equal(iso(r.start), "2026-10-05"); assert.equal(iso(r.end), "2026-10-20");
r = resolveDailyRange({ from: "2026-10-05" }, latest)!;       // one side only -> that day
assert.equal(iso(r.start), iso(r.end));
r = resolveDailyRange({ month: "2026-02" }, latest)!;          // month
assert.equal(r.mode, "month"); assert.equal(iso(r.start), "2026-02-01"); assert.equal(iso(r.end), "2026-02-28");
r = resolveDailyRange({ month: "2026-02", date: "2026-10-05" }, latest)!; // month beats date
assert.equal(r.mode, "month");
r = resolveDailyRange({ from: "2026-10-01", to: "2026-10-31", month: "2026-02" }, latest)!; // range beats month
assert.equal(r.mode, "range");
assert.equal(resolveDailyRange({ date: "garbage" }, null), null);            // nothing to show
r = resolveDailyRange({ date: "garbage" }, latest)!; assert.equal(iso(r.start), "2026-10-28");
r = resolveDailyRange({ from: "2020-01-01", to: "2026-10-28" }, latest)!;    // too long is clamped
assert.equal(r.clamped, true);
// status + page parsing is strict
assert.equal(parseDailyStatus("ABSENT"), "ABSENT"); assert.equal(parseDailyStatus("x; DROP"), "ALL");
assert.equal(parsePage("3"), 3); assert.equal(parsePage("-1"), 1); assert.equal(parsePage("abc"), 1);
// links keep every filter
r = resolveDailyRange({ from: "2026-10-05", to: "2026-10-20" }, latest)!;
assert.equal(dailyQuery(r, { department: "d1", status: "ABSENT", q: "ali", page: 2 }),
  "?from=2026-10-05&to=2026-10-20&department=d1&status=ABSENT&q=ali&page=2");
assert.equal(dailyQuery(resolveDailyRange({ date: "2026-10-05" }, null)!, {}), "?date=2026-10-05");
console.log("daily-filters: all checks passed");
