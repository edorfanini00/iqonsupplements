"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { randomShopManagerDelaySeconds } from "@/lib/affiliates/shop-manager-delay";

const SKIP_NEXT_DELAY_KEY = "iqon-sm-skip-next-delay";

export function markShopManagerLoginDelayDone() {
  try {
    sessionStorage.setItem(SKIP_NEXT_DELAY_KEY, "1");
  } catch {
    // ignore
  }
}

function consumeSkipNextDelay(): boolean {
  try {
    if (sessionStorage.getItem(SKIP_NEXT_DELAY_KEY) === "1") {
      sessionStorage.removeItem(SKIP_NEXT_DELAY_KEY);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

interface DelayApi {
  waitThen: (action: () => void) => void;
  waiting: boolean;
  secondsLeft: number;
  totalSeconds: number;
}

const ShopManagerDelayContext = createContext<DelayApi | null>(null);

export function useShopManagerDelay(): DelayApi {
  const ctx = useContext(ShopManagerDelayContext);
  if (!ctx) {
    throw new Error("useShopManagerDelay must be used within ShopManagerDelayGate");
  }
  return ctx;
}

export function ShopManagerWaitScreen() {
  return (
    <div
      data-no-shop-delay
      className="min-h-screen bg-[#f2f4f5] flex items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="h-8 w-8 animate-spin text-[#20282c]" aria-hidden />
    </div>
  );
}

function isInteractiveClickTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("[data-no-shop-delay]")) return null;
  // Typing / focusing fields should not trigger the gate.
  if (target.closest("input, textarea, select, [contenteditable='true']")) {
    return null;
  }
  return target.closest(
    "a[href], button, [role='button'], summary, tr[data-shop-delay-click]"
  ) as HTMLElement | null;
}

export function ShopManagerDelayGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [waiting, setWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);

  const pendingRef = useRef<(() => void) | null>(null);
  const bypassClickRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startWait = useCallback(
    (action: () => void) => {
      clearTimer();
      const total = randomShopManagerDelaySeconds();
      pendingRef.current = action;
      setTotalSeconds(total);
      setSecondsLeft(total);

      if (total <= 0) {
        setWaiting(false);
        pendingRef.current = null;
        action();
        return;
      }

      setWaiting(true);
      let remaining = total;
      intervalRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearTimer();
          const next = pendingRef.current;
          pendingRef.current = null;
          setWaiting(false);
          next?.();
        }
      }, 1000);
    },
    [clearTimer]
  );

  const waitThen = useCallback(
    (action: () => void) => {
      startWait(action);
    },
    [startWait]
  );

  // Entry into the portal (refresh / deep link). Skip once after login already waited.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (consumeSkipNextDelay()) {
      setWaiting(false);
      return;
    }

    startWait(() => {});
    return clearTimer;
  }, [startWait, clearTimer]);

  // Intercept interactive clicks so each action waits a fresh random delay.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClickCapture = (event: MouseEvent) => {
      if (bypassClickRef.current) return;
      if (waiting) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const el = isInteractiveClickTarget(event.target);
      if (!el) return;

      event.preventDefault();
      event.stopPropagation();

      startWait(() => {
        bypassClickRef.current = true;
        try {
          el.click();
        } finally {
          queueMicrotask(() => {
            bypassClickRef.current = false;
          });
        }
      });
    };

    root.addEventListener("click", onClickCapture, true);
    return () => root.removeEventListener("click", onClickCapture, true);
  }, [waiting, startWait]);

  const api: DelayApi = {
    waitThen,
    waiting,
    secondsLeft,
    totalSeconds,
  };

  return (
    <ShopManagerDelayContext.Provider value={api}>
      <div ref={rootRef} className="relative min-h-screen">
        {/* Keep portal mounted under the overlay so delayed clicks can replay. */}
        <div
          className={waiting ? "pointer-events-none select-none opacity-0" : undefined}
          aria-hidden={waiting}
        >
          {children}
        </div>
        {waiting && (
          <div className="fixed inset-0 z-[100]">
            <ShopManagerWaitScreen />
          </div>
        )}
      </div>
    </ShopManagerDelayContext.Provider>
  );
}

/** Standalone wait used on the shared login page before entering the portal. */
export function useStandaloneShopManagerWait() {
  const [waiting, setWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const waitThen = useCallback((action: () => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const total = randomShopManagerDelaySeconds();
    setTotalSeconds(total);
    setSecondsLeft(total);

    if (total <= 0) {
      setWaiting(false);
      action();
      return;
    }

    setWaiting(true);
    let remaining = total;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setWaiting(false);
        action();
      }
    }, 1000);
  }, []);

  return { waiting, secondsLeft, totalSeconds, waitThen };
}
