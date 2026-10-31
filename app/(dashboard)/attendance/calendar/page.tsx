import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { MONTHS } from "@/lib/attendance/months";
import { toIsoDate } from "@/lib/attendance/dates";
import { getMonthCalendar } from "@/services/settings.service";
import SimpleForm from "@/components/SimpleForm";
import RowActionForm from "@/components/RowActionForm";
import WeeklyOffForm from "@/components/WeeklyOffForm";
import {
  addHolidayAction,
  deleteHolidayAction,
  resetMonthlyOffDaysAction,
  setMonthlyOffDaysAction,
} from "./actions";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const dayList = (days: number[]) =>
  days.length
    ? [...days]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => DAY_NAMES[d])
        .join(", ")
    : "none";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_SETTINGS);
  const sp = await searchParams;

  const now = new Date();
  let year = Number(sp.year) || now.getFullYear();
  let month = Number(sp.month) || now.getMonth() + 1;
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const cal = await getMonthCalendar(year, month);
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  // const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <div className="w-full flex justify-center items-center">
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            Calendar: {MONTHS[month - 1]} {year}
          </h1>
          <div className="space-x-2 text-sm">
            <Link
              href={`/attendance/calendar?year=${prev.y}&month=${prev.m}`}
              className="rounded border border-green-900 text-green-900 
              hover:bg-green-900 hover:text-white px-3 py-1 
              hoverEffect"
            >
              Previous
            </Link>
            <Link
              href={`/attendance/calendar?year=${next.y}&month=${next.m}`}
              className="rounded border border-green-900 text-green-900 
              hover:bg-green-900 hover:text-white px-3 py-1 
              hoverEffect"
            >
              Next
            </Link>
          </div>
        </div>

        <section className="space-y-3 rounded shadow-lg bg-white p-4">
          <h2 className="font-medium">Weekly off days</h2>
          <p className="text-sm text-zinc-600">
            {cal.isOverride
              ? `Custom for this month: ${dayList(cal.weeklyOffDays)}. Default is ${dayList(cal.defaultWeeklyOffDays)}.`
              : `Using the default: ${dayList(cal.defaultWeeklyOffDays)}.`}
          </p>
          <WeeklyOffForm
            key={`${year}-${month}-${cal.weeklyOffDays.join(",")}`}
            action={setMonthlyOffDaysAction}
            year={year}
            month={month}
            selected={cal.weeklyOffDays}
          />
          {cal.isOverride && (
            <RowActionForm
              action={resetMonthlyOffDaysAction}
              id={`${year}-${month}`}
              label="Use the default for this month"
              fields={{ year: String(year), month: String(month) }}
            />
          )}
        </section>

        <section className="space-y-3 rounded shadow-lg bg-white p-4">
          <h2 className="font-medium">Holidays and special days off</h2>
          <div className="max-w-sm">
            <SimpleForm
              action={addHolidayAction}
              resetOnSuccess
              submitLabel="Add holiday"
              fields={[
                {
                  name: "date",
                  label: "Date",
                  type: "date",
                  required: true,
                  defaultValue: monthStart,
                },
                {
                  name: "title",
                  label: "Name",
                  required: true,
                  placeholder: "e.g. Pakistan Day",
                },
              ]}
            />
          </div>

          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Name</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {cal.holidays.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-zinc-500">
                    No holidays this month.
                  </td>
                </tr>
              )}
              {cal.holidays.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="p-3">{toIsoDate(h.date)}</td>
                  <td className="p-3">{h.title}</td>
                  <td className="p-3 text-right">
                    <RowActionForm
                      action={deleteHolidayAction}
                      id={h.id}
                      label="Delete"
                      danger
                      confirmMessage={`Delete "${h.title}"?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-zinc-500">
            After changing the calendar for a month that is already imported,
            open that import and click &quot;Process attendance&quot; to apply
            it.
          </p>
        </section>
      </div>
    </div>
  );
}
