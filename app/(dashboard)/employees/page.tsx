import Link from "next/link";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listEmployees } from "@/services/employee.service";
import { listDepartments } from "@/services/department.service";
import RowActionForm from "@/components/RowActionForm";
import { toggleEmployeeActiveAction } from "./actions";

type SearchParams = Promise<{
  q?: string;
  department?: string;
  status?: string;
  page?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE);

  const sp = await searchParams;
  const status =
    sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;

  const [result, departments] = await Promise.all([
    listEmployees({
      textSearch: sp.q?.trim() || undefined,
      departmentId: sp.department || undefined,
      status,
      page: Number(sp.page) || 1,
    }),
    listDepartments(),
  ]);

  function pageHref(page: number) {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.department) p.set("department", sp.department);
    if (status) p.set("status", status);
    p.set("page", String(page));
    return `/employees?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Employees{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({result.total})
          </span>
        </h1>
        {canManage && (
          <Link
            href="/employees/new"
            className="rounded bg-green-600 hover:bg-green-900 px-4 py-2 text-sm text-white hoverEffect"
          >
            Add employee
          </Link>
        )}
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-2 bg-white shadow-xl rounded-md px-3 py-4"
      >
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, code, email, biometric ID"
          className="min-w-64 flex-1 custom-input"
        />
        <select
          name="department"
          defaultValue={sp.department ?? ""}
          className="rounded bordering px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded bordering px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="submit"
          className="rounded bordering px-4 py-2 text-sm bg-green-600  hover:bg-green-800 text-white"
        >
          Filter
        </button>
        <Link
          href="/employees"
          className="px-2 py-2 text-sm text-zinc-500 underline"
        >
          Reset
        </Link>
      </form>

      <div className="overflow-x-auto bg-white rounded-md shadow-md p-4">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Biometric ID</th>
              <th className="p-3">Department</th>
              <th className="p-3">Designation</th>
              <th className="p-3">Status</th>
              {canManage && <th className="p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 && (
              <tr>
                <td
                  colSpan={canManage ? 7 : 6}
                  className="p-4 text-center text-zinc-500"
                >
                  No employees found.
                </td>
              </tr>
            )}
            {result.items.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{e.employeeCode}</td>
                <td className="p-3">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-zinc-500">{e.email}</div>
                </td>
                <td className="p-3">{e.biometricId ?? "-"}</td>
                <td className="p-3">{e.department.name}</td>
                <td className="p-3">{e.designation?.title ?? "-"}</td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      e.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {e.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {canManage && (
                  <td className="space-x-2 p-3 whitespace-nowrap">
                    <Link
                      href={`/employees/${e.id}/edit`}
                      className="rounded border px-2 py-1 text-xs hover:bg-zinc-100"
                    >
                      Edit
                    </Link>
                    <RowActionForm
                      action={toggleEmployeeActiveAction}
                      id={e.id}
                      label={e.isActive ? "Deactivate" : "Activate"}
                      fields={{ active: String(!e.isActive) }}
                      confirmMessage={
                        e.isActive ? `Deactivate ${e.name}?` : undefined
                      }
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Page {result.page} of {result.pageCount}
          </span>
          <div className="space-x-2">
            {result.page > 1 && (
              <Link
                href={pageHref(result.page - 1)}
                className="rounded border px-3 py-1 hover:bg-zinc-100"
              >
                Previous
              </Link>
            )}
            {result.page < result.pageCount && (
              <Link
                href={pageHref(result.page + 1)}
                className="rounded border px-3 py-1 hover:bg-zinc-100"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
