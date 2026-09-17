"use client";

interface Item {
  label: string;
  value: number;
  hint?: string;
}

interface Props {
  data: Item[];
  formatValue?: (n: number) => string;
  /** Highlight the top N bars in dark; rest are softer */
  highlightTop?: number;
}

export function BarChart({
  data,
  formatValue = (n) => n.toLocaleString(),
  highlightTop = 3,
}: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isTop = i < highlightTop;
        return (
          <div key={i} className="group">
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-sm font-medium text-[#20282c] truncate flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-sans ${
                    isTop
                      ? "bg-[#242526] text-white"
                      : "bg-[#242526]/8 text-[#64717a]"
                  }`}
                >
                  {i + 1}
                </span>
                {d.label}
              </p>
              <p className="font-sans text-sm text-[#20282c] tabular-nums shrink-0 ml-3">
                {formatValue(d.value)}
              </p>
            </div>
            <div className="relative h-2 rounded-full bg-[#242526]/5 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${
                  isTop ? "bg-[#242526]" : "bg-[#64717a]/60"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {d.hint && (
              <p className="text-[11px] text-[#64717a] mt-1 font-sans">{d.hint}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
