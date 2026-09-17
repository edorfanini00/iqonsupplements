"use client";

import { useMemo, useState, useId, useRef, useEffect } from "react";
import { axisTickLabel, parseBucketDate } from "@/lib/affiliates/time-series";
import type { Granularity } from "@/lib/affiliates/types";

interface Point {
  /** `YYYY-MM-DD` or `YYYY-MM` bucket key */
  date?: string;
  label: string;
  primary: number;
  secondary?: number;
  /** Optional third series (solid muted line, e.g. store-wide total). */
  tertiary?: number;
}

interface Props {
  data: Point[];
  granularity?: Granularity;
  primaryLabel?: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  height?: number;
  formatValue?: (n: number) => string;
}

const TERTIARY_COLOR = "#8C9B57";

const PADDING = { top: 16, right: 56, bottom: 44, left: 48 };

export function AreaChart({
  data,
  granularity = "day",
  primaryLabel = "Revenue",
  secondaryLabel,
  tertiaryLabel,
  height = 280,
  formatValue = (n) => n.toLocaleString(),
}: Props) {
  const id = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setHoverIndex(null);
  }, [data, granularity]);

  const resolved = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        displayLabel: d.date
          ? formatChartDate(d.date, granularity)
          : d.label,
      })),
    [data, granularity]
  );

  const w = width || 1;
  const h = height;

  const dims = useMemo(() => {
    const innerW = w - PADDING.left - PADDING.right;
    const innerH = h - PADDING.top - PADDING.bottom;
    const rawMax = Math.max(
      0,
      ...data.flatMap((d) => [d.primary, d.secondary ?? 0, d.tertiary ?? 0])
    );
    const hasData = rawMax > 0;
    const niceMax = hasData ? niceCeil(rawMax) : 1;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const xs = data.map((_, i) => PADDING.left + stepX * i);
    const yPrimary = data.map(
      (d) => PADDING.top + innerH - (d.primary / niceMax) * innerH
    );
    const ySecondary = data.map(
      (d) => PADDING.top + innerH - ((d.secondary ?? 0) / niceMax) * innerH
    );
    const yTertiary = data.map(
      (d) => PADDING.top + innerH - ((d.tertiary ?? 0) / niceMax) * innerH
    );
    return {
      innerW,
      innerH,
      max: niceMax,
      hasData,
      xs,
      yPrimary,
      ySecondary,
      yTertiary,
    };
  }, [data, w, h]);

  const { innerW, innerH, max, hasData, xs, yPrimary, ySecondary, yTertiary } = dims;

  const linePath = smoothPath(xs, yPrimary);
  const areaPath = `${linePath} L ${xs[xs.length - 1]} ${PADDING.top + innerH} L ${xs[0]} ${PADDING.top + innerH} Z`;
  const secondaryPath =
    data.some((d) => d.secondary != null) && smoothPath(xs, ySecondary);
  const tertiaryPath =
    data.some((d) => d.tertiary != null) && smoothPath(xs, yTertiary);

  const hover = hoverIndex != null ? resolved[hoverIndex] : null;
  const hoverX = hoverIndex != null ? xs[hoverIndex] : null;

  const yTicks = hasData ? 4 : 1;
  const tickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => (max / yTicks) * i
  );

  const xTickIndices = useMemo(
    () => pickTickIndices(resolved.length, granularity),
    [resolved.length, granularity]
  );

  const showSecondary = data.some((d) => d.secondary != null);
  const showTertiary = data.some((d) => d.tertiary != null);
  const ready = width > 0;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      {ready && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="block max-w-full overflow-visible"
          role="img"
          aria-label={`${primaryLabel} over time`}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={`area-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#20282c" stopOpacity="0.14" />
              <stop offset="85%" stopColor="#20282c" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#20282c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`line-stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#20282c" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#20282c" />
            </linearGradient>
          </defs>

          <line
            x1={PADDING.left}
            x2={PADDING.left + innerW}
            y1={PADDING.top + innerH}
            y2={PADDING.top + innerH}
            stroke="#242526"
            strokeOpacity={0.12}
          />

          {tickValues.map((t, i) => {
            const y = PADDING.top + innerH - (t / max) * innerH;
            return (
              <g key={i}>
                {i > 0 && (
                  <line
                    x1={PADDING.left}
                    x2={PADDING.left + innerW}
                    y1={y}
                    y2={y}
                    stroke="#242526"
                    strokeOpacity={0.05}
                  />
                )}
                <text
                  x={PADDING.left - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64717a"
                  fontFamily="var(--font-sans), ui-monospace, monospace"
                >
                  {formatValue(t)}
                </text>
              </g>
            );
          })}

          {showSecondary && secondaryPath && (
            <path
              d={secondaryPath}
              fill="none"
              stroke="#64717a"
              strokeWidth="1.5"
              strokeOpacity="0.45"
              strokeDasharray="4 5"
              strokeLinecap="round"
            />
          )}

          {showTertiary && tertiaryPath && (
            <path
              d={tertiaryPath}
              fill="none"
              stroke={TERTIARY_COLOR}
              strokeWidth="1.75"
              strokeOpacity="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          <path d={areaPath} fill={`url(#area-fill-${id})`} />
          <path
            d={linePath}
            fill="none"
            stroke={`url(#line-stroke-${id})`}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hoverIndex != null && hoverX != null && (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={PADDING.top}
                y2={PADDING.top + innerH}
                stroke="#20282c"
                strokeOpacity="0.12"
              />
              <circle
                cx={hoverX}
                cy={yPrimary[hoverIndex]}
                r="5"
                fill="#20282c"
                stroke="#f2f4f5"
                strokeWidth="2"
              />
              {data[hoverIndex].secondary != null && (
                <circle
                  cx={hoverX}
                  cy={ySecondary[hoverIndex]}
                  r="4"
                  fill="#f2f4f5"
                  stroke="#64717a"
                  strokeWidth="1.75"
                />
              )}
              {data[hoverIndex].tertiary != null && (
                <circle
                  cx={hoverX}
                  cy={yTertiary[hoverIndex]}
                  r="4"
                  fill="#f2f4f5"
                  stroke={TERTIARY_COLOR}
                  strokeWidth="1.75"
                />
              )}
            </>
          )}

          {xTickIndices.map((dataIndex, tickPos) => {
            const point = resolved[dataIndex];
            if (!point) return null;
            const tickLabel = point.date
              ? axisTickLabel(point.date, granularity)
              : point.label;
            return (
              <text
                key={`${point.date ?? point.label}-${dataIndex}`}
                x={xs[dataIndex]}
                y={h - 14}
                textAnchor={tickAnchor(tickPos, xTickIndices.length)}
                fontSize="10"
                fill="#64717a"
                fontFamily="var(--font-sans), ui-monospace, monospace"
              >
                {tickLabel}
              </text>
            );
          })}

          {data.map((_, i) => {
            const left = i === 0 ? PADDING.left : (xs[i - 1] + xs[i]) / 2;
            const right =
              i === data.length - 1
                ? PADDING.left + innerW
                : (xs[i] + xs[i + 1]) / 2;
            return (
              <rect
                key={i}
                x={left}
                y={PADDING.top}
                width={Math.max(1, right - left)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}
        </svg>
      )}

      {!ready && <div style={{ height }} aria-hidden />}

      {ready && !hasData && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-[#64717a] pointer-events-none">
          No earnings in this period
        </p>
      )}

      {ready && hover && hoverX != null && hoverIndex != null && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: hoverX,
            top: yPrimary[hoverIndex],
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <div className="rounded-xl border border-[#242526]/10 bg-[#F7F6F2]/95 backdrop-blur-md shadow-sm px-3.5 py-2.5 text-xs">
            <p className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
              {hover.displayLabel}
            </p>
            <p className="font-sans font-medium mt-1 text-[#20282c] tabular-nums">
              {primaryLabel}{" "}
              <span className="text-[#64717a] font-normal">·</span>{" "}
              {formatValue(data[hoverIndex].primary)}
            </p>
            {data[hoverIndex].tertiary != null && (
              <p
                className="font-sans mt-0.5 tabular-nums"
                style={{ color: TERTIARY_COLOR }}
              >
                {tertiaryLabel ?? "Total"}{" "}
                <span className="opacity-60">·</span>{" "}
                {formatValue(data[hoverIndex].tertiary!)}
              </p>
            )}
            {data[hoverIndex].secondary != null && (
              <p className="font-sans text-[#64717a] mt-0.5 tabular-nums">
                {secondaryLabel ?? "Secondary"}{" "}
                <span className="opacity-60">·</span>{" "}
                {formatValue(data[hoverIndex].secondary!)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-5 mt-4 px-0.5">
        <LegendSwatch color="#20282c" dashed={false} label={primaryLabel} />
        {showTertiary && tertiaryLabel && (
          <LegendSwatch color={TERTIARY_COLOR} dashed={false} label={tertiaryLabel} />
        )}
        {showSecondary && secondaryLabel && (
          <LegendSwatch color="#64717a" dashed label={secondaryLabel} />
        )}
      </div>
    </div>
  );
}

function tickAnchor(
  tickPos: number,
  tickCount: number
): "start" | "middle" | "end" {
  if (tickPos === 0) return "start";
  if (tickPos === tickCount - 1) return "end";
  return "middle";
}

function LegendSwatch({
  color,
  dashed,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
      <span
        className="w-4 h-[2px] rounded-full"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

function formatChartDate(key: string, granularity: Granularity): string {
  const d = parseBucketDate(key);
  if (granularity === "month" || /^\d{4}-\d{2}$/.test(key)) {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  if (granularity === "week") {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pickTickIndices(length: number, granularity: Granularity): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  const maxTicks =
    granularity === "day"
      ? length <= 7
        ? length
        : 6
      : granularity === "week"
        ? Math.min(6, length)
        : Math.min(6, length);
  if (maxTicks >= length) {
    return Array.from({ length }, (_, i) => i);
  }
  const indices = new Set<number>([0, length - 1]);
  const step = (length - 1) / (maxTicks - 1);
  for (let i = 1; i < maxTicks - 1; i++) {
    const idx = Math.round(step * i);
    indices.add(Math.min(length - 1, Math.max(0, idx)));
  }
  return [...indices].sort((a, b) => a - b);
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const m = n / base;
  let nm: number;
  if (m <= 1) nm = 1;
  else if (m <= 2) nm = 2;
  else if (m <= 5) nm = 5;
  else nm = 10;
  return nm * base;
}

function smoothPath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;
  if (xs.length === 2) {
    return `M ${xs[0]} ${ys[0]} L ${xs[1]} ${ys[1]}`;
  }

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i];
    const y0 = ys[i - 1] ?? ys[i];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const x3 = xs[i + 2] ?? x2;
    const y3 = ys[i + 2] ?? y2;

    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }
  return d;
}
