import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRoleOptions, listUsers } from "@/services/user.service";
import SimpleForm from "@/components/SimpleForm";
import RowActionForm from "@/components/RowActionForm";
import { ResetLoginForm } from "@/components/TemporaryLogin";
import {
  changeUserRoleAction,
  resetPasswordAction,
  toggleUserActiveAction,
} from "./actions";

export default async function UsersPage() {
  const me = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const [users, roles] = await Promise.all([listUsers(), listRoleOptions()]);
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="w-full space-y-3">
      <h1 className="p-2 text-xl font-semibold text-green-800">Users</h1>
      <p className="px-2 text-sm text-zinc-600">
        Logins are created automatically when an employee is added, with the
        Employee role. Use this page to give someone another role (HR, IT
        Officer), to issue a new one-time password, or to deactivate a login.
        Name, email and employee link are managed on the Employees page.
      </p>

      <div className="w-full overflow-x-auto rounded-md bg-white p-3 shadow-lg">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t align-top">
                <td className="p-3">
                  <div className="font-medium">{u.fullName}</div>
                  <div className="text-xs text-zinc-500">
                    {u.email}
                    {u.employee
                      ? ` · ${u.employee.employeeCode}`
                      : " · no employee record"}
                  </div>
                </td>
                <td className="p-3">{u.role.name}</td>
                <td className="p-3">
                  {u.isActive ? "Active" : "Deactivated"}
                  <div className="text-xs text-zinc-500">
                    {u.mustChangePassword
                      ? "First password not changed yet"
                      : "Own password set"}
                  </div>
                </td>
                <td className="space-y-2 p-3">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Change role
                      </summary>
                      <div className="mt-2 max-w-xs">
                        <SimpleForm
                          action={changeUserRoleAction}
                          submitLabel="Save role"
                          hidden={{ id: u.id }}
                          fields={[
                            {
                              name: "roleId",
                              label: "Role",
                              options: roleOptions,
                              required: true,
                              defaultValue: u.roleId,
                            },
                          ]}
                        />
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Reset password
                      </summary>
                      <div className="mt-2 max-w-sm">
                        <ResetLoginForm
                          action={resetPasswordAction}
                          id={u.id}
                          label="Issue new password"
                        />
                      </div>
                    </details>
                    {u.id !== me.id && (
                      <RowActionForm
                        action={toggleUserActiveAction}
                        id={u.id}
                        label={u.isActive ? "Deactivate" : "Reactivate"}
                        danger={u.isActive}
                        fields={{ active: u.isActive ? "false" : "true" }}
                        confirmMessage={
                          u.isActive
                            ? `Deactivate ${u.fullName}? They will be signed out.`
                            : undefined
                        }
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
