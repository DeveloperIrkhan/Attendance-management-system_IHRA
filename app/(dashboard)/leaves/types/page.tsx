import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listLeaveTypes } from "@/services/leave.service";
import LeaveTabs from "@/components/LeaveTabs";
import LeaveTypeForm from "@/components/LeaveTypeForm";
import RowActionForm from "@/components/RowActionForm";
import {
  createLeaveTypeAction,
  toggleLeaveTypeAction,
  updateLeaveTypeAction,
} from "../actions";

export default async function LeaveTypesPage() {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const types = await listLeaveTypes();

  return (
    <div className="w-full space-y-4">
      <h1 className="text-xl font-semibold">Leave types</h1>
      <LeaveTabs active="/leaves/types" />
      <div className="flex justify-center items-center">
        <section className="w-1/3 rounded-md shadow-md bg-white p-4">
          <h2 className="mb-3 font-medium">Add leave type</h2>
          <LeaveTypeForm
            action={createLeaveTypeAction}
            submitLabel="Add leave type"
            resetOnSuccess
          />
        </section>
      </div>
      <div className="overflow-x-auto rounded-md shadow-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-green-800 text-white text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Quota per year</th>
              <th className="p-3">Pay</th>
              <th className="p-3">Requests</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  No leave types yet. Add the ones your organization uses (for
                  example Casual, Sick, Annual, Unpaid).
                </td>
              </tr>
            )}
            {types.map((t) => (
              <tr key={t.id} className="border-t align-top">
                <td className="p-3 font-medium">{t.name}</td>
                <td className="p-3">
                  {t.yearlyQuotaDays === null
                    ? "No limit"
                    : `${t.yearlyQuotaDays} days`}
                </td>
                <td className="p-3">{t.isPaid ? "Paid" : "Unpaid"}</td>
                <td className="p-3">{t._count.leaveRequests}</td>
                <td className="p-3">{t.isActive ? "Active" : "Inactive"}</td>
                <td className="space-y-2 p-3">
                  <details>
                    <summary className="cursor-pointer text-xs underline">
                      Edit
                    </summary>
                    <div className="mt-2 max-w-xs">
                      <LeaveTypeForm
                        action={updateLeaveTypeAction}
                        submitLabel="Save"
                        id={t.id}
                        initial={{
                          name: t.name,
                          isPaid: t.isPaid,
                          yearlyQuotaDays: t.yearlyQuotaDays,
                        }}
                      />
                    </div>
                  </details>
                  <RowActionForm
                    action={toggleLeaveTypeAction}
                    id={t.id}
                    label={t.isActive ? "Deactivate" : "Activate"}
                    fields={{ active: String(!t.isActive) }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-green-500">
        Leave types are deactivated, not deleted, so past requests keep their
        history.
      </p>
    </div>
  );
}
