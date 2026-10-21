export type BarSeries = { name: string; color: string; values: number[] };

type Props = {
  labels: string[];
  series: BarSeries[];
  /** Bars drawn as a faint stub (for example weekly off days). */
  muted?: boolean[];
  mutedTitle?: string[];
  height?: number;
  /** Show every n-th label on the x axis. */
  labelEvery?: number;
  /** Dashed vertical line drawn after bar index `after`. */
  marker?: { after: number; label: string };
  ariaLabel: string;
};

function niceScale(maxValue: number, ticks = 4) {
  if (maxValue <= 0) return { max: ticks, step: 1 };
  const raw = maxValue / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  const step = nice * pow;
  return { max: Math.ceil(maxValue / step) * step, step };
}

/** Stacked bar chart as plain SVG. Works on the server, in print and in PDF export. */
export default function BarChart({
  labels,
  series,
  muted,
  mutedTitle,
  height = 250,
  labelEvery = 1,
  marker,
  ariaLabel,
}: Props) {
  const W = 640;
  const m = { l: 36, r: 8, t: 24, b: 28 };
  const plotW = W - m.l - m.r;
  const plotH = height - m.t - m.b;
  const n = labels.length;
  const band = plotW / Math.max(1, n);
  const barW = Math.max(2, band * 0.64);

  const totals = labels.map((_, i) =>
    series.reduce((s, x) => s + (muted?.[i] ? 0 : (x.values[i] ?? 0)), 0),
  );
  const { max, step } = niceScale(Math.max(0, ...totals));
  const y = (v: number) => m.t + plotH - (v / max) * plotH;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={m.l}
            x2={W - m.r}
            y1={y(t)}
            y2={y(t)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text
            x={m.l - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={13}
            fill="#64748b"
          >
            {t}
          </text>
        </g>
      ))}

      {labels.map((label, i) => {
        const x = m.l + i * band + (band - barW) / 2;
        if (muted?.[i]) {
          return (
            <rect
              key={i}
              x={x}
              y={y(0) - 2}
              width={barW}
              height={2}
              fill="#cbd5e1"
            >
              <title>{`${label}: ${mutedTitle?.[i] ?? "No attendance expected"}`}</title>
            </rect>
          );
        }
        let acc = 0;
        return (
          <g key={i}>
            {series.map((s) => {
              const v = s.values[i] ?? 0;
              if (v <= 0) return null;
              const top = y(acc + v);
              const h = y(acc) - top;
              acc += v;
              return (
                <rect
                  key={s.name}
                  x={x}
                  y={top}
                  width={barW}
                  height={h}
                  fill={s.color}
                  rx={1}
                >
                  <title>{`${label}: ${s.name} ${v}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}

      {labels.map((label, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            x={m.l + i * band + band / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize={13}
            fill="#64748b"
          >
            {label}
          </text>
        ) : null,
      )}

      {marker && (
        <g>
          <line
            x1={m.l + (marker.after + 1) * band}
            x2={m.l + (marker.after + 1) * band}
            y1={m.t - 6}
            y2={m.t + plotH}
            stroke="#475569"
            strokeWidth={1.25}
            strokeDasharray="4 3"
          />
          <text
            x={m.l + (marker.after + 1) * band + 5}
            y={m.t + 2}
            fontSize={13}
            fontWeight={600}
            fill="#334155"
          >
            {marker.label}
          </text>
        </g>
      )}
    </svg>
  );
}
