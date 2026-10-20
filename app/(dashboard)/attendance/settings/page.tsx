import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSettings } from "@/services/settings.service";
import SettingsForm from "@/components/SettingsForm";
import { updateSettingsAction } from "./action";
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
          }}
        />
      </div>
    </div>
  );
}
