import assert from "node:assert/strict";
import { employeeWhereFor, resolveLeaveScope as scope } from "./data-scope.ts";

const base = { permissions: [] as string[], departmentId: "d1" };

// A DD with the plain EMPLOYEE role: their department, every status (the reported bug)
assert.deepEqual(scope({ ...base, permissions: ["leaves:request"], level: "DD" }), {
  kind: "DEPARTMENT",
  departmentId: "d1",
  departmentIds: ["d1"],
});

// Additional charge adds departments
assert.deepEqual(
  scope({ ...base, level: "DD", chargeDepartmentIds: ["d2", "d1"] }),
  { kind: "DEPARTMENT", departmentId: "d1", departmentIds: ["d1", "d2"] },
);

// HR (leaves:manage) and leaves:view see everyone
assert.deepEqual(scope({ ...base, permissions: ["leaves:manage"], level: "STAFF" }), { kind: "ALL" });
assert.deepEqual(scope({ ...base, permissions: ["leaves:view"], level: "STAFF" }), { kind: "ALL" });
// HR role wins over a DD designation
assert.deepEqual(scope({ ...base, permissions: ["leaves:manage"], level: "DD" }), { kind: "ALL" });

// CEO and Chairman see everyone by designation
assert.deepEqual(scope({ ...base, level: "CEO" }), { kind: "ALL" });
assert.deepEqual(scope({ ...base, level: "CHAIRMAN" }), { kind: "ALL" });

// IT officer: sees attendance of everyone, but NOT leave requests
assert.equal(
  scope({ ...base, permissions: ["attendance:view", "attendance:import"], level: "STAFF" }),
  null,
);
// Plain staff, and a DD login that is not linked to a department: no access
assert.equal(scope({ ...base, level: "STAFF" }), null);
assert.equal(scope({ permissions: [], level: "DD", departmentId: null }), null);

// A DD can never widen their scope through ?department=
const dd = scope({ ...base, level: "DD", chargeDepartmentIds: ["d2"] })!;
assert.deepEqual(employeeWhereFor(dd, "d9"), { departmentId: { in: ["d1", "d2"] } });
assert.deepEqual(employeeWhereFor(dd, "d2"), { departmentId: "d2" });

console.log("leave scope: all checks passed");
