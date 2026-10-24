// Run:  node --experimental-strip-types lib/leave/approval-routing.check.mts
import assert from "node:assert/strict";
import {
  canDecideRequest as can,
  levelsAbove,
  resolveApprovalRoute as route,
} from "./approval-routing.ts";

const level = (l: Parameters<typeof route>[0], d: number) =>
  route(l, d).approverLevel;

// Routing
assert.equal(level("STAFF", 1), "DD");
assert.equal(level("STAFF", 3), "DD");
assert.equal(level("STAFF", 4), "CEO");
assert.equal(route("STAFF", 2).sameDepartment, true);
assert.equal(route("STAFF", 5).sameDepartment, false);
assert.equal(level("DD", 3), "CEO");
assert.equal(level("DD", 4), "CHAIRMAN");
assert.equal(level("CEO", 1), "CHAIRMAN");
assert.equal(level("CEO", 10), "CHAIRMAN");
assert.equal(level("CHAIRMAN", 1), null);
assert.deepEqual(levelsAbove("DD"), ["CEO", "CHAIRMAN"]);
assert.deepEqual(levelsAbove("CHAIRMAN"), []);

// Who may decide
const ddReq = {
  employeeId: "e1",
  approverLevel: "DD" as const,
  approverDepartmentId: "d1",
};
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "DD" }, ddReq),
  true,
);
assert.equal(
  can({ employeeId: "x", departmentId: "d2", level: "DD" }, ddReq),
  false,
); // DD of another department
assert.equal(
  can({ employeeId: "e1", departmentId: "d1", level: "DD" }, ddReq),
  false,
); // own request
assert.equal(
  can({ employeeId: "x", departmentId: "d9", level: "CEO" }, ddReq),
  true,
); // parent rights
assert.equal(
  can({ employeeId: "x", departmentId: "d9", level: "CHAIRMAN" }, ddReq),
  true,
); // parent rights
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "STAFF" }, ddReq),
  false,
);
assert.equal(can(null, ddReq), false);

const ceoReq = {
  employeeId: "e1",
  approverLevel: "CEO" as const,
  approverDepartmentId: null,
};
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "CEO" }, ceoReq),
  true,
);
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "DD" }, ceoReq),
  false,
); // DD cannot go upwards
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "CHAIRMAN" }, ceoReq),
  true,
);
assert.equal(
  can({ employeeId: "e1", departmentId: "d1", level: "CEO" }, ceoReq),
  false,
); // CEO cannot approve own

const chReq = {
  employeeId: "e1",
  approverLevel: "CHAIRMAN" as const,
  approverDepartmentId: null,
};
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "CEO" }, chReq),
  false,
); // CEO cannot go upwards
assert.equal(
  can({ employeeId: "x", departmentId: "d1", level: "CHAIRMAN" }, chReq),
  true,
);

// Old requests with no route can be decided by nobody
assert.equal(
  can(
    { employeeId: "x", departmentId: "d1", level: "CHAIRMAN" },
    { ...ceoReq, approverLevel: null },
  ),
  false,
);

console.log("approval routing: all checks passed");
