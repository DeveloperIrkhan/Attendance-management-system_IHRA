import Link from "next/link";
import { ServiceError } from "@/lib/action-state";
import { requireScope } from "@/lib/auth/authorization";
import { toIsoDate } from "@/lib/attendance/dates";
import {
  REPORT_TYPE,
  parseReportParams,
  type ReportTable,
} from "@/lib/reports/type";
import { listDepartments } from "@/services/department.service";
import { buildReport, listReportEmployees } from "@/services/report.service";
import { getLatestAttendanceDate } from "@/services/attendance.service";
import ScrollTable from "@/components/ScrollTable";
import { canExportReports } from "@/lib/reports/csv";

type SearchParams = Promise<Record<string, string | undefined>>;

const input = "rounded border px-3 py-2 text-sm custom-input";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // HR, IT Officer, Admin, CEO, Chairman: whole organization. DD: own department only.
  const { user, scope } = await requireScope();
  const sp = await searchParams;
  const params = parseReportParams((k) => sp[k]);
  const meta = REPORT_TYPE.find((t: any) => t.value === params.type)!;
  const has = (f: (typeof meta.filters)[number]) => meta.filters.includes(f);

  const [departments, employees, latest] = await Promise.all([
    scope.kind === "ALL" ? listDepartments() : Promise.resolve([]),
    has("employee") ? listReportEmployees(scope) : Promise.resolve([]),
    getLatestAttendanceDate(),
  ]);

  // Defaults shown in the form: the latest imported day / month.
  const defaultDate = toIsoDate(latest ?? new Date());
  const defaultMonth = defaultDate.slice(0, 7);
  const defaultFrom = `${defaultMonth}-01`;

  let table: ReportTable | null = null;
  let error: string | null = null;
  // The history report waits for an employee to be chosen.
  if (!(params.type === "history" && !params.employee)) {
    try {
      table = await buildReport(params, scope);
    } catch (e) {
      error =
        e instanceof ServiceError ? e.message : "Could not build the report.";
      if (!(e instanceof ServiceError)) console.error(e);
    }
  }

  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  );
  const canExport = canExportReports(user);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-green-800">Reports</h1>

      <nav className="flex flex-wrap gap-2" aria-label="Report type">
        {REPORT_TYPE.map((t: any) => (
          <Link
            key={t.value}
            href={`/reports?type=${t.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              t.value === params.type
                ? "border-green-800 bg-green-800 text-white"
                : "border-green-800 text-green-800 hover:bg-green-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-zinc-600">{meta.description}.</p>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-md bg-white p-4 shadow-md"
      >
        <input type="hidden" name="type" value={params.type} />

        {has("date") && (
          <label className="space-y-1 text-sm font-medium">
            Date
            <input
              type="date"
              name="date"
              defaultValue={params.date ?? defaultDate}
              className={`block ${input}`}
            />
          </label>
        )}
        {has("month") && (
          <label className="space-y-1 text-sm font-medium">
            Month
            <input
              type="month"
              name="month"
              defaultValue={params.month ?? defaultMonth}
              className={`block ${input}`}
            />
          </label>
        )}
        {has("range") && (
          <>
            <label className="space-y-1 text-sm font-medium">
              From
              <input
                type="date"
                name="from"
                defaultValue={params.from ?? defaultFrom}
                className={`block ${input}`}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              To
              <input
                type="date"
                name="to"
                defaultValue={params.to ?? defaultDate}
                className={`block ${input}`}
              />
            </label>
          </>
        )}
        {has("employee") && (
          <label className="space-y-1 text-sm font-medium">
            Employee
            <select
              name="employee"
              required
              defaultValue={params.employee ?? ""}
              className={`block ${input}`}
            >
              <option value="">Choose an employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </option>
              ))}
            </select>
          </label>
        )}
        {has("status") && (
          <label className="space-y-1 text-sm font-medium">
            Status
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className={`block ${input}`}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        )}
        {has("department") && scope.kind === "ALL" && (
          <label className="space-y-1 text-sm font-medium">
            Department
            <select
              name="department"
              defaultValue={params.department ?? ""}
              className={`block ${input}`}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="green-button hoverEffect">
          Show report
        </button>
      </form>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {params.type === "history" && !params.employee && !error && (
        <p className="rounded bg-zinc-100 p-3 text-sm text-zinc-700">
          Choose an employee and press Show report.
        </p>
      )}

      {table && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">{table.title}</h2>
              <p className="text-sm text-zinc-500">{table.subtitle}</p>
            </div>
            {canExport && (
              <div className="flex gap-2">
                <a
                  href={`/api/reports?${exportQuery.toString()}&format=pdf`}
                  className="green-button hoverEffect"
                >
                  Download PDF
                </a>
                <a
                  href={`/api/reports?${exportQuery.toString()}&format=csv`}
                  className="green-button-inverse hoverEffect"
                >
                  Download CSV (Excel)
                </a>
              </div>
            )}
          </div>

          <ScrollTable>
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 z-10 bg-green-800 text-white">
                <tr>
                  {table.column.map((c) => (
                    <th
                      key={c.label}
                      className={`p-3 font-medium ${
                        c.align === "right"
                          ? "text-right"
                          : c.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="whitespace-nowrap">
                {table.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={table.column.length}
                      className="p-4 text-center text-zinc-500"
                    >
                      No records match these filters.
                    </td>
                  </tr>
                )}
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`p-3 ${
                          table.column[j]?.align === "right"
                            ? "text-right tabular-nums"
                            : table.column[j]?.align === "center"
                              ? "text-center tabular-nums"
                              : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.totals && (
                  <tr className="border-t-2 border-green-800 bg-green-50 font-semibold">
                    {table.totals.map((cell, j) => (
                      <td
                        key={j}
                        className={`p-3 ${
                          table.column[j]?.align === "right"
                            ? "text-right tabular-nums"
                            : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollTable>

          {table.notes?.map((n) => (
            <p key={n} className="text-sm text-zinc-500">
              {n}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
