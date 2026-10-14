import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listDesignations } from "@/services/designation.service";
import SimpleForm from "@/components/SimpleForm";
import RowActionForm from "@/components/RowActionForm";
import {
  createDesignationAction,
  deleteDesignationAction,
  updateDesignationAction,
} from "./actions";

export default async function DesignationsPage() {
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE);
  const designations = await listDesignations();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Designations</h1>

      <section className="max-w-md rounded border bg-white p-4">
        <h2 className="mb-3 font-medium">Add designation</h2>
        <SimpleForm
          action={createDesignationAction}
          resetOnSuccess
          submitLabel="Add designation"
          fields={[{ name: "title", label: "Title", required: true }]}
        />
      </section>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Employees</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {designations.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-zinc-500">
                  No designations yet.
                </td>
              </tr>
            )}
            {designations.map((d) => (
              <tr key={d.id} className="border-t align-top">
                <td className="p-3 font-medium">{d.title}</td>
                <td className="p-3">{d._count.employees}</td>
                <td className="space-y-2 p-3">
                  <details>
                    <summary className="cursor-pointer text-xs underline">Edit</summary>
                    <div className="mt-2 max-w-xs">
                      <SimpleForm
                        action={updateDesignationAction}
                        submitLabel="Save"
                        hidden={{ id: d.id }}
                        fields={[
                          { name: "title", label: "Title", required: true, defaultValue: d.title },
                        ]}
                      />
                    </div>
                  </details>
                  <RowActionForm
                    action={deleteDesignationAction}
                    id={d.id}
                    label="Delete"
                    danger
                    confirmMessage={`Delete designation "${d.title}"?`}
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