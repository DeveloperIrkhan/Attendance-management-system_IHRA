import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  listLinkableEmployees,
  listRoleOptions,
  listUsers,
} from "@/services/user.service";
import SimpleForm from "@/components/SimpleForm";
import RowActionForm from "@/components/RowActionForm";
import {
  createUserAction,
  resetPasswordAction,
  toggleUserActiveAction,
  updateUserAction,
} from "./actions";

export default async function UsersPage() {
  const me = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const [users, roles, linkable] = await Promise.all([
    listUsers(),
    listRoleOptions(),
    listLinkableEmployees(),
  ]);

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const employeeOptions = (keep?: {
    id: string;
    name: string;
    code: string;
  }) => [
    { value: "", label: "Not linked to an employee" },
    ...(keep ? [{ value: keep.id, label: `${keep.name} (${keep.code})` }] : []),
    ...linkable
      .filter((e) => e.id !== keep?.id)
      .map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` })),
  ];

  return (
    <div className="w-full space-y-3">
      <h1 className="p-2 text-xl font-semibold text-green-800">Users</h1>
      <p className="px-2 text-sm text-zinc-600">
        A user must be linked to an employee to apply for leave. Approvers (DD,
        CEO, Chairman) also need this link, and their designation&apos;s
        approval level set under Designations.
      </p>

      <div className="flex w-full justify-center">
        <section className="w-full rounded-md bg-white p-4 shadow-lg md:max-w-md">
          <h2 className="mb-3 font-medium">Add user</h2>
          <SimpleForm
            action={createUserAction}
            resetOnSuccess
            submitLabel="Add user"
            fields={[
              { name: "fullName", label: "Full name", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              {
                name: "password",
                label: "Temporary password",
                type: "password",
                required: true,
              },
              {
                name: "roleId",
                label: "Role",
                options: roleOptions,
                required: true,
              },
              {
                name: "employeeId",
                label: "Employee",
                options: employeeOptions(),
              },
            ]}
          />
          <p className="mt-2 text-xs text-zinc-500">
            The person must choose a new password the first time they sign in.
          </p>
        </section>
      </div>

      <div className="w-full overflow-x-auto rounded-md bg-white p-3 shadow-lg">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t align-top">
                <td className="p-3">
                  <div className="font-medium">{u.fullName}</div>
                  <div className="text-xs text-zinc-500">{u.email}</div>
                </td>
                <td className="p-3">{u.role.name}</td>
                <td className="p-3">
                  {u.employee ? (
                    `${u.employee.name} (${u.employee.employeeCode})`
                  ) : (
                    <span className="text-zinc-500">Not linked</span>
                  )}
                </td>
                <td className="p-3">{u.isActive ? "Active" : "Deactivated"}</td>
                <td className="space-y-2 p-3">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Edit
                      </summary>
                      <div className="mt-2 max-w-xs">
                        <SimpleForm
                          action={updateUserAction}
                          submitLabel="Save changes"
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
                            {
                              name: "roleId",
                              label: "Role",
                              options: roleOptions,
                              required: true,
                              defaultValue: u.roleId,
                            },
                            {
                              name: "employeeId",
                              label: "Employee",
                              defaultValue: u.employeeId ?? "",
                              options: employeeOptions(
                                u.employee && u.employeeId
                                  ? {
                                      id: u.employeeId,
                                      name: u.employee.name,
                                      code: u.employee.employeeCode,
                                    }
                                  : undefined,
                              ),
                            },
                          ]}
                        />
                      </div>
                    </details>
                    
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Reset password
                      </summary>
                      <div className="mt-2 max-w-xs">
                        <SimpleForm
                          action={resetPasswordAction}
                          submitLabel="Set new password"
                          hidden={{ id: u.id }}
                          fields={[
                            {
                              name: "password",
                              label: "Temporary password",
                              type: "password",
                              required: true,
                            },
                          ]}
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
