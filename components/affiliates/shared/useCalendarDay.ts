"use client";

import { useEffect, useState } from "react";

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local calendar day (YYYY-MM-DD), updates at midnight and when the tab regains focus. */
export function useCalendarDay(): string {
  const [dayKey, setDayKey] = useState(() => localDayKey());

  useEffect(() => {
    const sync = () => {
      const next = localDayKey();
      setDayKey((prev) => (prev === next ? prev : next));
    };

    let midnightTimer: number;

    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1
      );
      midnightTimer = window.setTimeout(() => {
        sync();
        scheduleMidnight();
      }, nextMidnight.getTime() - now.getTime());
    };

    scheduleMidnight();

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);

    const interval = window.setInterval(sync, 60_000);

    return () => {
      window.clearTimeout(midnightTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return dayKey;
}
