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
    <div className="w-full">
      <h1 className="text-xl font-semibold p-2 text-green-800">Designations</h1>
      <div className="flex flex-col justify-center items-start gap-3">
        <div className="flex w-full justify-center">
          <section className="flex items-center justify-center rounded-md bg-white p-4 shadow-lg w-full md:max-w-md">
            <div className="max-w-md">
              <h2 className="mb-3 font-medium">Add designation</h2>
              <SimpleForm
                action={createDesignationAction}
                resetOnSuccess
                submitLabel="Add designation"
                fields={[{ name: "title", label: "Title", required: true }]}
              />
            </div>
          </section>
        </div>

        <div className="overflow-x-auto w-full rounded-md shadow-lg p-3 flex-1 bg-white">
          <h2 className="mb-3 font-medium">Designations List</h2>
          <table className="w-full text-sm">
            <thead className="bg-green-800 text-white text-left">
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
                    <div className="flex items-center gap-x-4">
                      <details className="">
                        <summary className="cursor-pointer text-xs underline">
                          Edit
                        </summary>
                        <div className="mt-2 max-w-xs">
                          <SimpleForm
                            action={updateDesignationAction}
                            submitLabel="Save"
                            hidden={{ id: d.id }}
                            fields={[
                              {
                                name: "title",
                                label: "Title",
                                required: true,
                                defaultValue: d.title,
                              },
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
                    </div>
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
