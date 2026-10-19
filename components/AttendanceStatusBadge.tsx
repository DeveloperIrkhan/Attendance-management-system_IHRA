const styles: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-green-100 text-green-800" },
  SHORT_LEAVE: {
    label: "Short leave",
    className: "bg-amber-100 text-amber-800",
  },
  HALF_DAY: { label: "Half day", className: "bg-orange-100 text-orange-800" },
  LATE: { label: "Late", className: "bg-amber-100 text-amber-800" },
  ABSENT: { label: "Absent", className: "bg-red-100 text-red-800" },
  INCOMPLETE: {
    label: "Missing punch",
    className: "bg-purple-100 text-purple-800",
  },
  ON_LEAVE: { label: "On leave", className: "bg-blue-100 text-blue-800" },
  HOLIDAY: { label: "Holiday", className: "bg-zinc-200 text-zinc-700" },
  WEEKEND: { label: "Weekly off", className: "bg-zinc-100 text-zinc-600" },
};

export default function AttendanceStatusBadge({ status }: { status: string }) {
  const s = styles[status] ?? {
    label: status,
    className: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${s.className}`}>
      {s.label}
    </span>
  );
}
export const STATUS_ORDER = [
  "PRESENT",
  "SHORT_LEAVE",
  "HALF_DAY",
  "INCOMPLETE",
  "ABSENT",
  "ON_LEAVE",
  "HOLIDAY",
  "WEEKEND",
];
