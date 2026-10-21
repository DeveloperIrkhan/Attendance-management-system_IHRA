import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/attendance/months";
import { monthParam } from "@/lib/attendance/dates";
import type { DayTone } from "@/services/dashboard.service";

const DOT: Record<DayTone, string> = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-red-500",
  holiday: "bg-violet-400",
  off: "",
  none: "",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MonthCalendar({
  year,
  month,
  calendar,
  selectedIso,
  basePath,
}: {
  year: number;
  month: number;
  calendar: Record<string, { tone: DayTone; title: string }>;
  selectedIso: string;
  basePath: string;
}) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday =
    (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex gap-1">
          <Link
            href={`${basePath}?month=${monthParam(prev.y, prev.m)}`}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft size={16} aria-hidden />
          </Link>
          <Link
            href={`${basePath}?month=${monthParam(next.y, next.m)}`}
            aria-label="Next month"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-slate-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const info = calendar[iso];
          const selected = iso === selectedIso;
          const muted = info?.tone === "off" || info?.tone === "holiday";
          return (
            <Link
              key={iso}
              href={`${basePath}?date=${iso}`}
              title={info?.title}
              aria-current={selected ? "date" : undefined}
              className={`mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm tabular-nums ${
                selected
                  ? "bg-emerald-600 font-semibold text-white"
                  : muted
                    ? "text-slate-400 hover:bg-slate-100"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="leading-none">{day}</span>
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${selected && info ? "bg-white" : info ? DOT[info.tone] : ""}`}
              />
            </Link>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          90%+ attended
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          75 to 90%
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          under 75%
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          holiday
        </li>
      </ul>
    </div>
  );
}
