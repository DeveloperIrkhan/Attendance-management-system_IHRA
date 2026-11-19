import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listAuditFacets, listAuditLogs } from "@/services/audit.service";
import { formatDateTime } from "@/lib/time";

type SearchParams = Promise<{
  q?: string;
  entity?: string;
  action?: string;
  page?: string;
}>;

const ACTION_LABEL: Record<string, string> = {
  "settings.update": "Rules changed",
  "employee.create": "Employee added",
  "employee.update": "Employee edited",
  "employee.activate": "Employee reactivated",
  "employee.deactivate": "Employee deactivated",
  "employee.reset-login": "Employee login reset",
  "employee.delete": "Employee deleted",
  "user.create": "User created",
  "user.update": "User edited",
  "user.change-role": "User role changed",
  "user.activate": "User reactivated",
  "user.deactivate": "User deactivated",
  "user.reset-password": "User password reset",
  "role.create": "Role created",
  "role.update": "Role edited",
  "role.delete": "Role deleted",
  "department.create": "Department created",
  "department.update": "Department edited",
  "department.delete": "Department deleted",
  "department.charge-add": "Additional charge added",
  "department.charge-remove": "Additional charge removed",
  "department.acting-add": "Acting approver added",
  "department.acting-remove": "Acting approver removed",
  "designation.create": "Designation created",
  "designation.update": "Designation edited",
  "designation.delete": "Designation deleted",
  "leave-type.create": "Leave type created",
  "leave-type.update": "Leave type edited",
  "leave-type.activate": "Leave type reactivated",
  "leave-type.deactivate": "Leave type deactivated",
  "leave.record": "Leave recorded",
  "leave.approved": "Leave approved",
  "leave.rejected": "Leave rejected",
  "leave.cancelled": "Leave cancelled",
  "noc.approve": "NOC approved",
  "noc.reject": "NOC rejected",
  "noc.cancel": "NOC cancelled",
  "noc.issue": "NOC issued",
  "attendance.correct": "Attendance corrected",
  "attendance.import": "Attendance imported",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const sp = await searchParams;
  const filters = {
    text: sp.q?.trim() || undefined,
    entity: sp.entity || undefined,
    action: sp.action || undefined,
    page: Number(sp.page) || 1,
  };
  const [result, facets] = await Promise.all([
    listAuditLogs(filters),
    listAuditFacets(),
  ]);

  function pageHref(page: number) {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.entity) p.set("entity", sp.entity);
    if (sp.action) p.set("action", sp.action);
    p.set("page", String(page));
    return `/audit?${p.toString()}`;
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-green-800">Change log</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Every important change, with who made it and when: rules, employees,
          users, roles, departments, leave decisions, attendance corrections and
          NOC documents.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-md bg-white p-3 shadow-md"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Person, summary or id"
            className="rounded border border-zinc-300 px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Entity</span>
          <select
            name="entity"
            defaultValue={sp.entity ?? ""}
            className="rounded border border-zinc-300 px-3 py-1.5"
          >
            <option value="">All</option>
            {facets.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Action</span>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="rounded border border-zinc-300 px-3 py-1.5"
          >
            <option value="">All</option>
            {facets.actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a] ?? a}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-green-700 px-4 py-2 text-sm text-white shadow-md hover:bg-green-800"
        >
          Filter
        </button>
        <Link href="/audit" className="text-sm underline">
          Clear
        </Link>
        <span className="ml-auto text-sm text-zinc-500">
          {result.total} entr{result.total === 1 ? "y" : "ies"}
        </span>
      </form>

      <div className="overflow-x-auto rounded-md bg-white p-3 shadow-lg">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-left text-white">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Who</th>
              <th className="p-3">Change</th>
              <th className="p-3">What happened</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-zinc-500">
                  No entries match these filters.
                </td>
              </tr>
            )}
            {result.items.map((entry) => (
              <tr key={entry.id} className="border-t align-top">
                <td className="whitespace-nowrap p-3 text-zinc-600">
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className="p-3">
                  <div className="font-medium">{entry.actorName}</div>
                  {entry.actorId && (
                    <div className="text-xs text-zinc-500">
                      {entry.actorId.slice(0, 8)}…
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div>{ACTION_LABEL[entry.action] ?? entry.action}</div>
                  <div className="text-xs text-zinc-500">{entry.entity}</div>
                </td>
                <td className="p-3">{entry.summary}</td>
                <td className="p-3">
                  {(entry.before || entry.after) && (
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Before / after
                      </summary>
                      <pre className="mt-2 max-w-md overflow-x-auto rounded bg-zinc-50 p-2 text-xs">
                        {JSON.stringify(
                          { before: entry.before, after: entry.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="underline">
              Previous
            </Link>
          ) : (
            <span className="text-zinc-400">Previous</span>
          )}
          <span className="text-zinc-600">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className="underline">
              Next
            </Link>
          ) : (
            <span className="text-zinc-400">Next</span>
          )}
        </div>
      )}
    </div>
  );
}
