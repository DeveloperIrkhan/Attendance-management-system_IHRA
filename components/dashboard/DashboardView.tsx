import Link from "next/link";
import {
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardList,
  Pencil,
  Plane,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import BarChart from "@/components/charts/BarChart";
import ChartLegend from "@/components/charts/ChartLegend";
import DonutChart from "@/components/charts/DonutChart";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import LeaveStatusBadge from "@/components/LeaveStatusBadge";
import MonthCalendar from "./MonthCalendar";
import RateBars from "./RateBars";
import StatCard from "./StatCard";
import { clockText, monthParam, toIsoDate } from "@/lib/attendance/dates";
import { MONTHS } from "@/lib/attendance/months";
import { STATUS_COLORS } from "@/lib/attendance/colors";
import type { DashboardData } from "@/services/dashboard.service";

export type DashboardPerms = {
  canImport: boolean;
  canManageEmployees: boolean;
  canLeaves: boolean;
  canEditAttendance: boolean;
};

type Props = {
  data: DashboardData;
  perms: DashboardPerms;
  greeting: string;
  firstName: string;
  todayIso: string;
};

const card = "rounded-xl border border-slate-200 bg-white";
const cardTitle = "font-semibold";

const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const shortDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const when = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const pct = (n: number, base: number) =>
  base > 0 ? `${((n / base) * 100).toFixed(1)}%` : "-";

const ACTIVITY_ICONS: Record<string, { icon: LucideIcon; tint: string }> = {
  import: { icon: Upload, tint: "bg-emerald-50 text-emerald-600" },
  process: { icon: CircleCheck, tint: "bg-emerald-50 text-emerald-600" },
  leave: { icon: CalendarDays, tint: "bg-violet-50 text-violet-600" },
  employee: { icon: UserPlus, tint: "bg-blue-50 text-blue-600" },
  correction: { icon: Pencil, tint: "bg-amber-50 text-amber-600" },
};

export default function DashboardView({
  data,
  perms,
  greeting,
  firstName,
  todayIso,
}: Props) {
  const iso = toIsoDate(data.date);
  const { day } = data;
  const attended = day.present + day.shortLeave + day.halfDay;
  const worksToday = data.dayType === "WORKING" && day.expected > 0;
  const dash = "-";

  const monthLabel = `${MONTHS[data.month - 1]} ${data.year}`;

  const attention = [
    perms.canEditAttendance &&
      data.attention.missingPunches > 0 && {
        href: "/attendance/review",
        count: data.attention.missingPunches,
        text: "days with a missing punch",
      },
    perms.canLeaves &&
      data.attention.pendingLeaves > 0 && {
        href: "/leaves?status=PENDING",
        count: data.attention.pendingLeaves,
        text: "leave requests waiting for a decision",
      },
    perms.canLeaves &&
      data.attention.pendingShortLeaves > 0 && {
        href: "/leaves/short?status=PENDING",
        count: data.attention.pendingShortLeaves,
        text: "short leaves waiting for a decision",
      },
    perms.canImport &&
      data.attention.unprocessedBatches > 0 && {
        href: "/attendance/imports",
        count: data.attention.unprocessedBatches,
        text: "imports not processed yet",
      },
    perms.canImport &&
      data.attention.unmatchedRows > 0 && {
        href: "/attendance/imports",
        count: data.attention.unmatchedRows,
        text: "imported rows with no matching employee",
      },
  ].filter(Boolean) as { href: string; count: number; text: string }[];

  const quickActions = [
    perms.canImport && {
      href: "/attendance/import",
      label: "Import Excel file",
      hint: "Upload the monthly sheet",
      Icon: Upload,
    },
    perms.canManageEmployees && {
      href: "/employees/new",
      label: "Add employee",
      hint: "Create a new employee",
      Icon: UserPlus,
    },
    perms.canLeaves && {
      href: "/leaves",
      label: "Manage leave",
      hint: "Review and approve requests",
      Icon: CalendarDays,
    },
    perms.canEditAttendance && {
      href: "/attendance/review",
      label: "Fix missing punches",
      hint: "Correct incomplete days",
      Icon: ClipboardList,
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    hint: string;
    Icon: LucideIcon;
  }[];

  const donutSegments = [
    { label: "On time", value: day.present, color: STATUS_COLORS.present },
    {
      label: "Short leave and half day",
      value: day.shortLeave + day.halfDay,
      color: STATUS_COLORS.late,
    },
    { label: "Absent", value: day.absent, color: STATUS_COLORS.absent },
    {
      label: "Missing punch",
      value: day.missingPunch,
      color: STATUS_COLORS.missing,
    },
    { label: "On leave", value: day.onLeave, color: STATUS_COLORS.leave },
  ];

  const overviewSeries = [
    {
      name: "On time",
      color: STATUS_COLORS.present,
      values: data.series.map((s) => s.present),
    },
    {
      name: "Short leave and half day",
      color: STATUS_COLORS.late,
      values: data.series.map((s) => s.late),
    },
    {
      name: "Absent",
      color: STATUS_COLORS.absent,
      values: data.series.map((s) => s.absent),
    },
    {
      name: "Missing punch",
      color: STATUS_COLORS.missing,
      values: data.series.map((s) => s.missing),
    },
    {
      name: "On leave",
      color: STATUS_COLORS.leave,
      values: data.series.map((s) => s.leave),
    },
  ];

  return (
    <div className="h-screen">
      <div className="space-y-6">
        {/* ---------- Header ---------- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Attendance for {longDate(data.date)}
              {iso !== todayIso &&
                ", the latest day with data. Pick another day in the calendar."}
            </p>
          </div>
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="month" className="sr-only">
              Month
            </label>
            <input
              id="month"
              type="month"
              name="month"
              defaultValue={monthParam(data.year, data.month)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Show
            </button>
          </form>
        </div>

        {data.dayType !== "WORKING" && (
          <p className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {data.dayType === "HOLIDAY"
              ? `Holiday${data.holidayName ? `: ${data.holidayName}` : ""}. No attendance is expected.`
              : "Weekly off day. No attendance is expected."}
          </p>
        )}
        {data.dayType === "WORKING" && !data.hasDayData && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No attendance has been processed for this day.{" "}
            {perms.canImport && (
              <Link href="/attendance/import" className="font-medium underline">
                Import a file
              </Link>
            )}
          </p>
        )}

        {/* ---------- Stat cards ---------- */}
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Today at a glance"
        >
          <StatCard
            tint="emerald"
            icon={<Users size={22} aria-hidden />}
            label="Total employees"
            value={data.totalEmployees}
            sub={
              data.newThisMonth > 0
                ? `${data.newThisMonth} joined this month`
                : "Active employees"
            }
          />
          <StatCard
            tint="blue"
            icon={<UserCheck size={22} aria-hidden />}
            label="Present"
            value={worksToday ? attended : dash}
            sub={
              worksToday
                ? `${pct(attended, day.expected)} of ${day.expected} expected (${day.present} on time)`
                : "Not a working day"
            }
          />
          <StatCard
            tint="red"
            icon={<CircleX size={22} aria-hidden />}
            label="Absent"
            value={worksToday ? day.absent : dash}
            sub={
              worksToday
                ? `${pct(day.absent, day.expected)}${day.missingPunch ? `, plus ${day.missingPunch} missing punch` : ""}`
                : "Not a working day"
            }
          />
          <StatCard
            tint="amber"
            icon={<Plane size={22} aria-hidden />}
            label="On leave"
            value={worksToday ? day.onLeave : dash}
            sub={
              worksToday
                ? `${pct(day.onLeave, day.expected)} of expected`
                : "Not a working day"
            }
          />
        </section>

        {/* ---------- Overview, summary, calendar ---------- */}
        <section className="grid gap-4 xl:grid-cols-12">
          <div className={`${card} p-5 xl:col-span-6`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className={cardTitle}>Attendance overview</h2>
              <span className="text-sm text-slate-500">
                {monthLabel}, employees per day
              </span>
            </div>
            <BarChart
              ariaLabel={`Daily attendance for ${monthLabel}`}
              labels={data.series.map((s) => String(s.day))}
              series={overviewSeries}
              muted={data.series.map((s) => s.isOff)}
              mutedTitle={data.series.map(
                (s) => data.calendar[s.iso]?.title ?? "Day off",
              )}
              labelEvery={2}
              height={310}
            />
            <div className="mt-2">
              <ChartLegend
                items={[
                  ...overviewSeries.map((s) => ({
                    label: s.name,
                    color: s.color,
                  })),
                  { label: "Day off", color: "#cbd5e1" },
                ]}
              />
            </div>
          </div>

          <div className={`${card} p-5 xl:col-span-3`}>
            <h2 className={`${cardTitle} mb-3`}>
              Summary for {shortDate(data.date)}
            </h2>
            <DonutChart
              ariaLabel={`Attendance summary for ${iso}`}
              segments={donutSegments}
              centerLabel="Expected"
              centerValue={worksToday ? day.expected : dash}
            />
            <ul className="mt-4 space-y-2 text-sm">
              {donutSegments.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {worksToday ? s.value : dash}
                    <span className="ml-2 text-xs text-slate-400">
                      {worksToday ? pct(s.value, day.expected) : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${card} p-5 xl:col-span-3`}>
            <MonthCalendar
              year={data.year}
              month={data.month}
              calendar={data.calendar}
              selectedIso={iso}
              basePath="/dashboard"
            />
          </div>
        </section>

        {/* ---------- Selected day's table, actions, attention ---------- */}
        <section className="grid items-start gap-4 xl:grid-cols-12">
          <div className={`${card} overflow-hidden xl:col-span-9`}>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className={cardTitle}>
                  Attendance on {shortDate(data.date)}
                </h2>
                {data.todayTotal > data.todayRows.length && (
                  <p className="text-xs text-slate-500">
                    Showing {data.todayRows.length} of {data.todayTotal}, the
                    ones that need attention first.
                  </p>
                )}
              </div>
              <Link
                href={`/attendance/daily?date=${iso}`}
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-140 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Code</th>
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Department</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Check in</th>
                    <th className="px-5 py-2.5 font-medium">Check out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todayRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        No records for this day.
                      </td>
                    </tr>
                  )}
                  {data.todayRows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 text-slate-500">{r.code}</td>
                      <td className="px-3 py-3 font-medium">{r.name}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {r.department}
                      </td>
                      <td className="px-3 py-3">
                        <AttendanceStatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {clockText(r.checkIn)}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {clockText(r.checkOut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 xl:col-span-3">
            {quickActions.length > 0 && (
              <div className={`${card} p-5`}>
                <h2 className={`${cardTitle} mb-3`}>Quick actions</h2>
                <ul className="space-y-2">
                  {quickActions.map((a, i) => (
                    <li key={a.href + a.label}>
                      <Link
                        href={a.href}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                          i === 0
                            ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <a.Icon size={18} aria-hidden />
                        <span>
                          <span className="block font-medium">{a.label}</span>
                          <span
                            className={`block text-xs ${i === 0 ? "text-emerald-100" : "text-slate-500"}`}
                          >
                            {a.hint}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div id="attention" className={`${card} scroll-mt-24 p-5`}>
              <h2 className={`${cardTitle} mb-3`}>Needs attention</h2>
              {attention.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <CircleCheck
                    size={16}
                    className="text-emerald-600"
                    aria-hidden
                  />
                  Everything is up to date.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {attention.map((a) => (
                    <li key={a.text}>
                      <Link
                        href={a.href}
                        className="flex items-start gap-3 rounded-lg p-1 text-sm hover:bg-slate-50"
                      >
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold tabular-nums text-amber-800">
                          {a.count}
                        </span>
                        <span className="pt-0.5 text-slate-700">{a.text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ---------- Leaves and activity ---------- */}
        <section className="grid items-start gap-4 xl:grid-cols-12">
          {perms.canLeaves && (
            <div className={`${card} overflow-hidden xl:col-span-9`}>
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className={cardTitle}>Recent leave requests</h2>
                <Link
                  href="/leaves"
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-130 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Employee</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">From</th>
                      <th className="px-3 py-2.5 font-medium">To</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLeaves.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-8 text-center text-slate-500"
                        >
                          No leave requests yet.
                        </td>
                      </tr>
                    )}
                    {data.recentLeaves.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="px-5 py-3 font-medium">{l.employee}</td>
                        <td className="px-3 py-3 text-slate-600">{l.type}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {toIsoDate(l.from)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {toIsoDate(l.to)}
                        </td>
                        <td className="px-5 py-3">
                          <LeaveStatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div
            className={`${card} p-5 ${perms.canLeaves ? "xl:col-span-3" : "xl:col-span-12"}`}
          >
            <h2 className={`${cardTitle} mb-3`}>Recent activity</h2>
            {data.activity.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nothing has happened yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.activity.map((a) => {
                  const meta = ACTIVITY_ICONS[a.kind] ?? ACTIVITY_ICONS.import;
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tint}`}
                      >
                        <meta.icon size={16} aria-hidden />
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{a.title}</p>
                        <p className="truncate text-slate-500">{a.detail}</p>
                        <p className="text-xs text-slate-400">{when(a.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ---------- Insights ---------- */}
        <section className="grid gap-4 xl:grid-cols-2">
          <div className={`${card} p-5`}>
            <h2 className={cardTitle}>When people arrive</h2>
            <p className="mb-3 text-sm text-slate-500">
              First punch of everyone who attended in {monthLabel}, in 15-minute
              steps. Arrivals after the dashed line count as short leave.
            </p>
            {data.histogram.total === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No check-ins this month.
              </p>
            ) : (
              <BarChart
                ariaLabel={`Arrival times in ${monthLabel}`}
                labels={data.histogram.labels}
                series={[
                  {
                    name: "Arrivals",
                    color: "#0f766e",
                    values: data.histogram.counts,
                  },
                ]}
                labelEvery={2}
                height={320}
                marker={{
                  after: data.histogram.markerAfter - 1,
                  label: data.histogram.markerLabel,
                }}
              />
            )}
          </div>

          <div className={`${card} p-5`}>
            <h2 className={cardTitle}>Attendance by department</h2>
            <p className="mb-4 text-sm text-slate-500">
              Share of working days attended in {monthLabel}. Days on leave are
              not counted against anyone.
            </p>
            <RateBars rows={data.departments} />
          </div>
        </section>

        {attention.length > 0 && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <TriangleAlert size={14} aria-hidden /> Items under &quot;Needs
            attention&quot; also appear on the bell icon.
          </p>
        )}
      </div>
    </div>
  );
}
