"use client";

interface Slice {
  label: string;
  value: number;
  /** Override the auto-assigned color from the default ramp. */
  color?: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  /** Center primary label */
  centerLabel?: string;
  /** Center secondary label */
  centerSubLabel?: string;
  formatValue?: (n: number) => string;
}

const TONES = ["#242526", "#64717a", "#A6B0AB", "#D4D2CC", "#EDEBE6"];

export function Donut({
  slices,
  size = 180,
  centerLabel,
  centerSubLabel,
  formatValue = (n) => n.toLocaleString(),
}: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - 24) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 22;

  let acc = 0;
  const segs = slices.map((s, i) => {
    const start = acc;
    const len = total === 0 ? 0 : (s.value / total) * Math.PI * 2;
    acc += len;
    const startAngle = start - Math.PI / 2;
    const endAngle = start + len - Math.PI / 2;
    const large = len > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const path =
      total === 0
        ? ""
        : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    return {
      ...s,
      path,
      color: s.color ?? TONES[i % TONES.length],
    };
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative w-full max-w-[200px] aspect-square"
        style={{ maxWidth: size }}
      >
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="#242526"
            strokeOpacity="0.06"
            strokeWidth={stroke}
            fill="none"
          />
          {segs.map((s, i) => (
            <path
              key={i}
              d={s.path}
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
        </svg>
        {(centerLabel || centerSubLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
            {centerLabel && (
              <p className="text-xl md:text-2xl font-medium font-sans text-[#20282c] tabular-nums leading-none">
                {centerLabel}
              </p>
            )}
            {centerSubLabel && (
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-2 leading-tight">
                {centerSubLabel}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend — full width below the donut for clean mobile + narrow columns */}
      <ul className="w-full divide-y divide-[#242526]/5">
        {segs.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li
              key={i}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="text-[#20282c] text-sm flex-1 truncate">
                {s.label}
              </span>
              <span className="text-right font-sans text-[#64717a] tabular-nums text-sm shrink-0 inline-flex items-baseline gap-2">
                <span className="text-[#20282c]">{formatValue(s.value)}</span>
                <span className="text-[10px] tracking-[0.1em] text-[#64717a]/70">
                  {pct.toFixed(0)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
