"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { isMonthToken, recentMonthTokens } from "@/lib/affiliates/time-series";

const PRESETS = [
  { id: "1d", label: "1d" },
  { id: "3d", label: "3d" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "ytd", label: "YTD" },
  { id: "12m", label: "12m" },
  { id: "all", label: "All" },
] as const;

/**
 * A range selection: a relative preset (`"30d"`, `"ytd"`, …) or a calendar
 * month token (`"m:2026-03"`).
 */
export type Preset = string;

interface Props {
  value: Preset;
  onChange: (next: Preset) => void;
  /** Show the calendar-month dropdown (e.g. "March 2026"). Defaults to true. */
  showMonths?: boolean;
  /** How many recent months to offer in the dropdown. Defaults to 12. */
  monthsBack?: number;
}

export function RangePicker({
  value,
  onChange,
  showMonths = true,
  monthsBack = 12,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const months = useMemo(
    () => recentMonthTokens(monthsBack),
    [monthsBack]
  );

  const monthSelected = isMonthToken(value);
  const selectedMonthLabel = monthSelected
    ? months.find((m) => m.token === value)?.label ??
      // Fall back to deriving a label if the selected month isn't in the list.
      value.replace(/^m:/, "")
    : null;

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1">
        {PRESETS.map((p) => {
          const active = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
                active
                  ? "bg-[#242526] text-white"
                  : "text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {showMonths && (
        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
              monthSelected
                ? "bg-[#242526] text-white"
                : "glass-surface text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            {monthSelected ? selectedMonthLabel : "Month"}
            <ChevronDown className="h-3 w-3" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-48 max-h-72 overflow-y-auto rounded-lg border border-[#242526]/10 bg-white shadow-xl p-1">
              {months.map((m) => {
                const active = m.token === value;
                return (
                  <button
                    key={m.token}
                    type="button"
                    onClick={() => {
                      onChange(m.token);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? "bg-[#242526] text-white"
                        : "text-[#20282c] hover:bg-[#242526]/[0.05]"
                    }`}
                  >
                    {m.label}
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
