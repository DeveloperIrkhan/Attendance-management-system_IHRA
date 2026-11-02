import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSettings } from "@/services/settings.service";
import SettingsForm from "@/components/SettingsForm";
import { updateSettingsAction } from "./action";
import { formatMinutesToHours, formatTime } from "@/lib/time";
// Saving can recalculate months of device attendance, which may take a while on the host.
export const maxDuration = 60;

export default async function AttendanceSettingsPage() {
  await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);
  const s = await getSettings();

  return (
    <div className="w-full flex justify-center items-center">
      <div className="space-y-4">
        <h1 className="text-2xl text-green-800 font-semibold">
          Attendance rules
        </h1>
        <p className="max-w-3xl text-sm text-green-600">
          These rules are used when attendance is processed. Changing them does
          not alter existing records until you click &quot;Process
          attendance&quot; on an import batch. Days that HR corrected by hand
          are never overwritten.
        </p>
        <div className="p-4 bg-green-100 rounded-md shadow-xl">
          <h2 className="text-lg font-semibold text-green-800">
            Current Settings
          </h2>
          <ul className="list-disc list-inside text-sm text-green-600">
            <li>
              Office Starting Time:{" "}
              <span className="font-semibold ml-2">
                {formatTime(s.shiftStart)}
              </span>
            </li>
            <li>
              Office Ending Time:{" "}
              <span className="font-semibold ml-2">
                {formatTime(s.shiftEnd)}
              </span>
            </li>
            <li>
              Grace Period:{" "}
              <span className="font-semibold ml-2">
                {s.graceMinutes} minutes
              </span>
            </li>
            <li>
              Half Day After:{" "}
              <span className="font-semibold ml-2">
                {formatMinutesToHours(s.halfDayAfterMinutes)}
              </span>
            </li>
            <li>
              Duplicate Punch Time:{" "}
              <span className="font-semibold ml-2">
                {s.duplicatePunchMinutes} minutes
              </span>
            </li>
            <li>
              Earliest Punch Time:{" "}
              <span className="font-semibold ml-2">
                {formatTime(s.earliestPunch)}
              </span>
            </li>
            <li>
              Latest Punch Time:{" "}
              <span className="font-semibold ml-2">
                {formatTime(s.latestPunch)}
              </span>
            </li>
            <li>
              Short Leave Maximum:{" "}
              <span className="font-semibold ml-2">
                {formatMinutesToHours(s.shortLeaveMaxMinutes)}
              </span>
            </li>
          </ul>
        </div>
        <SettingsForm
          action={updateSettingsAction}
          values={{
            shiftStart: s.shiftStart,
            shiftEnd: s.shiftEnd,
            graceMinutes: s.graceMinutes,
            halfDayAfterMinutes: s.halfDayAfterMinutes,
            duplicatePunchMinutes: s.duplicatePunchMinutes,
            earliestPunch: s.earliestPunch,
            latestPunch: s.latestPunch,
            overtimeMinMinutes: s.overtimeMinMinutes,
            offDayWorkIsOvertime: s.offDayWorkIsOvertime,
            defaultWeeklyOffDays: s.defaultWeeklyOffDays,
            shortLeaveMaxMinutes: s.shortLeaveMaxMinutes,
            shortLeaveMonthlyLimit: s.shortLeaveMonthlyLimit,
            shortLeaveExcusesLateArrival: s.shortLeaveExcusesLateArrival,
            earlyLeaveHalfDayBefore: s.earlyLeaveHalfDayBefore,
            earlyLeaveShortLeaveBefore: s.earlyLeaveShortLeaveBefore,
          }}
        />
      </div>
    </div>
  );
}
