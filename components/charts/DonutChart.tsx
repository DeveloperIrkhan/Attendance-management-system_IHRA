export type DonutSegment = { label: string; value: number; color: string };

type Props = {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string | number;
  ariaLabel: string;
};

/** Donut chart as plain SVG. Segments with a value of 0 are skipped. */
export default function DonutChart({
  segments,
  centerLabel,
  centerValue,
  ariaLabel,
}: Props) {
  const size = 200;
  const c = size / 2;
  const r = 74;
  const stroke = 24;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);

  let offset = 0;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      className="mx-auto h-auto w-full max-w-50"
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={stroke}
      />
      {total > 0 &&
        segments.map((s) => {
          if (s.value <= 0) return null;
          const len = (s.value / total) * circumference;
          const gap = segments.filter((x) => x.value > 0).length > 1 ? 1.5 : 0;
          const el = (
            <circle
              key={s.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${circumference - Math.max(0, len - gap)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      <text x={c} y={c - 6} textAnchor="middle" fontSize={14} fill="#64748b">
        {centerLabel}
      </text>
      <text
        x={c}
        y={c + 22}
        textAnchor="middle"
        fontSize={32}
        fontWeight={700}
        fill="#0f172a"
      >
        {centerValue}
      </text>
    </svg>
  );
}
