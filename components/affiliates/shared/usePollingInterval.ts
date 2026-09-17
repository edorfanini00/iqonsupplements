"use client";

import { useEffect, useRef } from "react";

/**
 * Run `callback` on an interval, but ONLY while the tab is visible.
 *
 * Why this exists: the affiliate/admin dashboards poll the database for badge
 * counts and message threads. With a plain setInterval, a tab left open in the
 * background keeps querying Postgres 24/7, which is what exhausted our query
 * quota. This hook stops the interval entirely when the tab is hidden and fires
 * once immediately when it becomes visible again, so idle/background tabs cost
 * zero queries while foreground tabs stay fresh.
 *
 * The latest `callback` is always used (no stale closures) without resetting the
 * timer, so callers can pass an inline function.
 */
export function usePollingInterval(
  callback: () => void,
  intervalMs: number,
  enabled = true
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const run = () => savedCallback.current();

    const start = () => {
      if (timer === null) {
        timer = setInterval(() => {
          if (document.visibilityState === "visible") run();
        }, intervalMs);
      }
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        run();
        start();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    if (document.visibilityState === "visible") {
      run();
      start();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, [intervalMs, enabled]);
}
