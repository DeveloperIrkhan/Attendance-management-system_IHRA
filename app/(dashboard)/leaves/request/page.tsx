import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SHORT_ROUTE_MAX_DAYS } from "@/lib/leave/approval-routing";
import { listLeaveTypes } from "@/services/leave.service";
import LeaveRequestForm from "@/components/LeaveRequestForm";
import { createLeaveRequestAction } from "../actions";

export default async function MyLeavesPage() {
  const user = await requirePermission(PERMISSIONS.LEAVES_REQUEST);

  if (!user.employee) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">My leaves</h1>
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Your user account is not linked to an employee record yet, so you
          cannot apply for leave. Ask an Admin to link it under Users.
        </p>
      </div>
    );
  }

  const [types] = await Promise.all([listLeaveTypes()]);
  const activeTypes = types.filter((t) => t.isActive);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My leaves</h1>

      <section className="rounded-md bg-white p-4 shadow-md">
        <h2 className="mb-1 font-medium">Apply for leave</h2>
        <p className="mb-4 text-sm text-zinc-600">
          Only working days count. Weekly off days and holidays inside your
          dates are not deducted. Requests of up to {SHORT_ROUTE_MAX_DAYS}{" "}
          working days and longer requests go to different approvers. You will
          see who is deciding once you send it.
        </p>
        {activeTypes.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No leave types have been set up yet. Ask HR to add them.
          </p>
        ) : (
          <LeaveRequestForm
            action={createLeaveRequestAction}
            leaveTypes={activeTypes.map((t) => ({
              id: t.id,
              label: `${t.name}${t.yearlyQuotaDays !== null ? ` (${t.yearlyQuotaDays} days/year)` : ""}`,
            }))}
          />
        )}
      </section>
    </div>
  );
}
