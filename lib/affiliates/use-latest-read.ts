"use client";
import { useCallback, useEffect, useRef } from "react";

/** One request generation per view; stale responses/errors cannot commit. */
export function useLatestRead() {
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  return useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    return { signal: controller.signal, isCurrent: () => active.current === controller && !controller.signal.aborted };
  }, []);
}
