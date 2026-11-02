import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SHORT_ROUTE_MAX_DAYS } from "@/lib/leave/approval-routing";
import { listLeaveTypes, listMyLeaveRequests } from "@/services/leave.service";
import LeaveRequestForm from "@/components/LeaveRequestForm";
import { createLeaveRequestAction } from "../actions";
import Link from "next/link";
import { toIsoDate } from "@/lib/attendance/dates";
import { getMyRejectedRequest } from "@/services/leave-again.service";

export default async function MyLeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ again?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.LEAVES_REQUEST);
  const { again } = await searchParams;
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

  const [types, myRequests, rejectedToRepeat] = await Promise.all([
    listLeaveTypes(),
    listMyLeaveRequests(user.employee.id),
    // only your own rejected request can be used to fill the form
    again ? getMyRejectedRequest(user.employee.id, again) : null,
  ]);
  const activeTypes = types.filter((t) => t.isActive);
  const rejected = myRequests
    .filter((r) => r.status === "REJECTED")
    .slice(0, 5);
  const defaults = rejectedToRepeat
    ? {
        leaveTypeId: rejectedToRepeat.leaveTypeId,
        startDate: toIsoDate(rejectedToRepeat.startDate),
        endDate: toIsoDate(rejectedToRepeat.endDate),
        reason: rejectedToRepeat.reason ?? "",
      }
    : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My leaves</h1>

      <section className="rounded-md bg-white p-4 shadow-md">
        <h2 className="mb-1 font-medium">
          {defaults ? "Request again" : "Apply for leave"}
        </h2>
        {defaults && (
          <p className="mb-3 rounded bg-green-50 p-2 text-sm text-green-800">
            The details of your rejected request are filled in below. Change
            anything you need, then send it again.
          </p>
        )}
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
            // start fresh when another rejected request is picked
            key={again ?? "new"}
            defaults={defaults}
            successHref={defaults ? "/leaves/my" : undefined}
            action={createLeaveRequestAction}
            leaveTypes={activeTypes.map((t) => ({
              id: t.id,
              label: `${t.name}${t.yearlyQuotaDays !== null ? ` (${t.yearlyQuotaDays} days/year)` : ""}`,
            }))}
          />
        )}
      </section>

      {rejected.length > 0 && (
        <section className="rounded-md bg-white p-4 shadow-md">
          <h2 className="mb-3 font-medium">Rejected requests</h2>
          <ul className="space-y-2">
            {rejected.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span>
                  {r.leaveType.name}, {toIsoDate(r.startDate)} to{" "}
                  {toIsoDate(r.endDate)} ({r.days} working day
                  {r.days === 1 ? "" : "s"}){" "}
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Rejected
                  </span>
                </span>
                <Link
                  href={`/leaves/request?again=${r.id}`}
                  className="rounded bg-green-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Request Again
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
