import SimpleForm from "@/components/SimpleForm";
import { requirePermission } from "@/lib/auth/authorization";
import { listDepartments } from "@/services/department.service";
import {
  createDepartmentActionAsync,
  deleteDepartmentAction,
  updateDepartmentAction,
} from "./actions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import RowActionForm from "@/components/RowActionForm";

export default async function DepartmentsPage() {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const departments = await listDepartments();

  return (
    <div className="w-full">
      <h1 className="text-xl font-semibold p-2 text-green-800">IHRA Department</h1>
      <div className="flex justify-center items-start gap-3 md:flex-row flex-col">
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

        <div className="overflow-x-auto rounded-md shadow-lg p-3 flex-1 bg-white">
           <h2 className="mb-3 font-medium">Departments List</h2>
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Description</th>
                <th className="p-3">Employees</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-zinc-500">
                    No departments yet.
                  </td>
                </tr>
              )}
              {departments.map((d) => (
                <tr key={d.id} className="border-t align-top">
                  <td className="p-3 font-medium">{d.name}</td>
                  <td className="p-3 text-zinc-600">{d.description ?? "-"}</td>
                  <td className="p-3">{d._count.employees}</td>
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
