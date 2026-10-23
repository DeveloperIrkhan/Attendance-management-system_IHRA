import Link from "next/link";
import {
  CircleCheck,
  CircleX,
  Clock,
  Plane,
  ClipboardList,
} from "lucide-react";

import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import LeaveStatusBadge from "@/components/LeaveStatusBadge";
import MonthCalendar from "./MonthCalendar";
import StatCard from "./StatCard";

import { clockText, toIsoDate } from "@/lib/attendance/dates";
import { MONTHS } from "@/lib/attendance/months";
import { STATUS_COLORS } from "@/lib/attendance/colors";

// Data specifically for the logged-in employee.
const now = new Date();
const hour = now.getHours();
const greeting =
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

export type MyDashboardData = {
  employee: {
    employeeCode: string;
    department: string;
    designation: string;
  };

  year: number;
  month: number;
  date: Date;
  todayIso: string;

  summary: {
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    shortLeave: number;
    halfDay: number;
  };

  series: {
    day: number;
    present: number;
    late: number;
    absent: number;
    leave: number;
  }[];

  calendar: Record<string, { title?: string }>;

  attendance: {
    id: string;
    date: Date;
    status: string;
    checkIn: Date | null;
    checkOut: Date | null;
  }[];

  leaveRequests: {
    id: string;
    type: string;
    from: Date;
    to: Date;
    status: string;
  }[];
};

type Props = {
  data: MyDashboardData;
  fullName: string;
};

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

export default function MyDashboard({ data, fullName }: Props) {
  const monthLabel = `${MONTHS[data.month - 1]} ${data.year}`;

  const attended =
    data.summary.present +
    data.summary.late +
    data.summary.shortLeave +
    data.summary.halfDay;

  const donutSegments = [
    {
      label: "Present",
      value: data.summary.present,
      color: STATUS_COLORS.present,
    },
    {
      label: "Late",
      value: data.summary.late,
      color: STATUS_COLORS.late,
    },
    {
      label: "Absent",
      value: data.summary.absent,
      color: STATUS_COLORS.absent,
    },
    {
      label: "On leave",
      value: data.summary.onLeave,
      color: STATUS_COLORS.leave,
    },
  ];

  const series = [
    {
      name: "Present",
      color: STATUS_COLORS.present,
      values: data.series.map((day) => day.present),
    },
    {
      name: "Late",
      color: STATUS_COLORS.late,
      values: data.series.map((day) => day.late),
    },
    {
      name: "Absent",
      color: STATUS_COLORS.absent,
      values: data.series.map((day) => day.absent),
    },
    {
      name: "On leave",
      color: STATUS_COLORS.leave,
      values: data.series.map((day) => day.leave),
    },
  ];

  return (
    <div className="space-y-6 pb-3">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-green-800">
            <span className="text-black!">{greeting}!</span>
            {"  "}
            <span className="capitalize">{fullName}.</span>
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Your personal attendance dashboard for
            <span className="tracking-wider text-green-800"> {monthLabel}</span>
          </p>

          <p className="mt-1 text-sm text-slate-500 flex gap-2">
            <span className="font-semibold text-slate-800">Employee Code:</span>
            {data.employee.employeeCode}
            <span className="font-semibold text-slate-800">
              Employee Dept :
            </span>
            {data.employee.department}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/attendance/my"
            className="rounded-lg green-button-inverse hoverEffect"
          >
            My Attendance
          </Link>

          <Link href="/leaves/request" className="green-button hoverEffect">
            + Request Leave
          </Link>
        </div>
      </div>

      {/* Personal summary cards */}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="My attendance summary"
      >
        <StatCard
          tint="green"
          icon={<CircleCheck size={22} aria-hidden />}
          label="Present"
          value={attended}
          sub="Days attended this month"
        />

        <StatCard
          tint="red"
          icon={<CircleX size={22} aria-hidden />}
          label="Absent"
          value={data.summary.absent}
          sub="Days marked absent"
        />

        <StatCard
          tint="amber"
          icon={<Clock size={22} aria-hidden />}
          label="Late"
          value={data.summary.late}
          sub="Late arrivals this month"
        />

        <StatCard
          tint="blue"
          icon={<Plane size={22} aria-hidden />}
          label="On leave"
          value={data.summary.onLeave}
          sub="Attendance days marked as leave"
        />
      </section>

      {/* Attendance chart and calendar */}
      <section className="grid gap-4 xl:grid-cols-12">
        <div className={`${card} p-5 xl:col-span-6`}>
          <div className="mb-3">
            <h2 className="font-semibold">My attendance overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Daily attendance for {monthLabel}
            </p>
          </div>

          <BarChart
            ariaLabel={`My attendance for ${monthLabel}`}
            labels={data.series.map((day) => String(day.day))}
            series={series}
            labelEvery={2}
            height={300}
          />
        </div>

        <div className={`${card} p-5 xl:col-span-3`}>
          <h2 className="mb-3 font-semibold">Monthly summary</h2>

          <DonutChart
            ariaLabel={`My attendance summary for ${monthLabel}`}
            segments={donutSegments}
            centerLabel="Attended"
            centerValue={attended}
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
          </ul>
        </div>

        <div className={`${card} p-5 xl:col-span-3`}>
          <MonthCalendar
            year={data.year}
            month={data.month}
            calendar={data.calendar}
            selectedIso={toIsoDate(data.date)}
            basePath="/dashboard"
          />
        </div>
      </section>

      {/* My attendance records */}
      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="font-semibold">My recent attendance</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your latest attendance records
            </p>
          </div>

          <Link
            href="/attendance/my"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-120 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Check in</th>
                <th className="px-3 py-3 font-medium">Check out</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {data.attendance.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                data.attendance.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-5 py-3">
                      {shortDate(record.date)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {clockText(record.checkIn)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {clockText(record.checkOut)}
                    </td>

                    <td className="px-5 py-3">
                      <AttendanceStatusBadge status={record.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* My leave requests */}
      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="font-semibold">My leave requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Check the status of your requests
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
              You haven't submitted any leave requests yet.
            </p>
            <Link
              href="/leaves/my"
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
                  <th className="px-5 py-3 font-medium">Status</th>
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

                    <td className="px-5 py-3">
                      <LeaveStatusBadge status={leave.status} />
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
