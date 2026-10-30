import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getLeaveBalances } from "@/services/leave.service";
import LeaveTabs from "@/components/LeaveTabs";
import ScrollTable from "@/components/ScrollTable";

type SearchParams = Promise<{ year?: string }>;

export default async function LeaveBalancesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.LEAVES_MANAGE);
  const sp = await searchParams;

  const parsed = Number(sp.year);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : new Date().getFullYear();
  const { types, employees, usage } = await getLeaveBalances(year);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Leave balances {year}</h1>
      <LeaveTabs active="/leaves/balances" />

      <form
        method="get"
        className="flex items-center gap-2 form-style bg-white p-3"
      >
        <input
          type="number"
          name="year"
          defaultValue={year}
          min={2000}
          max={2100}
          className="w-28 rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="green-button hoverEffect"
        >
          Show
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        Each cell shows days taken (approved) out of the yearly quota. Pending
        days are shown in brackets.
      </p>

      <ScrollTable>
        <table className="w-full min-w-max form-style shadow-lg text-sm">
          <thead className="sticky top-0 z-10 bg-green-800 text-white text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Employee</th>
              {types.map((t) => (
                <th key={t.id} className="p-3">
                  {t.name}
                  <div className="text-xs font-normal text-white/50">
                    {t.yearlyQuotaDays === null
                      ? "no limit"
                      : `${t.yearlyQuotaDays} days`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {types.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-center text-zinc-500">
                  No active leave types.
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{e.employeeCode}</td>
                <td className="p-3 font-medium">{e.name}</td>
                {types.map((t) => {
                  const u = usage[`${e.id}|${t.id}`] ?? {
                    approved: 0,
                    pending: 0,
                  };
                  const over =
                    t.yearlyQuotaDays !== null &&
                    u.approved >= t.yearlyQuotaDays;
                  return (
                    <td
                      key={t.id}
                      className={`p-3 ${over ? "font-medium text-red-700" : ""}`}
                    >
                      {u.approved}
                      {t.yearlyQuotaDays !== null
                        ? ` / ${t.yearlyQuotaDays}`
                        : ""}
                      {u.pending > 0 && (
                        <span className="text-zinc-500"> ({u.pending})</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
