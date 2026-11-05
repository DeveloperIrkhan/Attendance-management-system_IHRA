import { requirePermission } from "@/lib/auth/authorization";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/auth/permissions";
import { listRoles, ADMIN_ROLE } from "@/services/role.service";
import RowActionForm from "@/components/RowActionForm";
import ScrollTable from "@/components/ScrollTable";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "./actions";
import RoleForm from "@/components/RoleForm";

export default async function RolesPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const roles = await listRoles();

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-green-800">Roles</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          A role is a set of rights. Give a login a role on the Users page and it
          gets exactly these rights, and no more. Changes apply straight away.
          Leave approval is separate: it follows the person&apos;s designation (DD,
          CEO, Chairman), not their role.
        </p>
      </div>

      <details className="rounded-md bg-white p-4 shadow-md">
        <summary className="cursor-pointer font-medium">Create a role</summary>
        <div className="mt-4">
          <RoleForm
            action={createRoleAction}
            submitLabel="Create role"
            resetOnSuccess
          />
        </div>
      </details>

      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Role</th>
              <th className="p-3">Users</th>
              <th className="p-3">Rights</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => {
              const isAdmin = r.name === ADMIN_ROLE;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-medium">
                      {r.name}
                      {r.isSystem && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600">
                          built-in
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {r.description ?? ""}
                    </div>
                  </td>
                  <td className="p-3">{r._count.users}</td>
                  <td className="p-3">
                    {isAdmin ? ALL_PERMISSIONS.length : r.permissions.length}{" "}
                    of {ALL_PERMISSIONS.length}
                  </td>
                  <td className="space-y-2 p-3">
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        {isAdmin ? "View" : "Edit rights"}
                      </summary>
                      <div className="mt-3 min-w-[min(90vw,56rem)]">
                        <RoleForm
                          action={updateRoleAction}
                          submitLabel="Save role"
                          initial={{
                            id: r.id,
                            name: r.name,
                            description: r.description,
                            permissions: r.permissions,
                          }}
                          nameLocked={r.isSystem}
                          allLocked={isAdmin}
                        />
                      </div>
                    </details>
                    {!r.isSystem && (
                      <RowActionForm
                        action={deleteRoleAction}
                        id={r.id}
                        label="Delete"
                        danger
                        confirmMessage={`Delete the role ${r.name}?`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
