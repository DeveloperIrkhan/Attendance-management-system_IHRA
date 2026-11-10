// Run:  npx tsx lib/noc/flow.check.mts
import assert from "node:assert/strict";
import { startNocRoute, checkNocDecision, nocStatusLabel, parseNocCategory } from "./flow.ts";

// ---- where a request starts
assert.deepEqual(startNocRoute({ requesterLevel: "STAFF", hasDepartmentDd: true }), { status: "PENDING_DD", approverLevel: "DD" });
assert.deepEqual(startNocRoute({ requesterLevel: "STAFF", hasDepartmentDd: false }), { status: "PENDING_FINAL", approverLevel: "CEO" }); // no DD: straight to the CEO
assert.deepEqual(startNocRoute({ requesterLevel: "DD", hasDepartmentDd: true }), { status: "PENDING_FINAL", approverLevel: "CEO" });
assert.deepEqual(startNocRoute({ requesterLevel: "CEO", hasDepartmentDd: true }), { status: "PENDING_FINAL", approverLevel: "CHAIRMAN" });
assert.deepEqual(startNocRoute({ requesterLevel: "CHAIRMAN", hasDepartmentDd: false }), { status: "APPROVED", approverLevel: null });

const base = { isDesignatedApprover: true, isOwnRequest: false, deciderLevel: "DD" as const };
const ok = (r: ReturnType<typeof checkNocDecision>) => { assert.equal(r.ok, true); return (r as Extract<typeof r, { ok: true }>).next; };

// ---- the DD says yes: on to the CEO
let n = ok(checkNocDecision({ ...base, status: "PENDING_DD", decision: "YES" }));
assert.equal(n.status, "PENDING_FINAL"); assert.equal(n.approverLevel, "CEO"); assert.equal(n.recordsDd, true); assert.equal(n.recordsFinal, false);
// the DD says no: rejected, the CEO never sees it
n = ok(checkNocDecision({ ...base, status: "PENDING_DD", decision: "NO" }));
assert.equal(n.status, "REJECTED"); assert.equal(n.rejectedStage, "DD");
// the CEO (or acting CEO) answers at the DD step: that is the final answer, no second round
n = ok(checkNocDecision({ ...base, deciderLevel: "CEO", status: "PENDING_DD", decision: "YES" }));
assert.equal(n.status, "APPROVED"); assert.equal(n.recordsDd && n.recordsFinal, true);
// the CEO's yes / no at the final step
n = ok(checkNocDecision({ ...base, deciderLevel: "CEO", status: "PENDING_FINAL", decision: "YES" }));
assert.equal(n.status, "APPROVED"); assert.equal(n.recordsFinal, true); assert.equal(n.recordsDd, false);
n = ok(checkNocDecision({ ...base, deciderLevel: "CEO", status: "PENDING_FINAL", decision: "NO" }));
assert.equal(n.status, "REJECTED"); assert.equal(n.rejectedStage, "FINAL");

// ---- who may not decide
assert.equal(checkNocDecision({ ...base, isDesignatedApprover: false, status: "PENDING_DD", decision: "YES" }).ok, false);
assert.equal(checkNocDecision({ ...base, isOwnRequest: true, status: "PENDING_DD", decision: "YES" }).ok, false);   // never your own
for (const status of ["APPROVED", "ISSUED", "REJECTED", "CANCELLED"] as const) {
  assert.equal(checkNocDecision({ ...base, status, decision: "YES" }).ok, false);                                   // a finished request is closed
  assert.equal(checkNocDecision({ ...base, status, decision: "NO" }).ok, false);
}

// ---- cancelling: only the applicant, only while waiting
assert.equal(ok(checkNocDecision({ ...base, isDesignatedApprover: false, isOwnRequest: true, status: "PENDING_DD", decision: "CANCEL" })).status, "CANCELLED");
assert.equal(ok(checkNocDecision({ ...base, isDesignatedApprover: false, isOwnRequest: true, status: "PENDING_FINAL", decision: "CANCEL" })).status, "CANCELLED");
assert.equal(checkNocDecision({ ...base, isOwnRequest: true, status: "APPROVED", decision: "CANCEL" }).ok, false);
assert.equal(checkNocDecision({ ...base, isOwnRequest: false, status: "PENDING_DD", decision: "CANCEL" }).ok, false);

// ---- words
assert.equal(nocStatusLabel("PENDING_FINAL", "CHAIRMAN"), "Waiting for the Chairman");
assert.equal(nocStatusLabel("PENDING_FINAL", "CEO"), "Waiting for the CEO");
assert.equal(nocStatusLabel("ISSUED", null), "NOC issued");
assert.equal(parseNocCategory("Bank / loan"), "Bank / loan"); assert.equal(parseNocCategory("<script>"), "Other");
console.log("noc flow: all checks passed");
