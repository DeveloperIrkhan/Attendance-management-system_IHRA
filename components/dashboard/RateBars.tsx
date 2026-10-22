export default function RateBars({
  rows,
}: {
  rows: {
    name: string;
    rate: number | null;
    attended: number;
    expected: number;
  }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        No attendance data for this month.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const rate = r.rate ?? 0;
        const color =
          rate >= 90
            ? "bg-green-500"
            : rate >= 75
              ? "bg-amber-500"
              : "bg-red-500";
        return (
          <li key={r.name}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{r.name}</span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {r.rate === null ? "-" : `${r.rate.toFixed(1)}%`}
                <span className="ml-2 text-xs text-slate-400">
                  {r.attended} of {r.expected} days
                </span>
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${r.name}: ${rate.toFixed(1)} percent`}
            >
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${Math.min(100, rate)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
