import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  Plane,
  Timer,
} from "lucide-react";
import { MyDashboardData } from "@/services/my-dashboard.service";
import { matchesStatus, periodQuery, statusFilterLabel, withStatus } from "@/lib/attendance/period";
import { STATUS_COLORS } from "@/lib/attendance/colors";
import { clockText, monthParam, toIsoDate } from "@/lib/attendance/dates";
import PeriodFilters from "../PeriodFilters";
import AttendanceStatusBadge from "../AttendanceStatusBadge";
import { formatMinutes } from "@/lib/attendance/attendance-rules";
import StatCard from "./StatCard";
import BarChart from "../charts/BarChart";
import DonutChart from "../charts/DonutChart";
import MonthCalendar from "./MonthCalendar";
import { APPROVER_LABEL } from "@/lib/leave/approval-routing";
import LeaveStatusBadge from "../LeaveStatusBadge";

type Props = {
  data: MyDashboardData;
  fullName: string;
  basePath?: string;
};
//page this component is shown on: the day and month pickers
//and the calendar link back to it

const card = "rounded-xl border border-slate-200 bg-white shadow-md";

const longDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function greetingNow() {
  // Worked out on every request (not once when the server starts).
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

function DayNote({ day }: { day: MyDashboardData["selected"] }) {
  if (day.status === "INCOMPLETE") {
    return (
      <p className="rounded-md bg-purple-50 p-3 text-sm text-purple-800">
        Only one punch was recorded for this day, so it counts as absent until
        HR corrects it. Please contact HR and tell them your real check-in and
        check-out times.
      </p>
    );
  }
  if (day.status === "HOLIDAY") {
    return (
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        Holiday{day.note ? `: ${day.note}` : ""}.
      </p>
    );
  }
  if (day.status === "WEEKEND") {
    return (
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        Weekly off day.
      </p>
    );
  }
  if (day.status === "NO_RECORD") {
    return (
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        No attendance has been imported for this day yet.
      </p>
    );
  }
  if (day.status === "ABSENT") {
    return (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
        No punch was recorded on a working day. If you were present, contact HR.
      </p>
    );
  }
  if (day.note) {
    return (
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        {day.note}
        {day.isManual ? " (corrected by HR)" : ""}
      </p>
    );
  }
  return null;
}

export default function MyDashboard({
  data,
  fullName,
  basePath = "/dashboard",
}: Props) {
  const { selected, period, status } = data;
  // Cards, charts and the day list follow the chosen period (month, date range or year).
  const summary = data.periodSummary;
  const monthLabel = period.label;
  const selectedIso = selected.iso;
  const isMonth = period.kind === "month";
  const filteredDays =
    status === "ALL"
      ? []
      : data.periodDays.filter((d) => matchesStatus(d.status, status));

  const donutSegments = [
    { label: "On time", value: summary.present, color: STATUS_COLORS.present },
    { label: "Late", value: summary.lateDays, color: STATUS_COLORS.late },
    { label: "Absent", value: summary.absent, color: STATUS_COLORS.absent },
    { label: "On leave", value: summary.onLeave, color: STATUS_COLORS.leave },
    {
      label: "Missing punch",
      value: summary.missingPunch,
      color: STATUS_COLORS.missing,
    },
  ];

  const series = [
    {
      name: "On time",
      color: STATUS_COLORS.present,
      values: data.periodSeries.map((d) => d.present),
    },
    {
      name: "Late",
      color: STATUS_COLORS.late,
      values: data.periodSeries.map((d) => d.late),
    },
    {
      name: "Absent",
      color: STATUS_COLORS.absent,
      values: data.periodSeries.map((d) => d.absent),
    },
    {
      name: "On leave",
      color: STATUS_COLORS.leave,
      values: data.periodSeries.map((d) => d.leave),
    },
    {
      name: "Missing punch",
      color: STATUS_COLORS.missing,
      values: data.periodSeries.map((d) => d.missing),
    },
  ];

  return (
    <div className="space-y-6 pb-3">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-green-800">
            <span className="text-black!">{greetingNow()},</span>{" "}
            <span className="capitalize">{fullName}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your personal attendance for{" "}
            <span className="tracking-wider text-green-800">{monthLabel}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              <span className="font-semibold text-slate-800">Code:</span>{" "}
              {data.employee.employeeCode}
            </span>
            <span>
              <span className="font-semibold text-slate-800">Department:</span>{" "}
              {data.employee.department}
            </span>
            {data.employee.designation && (
              <span>
                <span className="font-semibold text-slate-800">
                  Designation:
                </span>{" "}
                {data.employee.designation}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/attendance/my${withStatus(
              isMonth
                ? { month: monthParam(data.year, data.month) }
                : periodQuery(period),
              status,
            )}`}
            className="rounded-lg green-button-inverse hoverEffect"
          >
            Full attendance table
          </Link>
          <Link href="/leaves/request" className="green-button hoverEffect">
            + Request Leave
          </Link>
        </div>
      </div>

      {/* Pick a day or a month */}
      <section className={`${card} flex flex-wrap items-end gap-6 p-4`}>
        <form method="get" action={basePath} className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="my-date" className="text-sm font-medium">
              Show a day
            </label>
            <input
              id="my-date"
              type="date"
              name="date"
              required
              defaultValue={selectedIso}
              className="block rounded border px-3 py-2 custom-input"
            />
          </div>
          <button type="submit" className="green-button hoverEffect">
            Show day
          </button>
        </form>

        <PeriodFilters
          key={`${period.kind}-${toIsoDate(period.start)}-${toIsoDate(period.end)}-${status}`}
          basePath={basePath}
          kind={period.kind}
          month={monthParam(data.year, data.month)}
          year={period.start.getUTCFullYear()}
          from={toIsoDate(period.start)}
          to={toIsoDate(period.end)}
          status={status}
        />
      </section>

      {period.clamped && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
          The range was longer than a year, so only the last 366 days up to
          your end date are counted.
        </p>
      )}

      {/* Days matching the status filter, e.g. every absent day in the period */}
      {status !== "ALL" && (
        <section className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="font-semibold">
                {statusFilterLabel(status)} ({filteredDays.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Days in {monthLabel} that match this status
              </p>
            </div>
            <Link
              href={`/attendance/my${withStatus(periodQuery(period), status)}`}
              className="text-sm font-medium text-green-700 hover:underline"
            >
              Open full table
            </Link>
          </div>
          {filteredDays.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-slate-500">
              No days match this filter.
            </p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-120 text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Check in</th>
                    <th className="px-3 py-3 font-medium">Check out</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDays.map((d) => (
                    <tr key={d.iso} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-5 py-3">
                        {longDate(new Date(`${d.iso}T00:00:00Z`))}
                      </td>
                      <td className="px-3 py-3">{clockText(d.checkIn)}</td>
                      <td className="px-3 py-3">{clockText(d.checkOut)}</td>
                      <td className="px-5 py-3">
                        <AttendanceStatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Selected day */}
      <section className={`${card} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{longDate(data.date)}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your record for this day
            </p>
          </div>
          <AttendanceStatusBadge status={selected.status} />
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-3 xl:grid-cols-6">
          <div>
            <dt className="text-slate-500">Check in</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {clockText(selected.checkIn)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Check out</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {clockText(selected.checkOut)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Time worked</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {selected.checkIn && selected.checkOut
                ? formatMinutes(selected.workingMinutes)
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Late by</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {selected.lateMinutes > 0
                ? formatMinutes(selected.lateMinutes)
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Left early by</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {selected.earlyLeaveMinutes > 0
                ? formatMinutes(selected.earlyLeaveMinutes)
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Overtime</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {selected.overtimeMinutes > 0
                ? formatMinutes(selected.overtimeMinutes)
                : "-"}
            </dd>
          </div>
        </dl>

        <DayNote day={selected} />
      </section>

      {/* Month summary cards */}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="My attendance summary"
      >
        <StatCard
          tint="green"
          icon={<CircleCheck size={22} aria-hidden />}
          label="Days attended"
          value={summary.attended}
          sub={`${summary.present} on time, ${summary.lateDays} late`}
        />
        <StatCard
          tint="red"
          icon={<CircleX size={22} aria-hidden />}
          label="Absent"
          value={summary.absent}
          sub="Working days with no punch"
        />
        <StatCard
          tint="amber"
          icon={<Clock size={22} aria-hidden />}
          label="Late arrivals"
          value={summary.lateDays}
          sub={`${summary.shortLeave} short leave, ${summary.halfDay} half day · ${formatMinutes(summary.lateMinutes)} late in total`}
        />
        <StatCard
          tint="amber"
          icon={<CircleAlert size={22} aria-hidden />}
          label="Missing punch"
          value={summary.missingPunch}
          sub={
            summary.missingPunch > 0
              ? "Contact HR to correct these days"
              : "Nothing to correct"
          }
        />
        <StatCard
          tint="blue"
          icon={<Plane size={22} aria-hidden />}
          label="On leave"
          value={summary.onLeave}
          sub="Approved leave days"
        />
        <StatCard
          tint="green"
          icon={<Timer size={22} aria-hidden />}
          label="Overtime"
          value={formatMinutes(summary.overtimeMinutes)}
          sub={`${formatMinutes(summary.workingMinutes)} worked in total`}
        />
      </section>

      {/* Chart, donut and calendar */}
      <section className="grid gap-4 xl:grid-cols-12">
        <div className={`${card} p-5 xl:col-span-6`}>
          <div className="mb-3">
            <h2 className="font-semibold">My attendance overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              {data.periodDays.length > 62 ? "Month by month" : "Day by day"} for{" "}
              {monthLabel}
            </p>
          </div>
          <BarChart
            ariaLabel={`My attendance for ${monthLabel}`}
            labels={data.periodSeries.map((d) => d.label)}
            series={series}
            labelEvery={
              data.periodSeries.length > 40
                ? 5
                : data.periodSeries.length > 16
                  ? 2
                  : 1
            }
            height={300}
          />
        </div>

        <div className={`${card} p-5 xl:col-span-3`}>
          <h2 className="mb-3 font-semibold">
            {isMonth ? "Monthly summary" : "Summary"}
          </h2>
          <DonutChart
            ariaLabel={`My attendance summary for ${monthLabel}`}
            segments={donutSegments}
            centerLabel="Attended"
            centerValue={summary.attended}
          />
          <ul className="mt-4 space-y-2 text-sm">
            {donutSegments.map((segment) => (
              <li
                key={segment.label}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: segment.color }}
                  />
                  {segment.label}
                </span>
                <span className="tabular-nums text-slate-600">
                  {segment.value}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 border-t pt-2 text-slate-500">
              <span>Weekly off / holidays</span>
              <span className="tabular-nums">
                {summary.weeklyOff} / {summary.holidays}
              </span>
            </li>
          </ul>
        </div>

        <div className={`${card} p-5 xl:col-span-3`}>
          <MonthCalendar
            year={data.year}
            month={data.month}
            calendar={data.calendar}
            selectedIso={selectedIso}
            basePath={basePath}
          />
        </div>
      </section>

      {/* My leave requests */}
      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="font-semibold">My leave requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Check the status of your latest requests
            </p>
          </div>
          <Link
            href="/leaves/my"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {data.leaveRequests.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <ClipboardList className="mx-auto mb-2 text-slate-400" size={28} />
            <p className="text-sm text-slate-500">
              You have not submitted any leave requests yet.
            </p>
            <Link
              href="/leaves/request"
              className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
            >
              Request leave
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Leave type</th>
                  <th className="px-3 py-3 font-medium">From</th>
                  <th className="px-3 py-3 font-medium">To</th>
                  <th className="px-3 py-3 font-medium">Days</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Waiting for</th>
                </tr>
              </thead>
              <tbody>
                {data.leaveRequests.map((leave) => (
                  <tr key={leave.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium">{leave.type}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {shortDate(leave.from)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {shortDate(leave.to)}
                    </td>
                    <td className="px-3 py-3">{leave.days}</td>
                    <td className="px-3 py-3">
                      <LeaveStatusBadge status={leave.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {leave.status === "PENDING" &&
                      leave.approverLevel &&
                      leave.approverLevel !== "STAFF"
                        ? APPROVER_LABEL[
                            leave.approverLevel as "DD" | "CEO" | "CHAIRMAN"
                          ]
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
