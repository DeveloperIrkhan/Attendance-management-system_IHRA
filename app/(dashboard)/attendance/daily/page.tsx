import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMinutes } from "@/lib/attendance/attendance-rules";
import {
  addDays,
  clockText,
  monthParam,
  toIsoDate,
} from "@/lib/attendance/dates";
import {
  dailyQuery,
  dailyStatusLabel,
  parseDailyStatus,
  parsePage,
  resolveDailyRange,
} from "@/lib/attendance/daily-filters";
import { getLatestAttendanceDate } from "@/services/attendance.service";
import {
  DAILY_PAGE_SIZE,
  listAttendanceRecords,
} from "@/services/attendance-list.service";
import { listDepartments } from "@/services/department.service";
import AttendanceStatusBadge, {
  STATUS_ORDER,
} from "@/components/AttendanceStatusBadge";
import DailyFilters from "@/components/DailyFilters";
import { hasPermission, requireScope } from "@/lib/auth/authorization";

type SearchParams = Promise<{
  date?: string;
  from?: string;
  to?: string;
  month?: string;
  department?: string;
  status?: string;
  q?: string;
  page?: string;
}>;

const BASE = "/attendance/daily";
const navButton =
  "rounded border border-green-800 bg-green-800 text-white px-3 py-1 hover:bg-white hover:text-green-800 hoverEffect";

export default async function DailyAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // HR, IT Officer, Admin, CEO, Chairman: everyone. DD: their own departments only.
  const { user, scope } = await requireScope();
  const sp = await searchParams;
  const canEdit = hasPermission(user, PERMISSIONS.ATTENDANCE_EDIT);
  const range = resolveDailyRange(sp, await getLatestAttendanceDate());
  if (!range) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Daily attendance</h1>
        <p className="text-zinc-600">
          No attendance has been processed yet.
          {hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT) && (
            <>
              {" "}
              Import a file first.{" "}
              <Link href="/attendance/import" className="underline">
                Go to Import
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  const status = parseDailyStatus(sp.status);
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = parsePage(sp.page);

  // Departments this person may pick from: all of them, or a DD's own (and additional charge).
  const departments = await listDepartments();
  const pickable =
    scope.kind === "ALL"
      ? departments
      : scope.kind === "DEPARTMENT"
        ? departments.filter((d) => scope.departmentIds.includes(d.id))
        : [];
  const departmentId =
    sp.department && pickable.some((d) => d.id === sp.department)
      ? sp.department
      : undefined;
  const showPicker = pickable.length > 1;

  const { records, counts, all, total, pages } = await listAttendanceRecords({
    start: range.start,
    end: range.end,
    departmentId,
    status,
    q,
    scope,
    page,
  });
  console.log("DailyAttendancePage searchParams:", records);

  const keep = { department: departmentId, q };
  const href = (extra: { status?: typeof status; page?: number }) =>
    `${BASE}${dailyQuery(range, { ...keep, status, ...extra })}`;
  const dayLink = (delta: number) =>
    `${BASE}${dailyQuery(
      {
        ...range,
        start: addDays(range.start, delta),
        end: addDays(range.end, delta),
      },
      { ...keep, status },
    )}`;

  const weekday =
    range.mode === "day"
      ? range.start.toLocaleDateString("en-GB", {
          weekday: "long",
          timeZone: "UTC",
        })
      : null;
  const multiDay = range.mode !== "day";
  const firstRow = total === 0 ? 0 : (page - 1) * DAILY_PAGE_SIZE + 1;
  const lastRow = Math.min(page * DAILY_PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Daily attendance: {range.label}{" "}
          {weekday && (
            <span className="text-sm font-normal text-zinc-500">{weekday}</span>
          )}
        </h1>
        {range.mode === "day" && (
          <div className="space-x-2 text-sm">
            <Link href={dayLink(-1)} className={navButton}>
              Previous day
            </Link>
            <Link href={dayLink(1)} className={navButton}>
              Next day
            </Link>
          </div>
        )}
      </div>

      <DailyFilters
        // remount when the URL changes so the form shows what is applied
        key={`${range.mode}-${toIsoDate(range.start)}-${toIsoDate(range.end)}-${departmentId ?? ""}-${status}-${q}`}
        basePath={BASE}
        mode={range.mode}
        date={toIsoDate(range.start)}
        from={toIsoDate(range.start)}
        to={toIsoDate(range.end)}
        month={monthParam(
          range.start.getUTCFullYear(),
          range.start.getUTCMonth() + 1,
        )}
        department={departmentId ?? ""}
        status={status}
        q={q}
        departments={showPicker ? pickable : []}
        fixedDepartment={pickable.map((d) => d.name).join(", ") || undefined}
        allDepartmentsLabel={
          scope.kind === "ALL" ? "All departments" : "All my departments"
        }
      />

      {range.clamped && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
          The range was longer than a year, so only the last 366 days up to your
          end date are shown.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={href({ status: "ALL" })}
          aria-current={status === "ALL" ? "true" : undefined}
          className={`rounded px-3 py-1 ${
            status === "ALL"
              ? "bg-green-800 text-white"
              : "bg-white hover:bg-green-50"
          }`}
        >
          All <span className="tabular-nums">({all})</span>
        </Link>
        {STATUS_ORDER.filter((s) => counts[s] || s === status).map((s) => (
          <Link
            key={s}
            href={href({ status: s as typeof status })}
            aria-current={status === s ? "true" : undefined}
            className={`flex items-center gap-2 rounded px-3 py-1 ${
              status === s ? "ring-2 ring-green-800" : ""
            } bg-white hover:bg-green-50`}
          >
            <AttendanceStatusBadge status={s} />
            <span className="tabular-nums">{counts[s] ?? 0}</span>
          </Link>
        ))}
        {all === 0 && (
          <span className="text-zinc-500">No records for these filters.</span>
        )}
      </div>

      <p className="text-sm text-zinc-500">
        {status !== "ALL" && <>{dailyStatusLabel(status)}: </>}
        {total === 0
          ? "no matching records"
          : `showing ${firstRow} to ${lastRow} of ${total}`}
        {q && <> · search &quot;{q}&quot;</>}
      </p>

      <div className="overflow-x-auto rounded-md p-2 shadow-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-white text-left">
            <tr>
              {multiDay && <th className="p-3">Date</th>}
              <th className="p-3">Serial No</th>
              <th className="p-3">Biometric Id</th>
              <th className="p-3">Name</th>
              <th className="p-3">Department</th>
              <th className="p-3">In</th>
              <th className="p-3">Out</th>
              <th className="p-3">Worked</th>
              <th className="p-3">Late (min)</th>
              <th className="p-3">Overtime</th>
              <th className="p-3">Status</th>
              <th className="p-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={multiDay ? 11 : 10}
                  className="p-6 text-center text-zinc-500"
                >
                  No records match these filters.
                </td>
              </tr>
            )}
            {records.map((r: any, index: number) => (
              <tr key={r.id} className="border-t align-top">
                {multiDay && (
                  <td className="whitespace-nowrap p-3">
                    {toIsoDate(r.date)}{" "}
                    <span className="text-xs text-zinc-400">
                      {r.date.toLocaleDateString("en-GB", {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                  </td>
                )}
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{r.employee.biometricId}</td>
                <td className="p-3 font-medium">{r.employee.name}</td>
                <td className="p-3">
                  {r.employee.department.name}{" "}
                  <span className="ml-1 text-gray-400">
                    {r.employee.designation?.title &&
                      `(${r.employee.designation.title})`}
                  </span>
                  {r.employee.additionalCharges.length > 0 && (
                    <span className="ml-1 text-blue-600">
                      (
                      {r.employee.additionalCharges
                        .map((ac) => ac.department.name)
                        .join(", ")}
                      )
                    </span>
                  )}
                </td>
                <td className="p-3">{clockText(r.checkIn)}</td>
                <td className="p-3">{clockText(r.checkOut)}</td>
                <td className="p-3">
                  {r.workingMinutes ? formatMinutes(r.workingMinutes) : "-"}
                </td>
                <td className="p-3">{r.lateMinutes || "-"}</td>
                <td className="p-3">
                  {r.overtimeMinutes ? formatMinutes(r.overtimeMinutes) : "-"}
                </td>
                <td className="p-3">
                  <AttendanceStatusBadge status={r.status} />
                </td>
                <td className="p-3">
                  {r.remarks && (
                    <p className="max-w-xs text-xs text-zinc-600">
                      {r.remarks}
                    </p>
                  )}
                  {canEdit && (
                    <Link
                      href={`/attendance/records/${r.id}/edit`}
                      className="mt-1 inline-block rounded border border-green-800 bg-white px-2 py-1 text-xs text-green-800 hoverEffect hover:bg-green-800 hover:text-white"
                    >
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Page {page} of {pages}
          </span>
          <div className="space-x-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className={navButton}>
                Previous page
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className={navButton}>
                Next page
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
