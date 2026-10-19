import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { clockText, toIsoDate } from "@/lib/attendance/dates";
import { getAttendanceRecord } from "@/services/attendance-correction.service";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import CorrectionForm from "@/components/CorrectionForm";
import { correctAttendanceAction } from "../../actions";

export default async function CorrectAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_EDIT);
  const { id } = await params;

  const record = await getAttendanceRecord(id);
  if (!record) notFound();

  const blank = (d: Date | null) => (d ? clockText(d) : "");

  return (
    <div className="w-screen flex justify-center items-center">
      <div className="space-y-4">
        <h1 className="text-xl text-green-800 font-semibold">
          Correct attendance
        </h1>

        <div className="max-w-xl space-y-1 rounded-md shadow-lg bg-white p-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              <span className="font-bold">Employee Name:</span>{" "}
              {record.employee.name}
            </span>
            <span className="font-medium">
              <span className="font-bold">Employee COde:</span>{" "}
              {record.employee.employeeCode}
            </span>
            <span className="font-medium">
              <span className="font-bold">Employee Department:</span>{" "}
              {record.employee.department.name}
            </span>
          </div>
          <p>Date: {toIsoDate(record.date)}</p>
          <p className="flex items-center gap-2">
            Current status: <AttendanceStatusBadge status={record.status} />
          </p>
          <p>
            Recorded: in {clockText(record.checkIn)}, out{" "}
            {clockText(record.checkOut)}
          </p>
          {record.remarks && <p className="text-zinc-600">{record.remarks}</p>}
          {record.isManual && (
            <p className="text-amber-700">
              This day was already corrected by HR. Saving will replace that
              correction.
            </p>
          )}
        </div>

        <CorrectionForm
          action={correctAttendanceAction}
          id={record.id}
          initialIn={blank(record.checkIn)}
          initialOut={blank(record.checkOut)}
        />
      </div>
    </div>
  );
}
