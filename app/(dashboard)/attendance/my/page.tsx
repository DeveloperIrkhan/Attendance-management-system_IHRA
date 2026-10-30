import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import PeriodFilters from "@/components/PeriodFilters";
import { clockText, monthParam, toIsoDate } from "@/lib/attendance/dates";
import { formatMinutes } from "@/lib/attendance/duration";
import {
  matchesStatus,
  periodQuery,
  STATUS_FILTERS,
  statusFilterLabel,
  withStatus,
} from "@/lib/attendance/period";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  getMyDashboardData,
  resolveMyView,
} from "@/services/my-dashboard.service";

type SearchParams = Promise<{
  date?: string;
  month?: string;
  from?: string;
  to?: string;
  year?: string;
  status?: string;
}>;

const card = "rounded-xl border border-slate-200 bg-white shadow-md";
const BASE = "/attendance/my";

const dayText = (iso: string, withYear: boolean) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN);
  const sp = await searchParams;

  if (!user.employeeId) {
    return (
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
        Your login is not linked to an employee record. Please contact HR.
      </p>
    );
  }

  // Only this employee's own records are read (the id comes from the session).
  const view = await resolveMyView(user.employeeId, sp);
  const data = await getMyDashboardData(user.employeeId, view.date, {
    period: view.period,
    status: view.status,
  });
  if (!data) {
    return (
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
        No employee record was found for your login.
      </p>
    );
  }

  const { year, month, period, status } = data;
  const summary = data.periodSummary;
  const isMonth = period.kind === "month";
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const selectedIso = data.selected.iso;

  const rows = data.periodDays.filter((d) => matchesStatus(d.status, status));
  const showYear = !isMonth || period.start.getUTCFullYear() !== year;

  // One pill per status, with how many days of the period match it.
  const pillQuery = periodQuery(period);
  const pills = STATUS_FILTERS.map((s) => ({
    ...s,
    count: data.periodDays.filter((d) => matchesStatus(d.status, s.value))
      .length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-green-800">
            My attendance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {period.label}
            {status !== "ALL" && <> · {statusFilterLabel(status)}</>}. Attended{" "}
            {summary.attended}, absent {summary.absent}, late{" "}
            {summary.lateDays}, missing punch {summary.missingPunch}, on leave{" "}
            {summary.onLeave}.
          </p>
        </div>

        {isMonth && (
          <div className="flex items-center gap-1">
            <Link
              href={`${BASE}${withStatus({ month: monthParam(prev.y, prev.m) }, status)}`}
              aria-label="Previous month"
              className="rounded-md border p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft size={16} aria-hidden />
            </Link>
            <Link
              href={`${BASE}${withStatus({ month: monthParam(next.y, next.m) }, status)}`}
              aria-label="Next month"
              className="rounded-md border p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
        )}
      </div>

      <section className={`${card} space-y-4 p-4`}>
        <PeriodFilters
          // remount when the URL changes so the form always shows what is applied
          key={`${period.kind}-${toIsoDate(period.start)}-${toIsoDate(period.end)}-${status}`}
          basePath={BASE}
          kind={period.kind}
          month={monthParam(year, month)}
          year={period.start.getUTCFullYear()}
          from={toIsoDate(period.start)}
          to={toIsoDate(period.end)}
          status={status}
        />

        <div className="flex flex-wrap gap-2" aria-label="Filter by status">
          {pills.map((p) => {
            const active = p.value === status;
            return (
              <Link
                key={p.value}
                href={`${BASE}${withStatus(pillQuery, p.value)}`}
                aria-current={active ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? "border-green-800 bg-green-800 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p.label}{" "}
                <span className="tabular-nums opacity-80">({p.count})</span>
              </Link>
            );
          })}
        </div>

        {period.clamped && (
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
            The range was longer than a year, so only the last 366 days up to
            your end date are shown.
          </p>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Check in</th>
                <th className="px-3 py-3 font-medium">Check out</th>
                <th className="px-3 py-3 font-medium">Worked</th>
                <th className="px-3 py-3 font-medium">Late by</th>
                <th className="px-3 py-3 font-medium">Overtime</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    No days match this filter.
                  </td>
                </tr>
              )}
              {rows.map((d) => {
                const weekday = new Date(
                  `${d.iso}T00:00:00Z`,
                ).toLocaleDateString("en-GB", {
                  weekday: "short",
                  timeZone: "UTC",
                });
                const quiet = d.status === "WEEKEND" || d.status === "HOLIDAY";
                return (
                  <tr
                    key={d.iso}
                    className={`border-t border-slate-100 ${
                      d.iso === selectedIso && isMonth ? "bg-green-50" : ""
                    } ${quiet ? "text-slate-500" : ""}`}
                  >
                    <td className="whitespace-nowrap px-5 py-3">
                      {dayText(d.iso, showYear)}{" "}
                      <span className="text-xs text-slate-400">{weekday}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {clockText(d.checkIn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {clockText(d.checkOut)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {d.checkIn && d.checkOut
                        ? formatMinutes(d.workingMinutes)
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {d.lateMinutes > 0 ? formatMinutes(d.lateMinutes) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {d.overtimeMinutes > 0
                        ? formatMinutes(d.overtimeMinutes)
                        : "-"}
                    </td>
                    <td className="px-5 py-3">
                      <AttendanceStatusBadge status={d.status} />
                      {d.status === "HOLIDAY" && d.note && (
                        <span className="ml-2 text-xs">{d.note}</span>
                      )}
                      {d.status === "INCOMPLETE" && (
                        <span className="ml-2 text-xs text-purple-700">
                          Contact HR
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-slate-500">
        <Link
          href={`/dashboard${withStatus(pillQuery, "ALL")}`}
          className="font-medium text-green-700 hover:underline"
        >
          Back to my dashboard
        </Link>
      </p>
    </div>
  );
}
