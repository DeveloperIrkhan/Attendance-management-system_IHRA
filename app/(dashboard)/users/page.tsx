import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRoleOptions, listUsers } from "@/services/user.service";
import SimpleForm from "@/components/SimpleForm";
import RowActionForm from "@/components/RowActionForm";
import { ResetLoginForm } from "@/components/TemporaryLogin";
import {
  changeUserRoleAction,
  createUserAction,
  updateUserDetailsAction,
  resetPasswordAction,
  toggleUserActiveAction,
} from "./actions";
import CreateUserForm from "@/components/CreateUserForm";

export default async function UsersPage() {
  const me = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const [users, roles] = await Promise.all([listUsers(), listRoleOptions()]);
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="w-full space-y-3">
      <h1 className="p-2 text-xl font-semibold text-green-800">Users</h1>
      <p className="px-2 text-sm text-zinc-600">
        Employees get a login automatically (Employee role) when they are added
        on the Employees page. Use <b>Create user</b> below for staff who are
        not employees, such as HR or IT: they get their own login and the
        rights of the role you choose, but no attendance or leave of their own.
        Roles and their rights are managed on the Roles page.
      </p>

      <details className="rounded-md bg-white p-4 shadow-md">
        <summary className="cursor-pointer font-medium">Create user</summary>
        <div className="mt-4">
          <CreateUserForm action={createUserAction} roles={roleOptions} />
        </div>
      </details>

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
                    {!u.employee && (
                      <details>
                        <summary className="cursor-pointer text-xs underline">
                          Edit name / email
                        </summary>
                        <div className="mt-2 max-w-xs">
                          <SimpleForm
                            action={updateUserDetailsAction}
                            submitLabel="Save"
                            hidden={{ id: u.id }}
                            fields={[
                              {
                                name: "fullName",
                                label: "Full name",
                                required: true,
                                defaultValue: u.fullName,
                              },
                              {
                                name: "email",
                                label: "Email",
                                type: "email",
                                required: true,
                                defaultValue: u.email,
                              },
                            ]}
                          />
                        </div>
                      </details>
                    )}
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
