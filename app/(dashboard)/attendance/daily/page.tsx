import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMinutes } from "@/lib/attendance/attendance-rules";
import {
  addDays,
  clockText,
  parseIsoDate,
  toIsoDate,
} from "@/lib/attendance/dates";
import {
  getDailyAttendance,
  getLatestAttendanceDate,
} from "@/services/attendance.service";
import { listDepartments } from "@/services/department.service";
import AttendanceStatusBadge, {
  STATUS_ORDER,
} from "@/components/AttendanceStatusBadge";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";

type SearchParams = Promise<{ date?: string; department?: string }>;

export default async function DailyAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_VIEW);
  const sp = await searchParams;
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_VIEW);
  const canEdit = hasPermission(user, PERMISSIONS.ATTENDANCE_EDIT);
  const date = parseIsoDate(sp.date) ?? (await getLatestAttendanceDate());
  if (!date) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Daily attendance</h1>
        <p className="text-zinc-600">
          No attendance has been processed yet. Import a file first.{" "}
          <Link href="/attendance/import" className="underline">
            Go to Import
          </Link>
        </p>
      </div>
    );
  }

  const departmentId = sp.department || undefined;
  const [{ records, counts }, departments] = await Promise.all([
    getDailyAttendance(date, departmentId),
    listDepartments(),
  ]);

  const iso = toIsoDate(date);
  const link = (d: Date) => {
    const p = new URLSearchParams({ date: toIsoDate(d) });
    if (departmentId) p.set("department", departmentId);
    return `/attendance/daily?${p.toString()}`;
  };
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Daily attendance: {iso}{" "}
          <span className="text-sm font-normal text-zinc-500">{weekday}</span>
        </h1>
        <div className="space-x-2 text-sm">
          <Link
            href={link(addDays(date, -1))}
            className="rounded border border-green-800 bg-green-800 text-white px-3 py-1 hover:bg-white hover:text-green-800 hoverEffect"
          >
            Previous day
          </Link>
          <Link
            href={link(addDays(date, 1))}
            className="rounded border border-green-800 bg-green-800 text-white px-3 py-1 hover:bg-white hover:text-green-800 hoverEffect"
          >
            Next day
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-2 rounded shadow-lg bg-white p-3"
      >
        <input
          type="date"
          name="date"
          defaultValue={iso}
          className="rounded border border-zinc-400 px-3 py-2 text-sm"
        />
        <select
          name="department"
          defaultValue={departmentId ?? ""}
          className="rounded border border-zinc-400 px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border px-4 py-2 text-sm bg-green-800 text-white hoverEffect hover:bg-white hover:text-green-800"
        >
          Show Result
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <span
            key={s}
            className="flex items-center gap-2 rounded bg-white px-3 py-1"
          >
            <AttendanceStatusBadge status={s} />{" "}
            <span className="">{counts[s]}</span>
          </span>
        ))}
        {records.length === 0 && (
          <span className="text-zinc-500">No records for this date.</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-md p-2 shadow-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-white text-left">
            <tr>
              <th className="p-3">Code</th>
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
            {records.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-3">{r.employee.employeeCode}</td>
                <td className="p-3 font-medium">{r.employee.name}</td>
                <td className="p-3">{r.employee.department.name}</td>
                <td className="p-3">{clockText(r.checkIn)}</td>
                <td className="p-3">{clockText(r.checkOut)}</td>
                <td className="p-3">
                  {r.workingMinutes ? formatMinutes(r.workingMinutes) : "-"}
                </td>
                <td className="p-3">{r.lateMinutes || "0"}</td>
                <td className="p-3">
                  {r.overtimeMinutes ? formatMinutes(r.overtimeMinutes) : "-"}
                </td>
                <td className="p-3">
                  <AttendanceStatusBadge status={r.status} />
                </td>

                {canEdit && (
                  <td className="p-3">
                    <Link
                      href={`/attendance/records/${r.id}/edit`}
                      className="rounded border 
                      border-green-800 text-green-800 bg-white
                      hover:bg-green-800 hover:text-white hoverEffect px-2 py-1 text-xs"
                    >
                      Edit
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
