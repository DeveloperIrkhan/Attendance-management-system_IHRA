import SimpleForm from "@/components/SimpleForm";
import {
  listActingApprovers,
  listActingCandidates,
  listDdEmployees,
  listDepartmentsWithApprovers,
} from "@/services/department.service";
import {
  addActingApproverAction,
  addDepartmentChargeAction,
  createDepartmentActionAsync,
  deleteDepartmentAction,
  removeActingApproverAction,
  removeDepartmentChargeAction,
  updateDepartmentAction,
} from "./actions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import RowActionForm from "@/components/RowActionForm";
import { requirePermission } from "@/lib/auth/authorization";

export default async function DepartmentsPage() {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const [departments, ddEmployees, actingApprovers, actingCandidates] =
    await Promise.all([
      listDepartmentsWithApprovers(),
      listDdEmployees(),
      listActingApprovers(),
      listActingCandidates(),
    ]);

  return (
    <div className="w-full">
      <h1 className="text-xl font-semibold p-2 text-green-800">
        IHRA Department
      </h1>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center w-full">
          <section className=" flex items-center justify-center rounded-md bg-white p-4 shadow-xl w-full md:max-w-md">
            <div className="max-w-md">
              <h2 className="mb-3 font-medium">Add department</h2>
              <SimpleForm
                action={createDepartmentActionAsync}
                resetOnSuccess
                submitLabel="Add department"
                fields={[
                  { name: "name", label: "Name", required: true },
                  { name: "description", label: "Description" },
                ]}
              />
            </div>
          </section>
        </div>

        <section className="rounded-md bg-white p-4 shadow-lg">
          <h2 className="font-medium">Acting CEO / Chairman</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Use this while the CEO or Chairman post is vacant. A DD (or the
            acting CEO for Chairman) who acts at that level approves the
            requests routed to it, and sees the whole organization&apos;s
            attendance. Remove the role when the post is filled.
          </p>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Currently acting</h3>
              {actingApprovers.length === 0 ? (
                <p className="text-sm text-zinc-500">Nobody is acting.</p>
              ) : (
                <ul className="space-y-2">
                  {actingApprovers.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-x-3 text-sm"
                    >
                      <span>
                        <span className="font-medium">
                          {a.level === "CEO" ? "Acting CEO" : "Acting Chairman"}
                        </span>
                        : {a.employee.name}{" "}
                        <span className="text-xs text-zinc-500">
                          ({a.employee.designation?.title ?? "No designation"},{" "}
                          {a.employee.department.name})
                        </span>
                        {(!a.employee.isActive ||
                          !a.employee.user?.isActive) && (
                          <span className="ml-2 text-xs text-amber-700">
                            inactive or no login
                          </span>
                        )}
                      </span>
                      <RowActionForm
                        action={removeActingApproverAction}
                        id={a.id}
                        label="Remove"
                        danger
                        confirmMessage={`Remove ${a.employee.name} as acting ${a.level === "CEO" ? "CEO" : "Chairman"}?`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="max-w-sm">
              <h3 className="mb-2 text-sm font-medium">Assign</h3>
              <SimpleForm
                action={addActingApproverAction}
                resetOnSuccess
                submitLabel="Assign"
                fields={[
                  {
                    name: "level",
                    label: "Acting as",
                    required: true,
                    options: [
                      { value: "CEO", label: "CEO" },
                      { value: "CHAIRMAN", label: "Chairman" },
                    ],
                  },
                  {
                    name: "employeeId",
                    label: "Employee",
                    required: true,
                    options: [
                      { value: "", label: "Select an employee" },
                      ...actingCandidates.map((e) => ({
                        value: e.id,
                        label: `${e.name} (${e.designation?.title ?? "No designation"}, ${e.department.name})`,
                      })),
                    ],
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <div className="overflow-x-auto rounded-md shadow-lg p-3 flex-1 bg-white">
          <h2 className="mb-3 font-medium">Departments List</h2>
          <table className="w-full text-sm">
            <thead className="bg-green-800 text-white rounded-t-md text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Description</th>
                <th className="p-3">Employees</th>
                <th className="p-3">Leave approver (DD)</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">
                    No departments yet.
                  </td>
                </tr>
              )}
              {departments.map((d) => (
                <tr key={d.id} className="border-t align-top">
                  <td className="p-3 font-medium">{d.name}</td>
                  <td className="p-3 text-zinc-600">{d.description ?? "-"}</td>
                  <td className="p-3">{d._count.employees}</td>
                  <td className="p-3">
                    <p className="text-xs text-zinc-500">
                      DD of this department
                    </p>
                    <p>
                      {d.employees.length > 0
                        ? d.employees.map((e) => e.name).join(", ")
                        : "None"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Additional charge DD
                    </p>
                    {d.chargeHolders.length === 0 ? (
                      <p>None</p>
                    ) : (
                      <ul className="space-y-1">
                        {d.chargeHolders.map((c) => (
                          <li
                            key={c.id}
                            className="flex flex-wrap items-center gap-x-3"
                          >
                            <span>
                              {c.employee.name}{" "}
                              <span className="text-xs text-zinc-500">
                                ({c.employee.department.name})
                              </span>
                            </span>
                            <RowActionForm
                              action={removeDepartmentChargeAction}
                              id={c.id}
                              label="Remove"
                              danger
                              confirmMessage={`Remove ${c.employee.name}'s additional charge of ${d.name}?`}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.employees.length === 0 &&
                      d.chargeHolders.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          No approver: short leaves go to the CEO.
                        </p>
                      )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs underline">
                        Add additional charge
                      </summary>
                      <div className="mt-2 max-w-xs">
                        <SimpleForm
                          action={addDepartmentChargeAction}
                          resetOnSuccess
                          submitLabel="Give charge"
                          hidden={{ id: d.id }}
                          fields={[
                            {
                              name: "employeeId",
                              label: "DD",
                              required: true,
                              options: [
                                { value: "", label: "Select a DD" },
                                ...ddEmployees
                                  .filter((e) => e.departmentId !== d.id)
                                  .map((e) => ({
                                    value: e.id,
                                    label: `${e.name} (${e.department.name})`,
                                  })),
                              ],
                            },
                          ]}
                        />
                      </div>
                    </details>
                  </td>
                  <td className="space-y-2 p-3">
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Edit
                      </summary>
                      <div className="mt-2 max-w-xs">
                        <SimpleForm
                          action={updateDepartmentAction}
                          submitLabel="Save"
                          hidden={{ id: d.id }}
                          fields={[
                            {
                              name: "name",
                              label: "Name",
                              required: true,
                              defaultValue: d.name,
                            },
                            {
                              name: "description",
                              label: "Description",
                              defaultValue: d.description ?? "",
                            },
                          ]}
                        />
                      </div>
                    </details>
                    <RowActionForm
                      action={deleteDepartmentAction}
                      id={d.id}
                      label="Delete"
                      danger
                      confirmMessage={`Delete department "${d.name}"?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
