import SimpleForm from "@/components/SimpleForm";
import { requirePermission } from "@/lib/auth/authorization";
import { listDepartments } from "@/services/department.service";
import { createDepartmentActionAsync, deleteDepartmentAction, updateDepartmentAction } from "./actions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import RowActionForm from "@/components/RowActionForm";

export default async function DepartmentsPage() {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const departments = await listDepartments();

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Departments</h1>

      <section className="max-w-md rounded border bg-white p-4">
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
      </section>

      <div className="overflow-x-auto rounded border bg-white">
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
                    <summary className="cursor-pointer text-xs underline">Edit</summary>
                    <div className="mt-2 max-w-xs">
                      <SimpleForm
                        action={updateDepartmentAction}
                        submitLabel="Save"
                        hidden={{ id: d.id }}
                        fields={[
                          { name: "name", label: "Name", required: true, defaultValue: d.name },
                          { name: "description", label: "Description", defaultValue: d.description ?? "" },
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
  );
}