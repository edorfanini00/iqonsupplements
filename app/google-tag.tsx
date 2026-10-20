"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { guardGoogleNavigation, trackGooglePageView, watchGoogleLocation } from "@/lib/google-tag";

// Single App Router page_view owner. The library loads gtag.js itself, and only
// once configuration, hostname, page eligibility, GPC and a qualified consent
// source allow it. The capture listener runs before Next's link handling;
// the location watch rechecks fragment-only and history changes the route misses.
export function StorefrontGoogleTag() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    // Tracking must never break the storefront, even if the library regresses.
    const guard = (event: MouseEvent) => { try { guardGoogleNavigation(event); } catch {} };
    document.addEventListener("click", guard, true);
    let unwatch = () => {};
    try { unwatch = watchGoogleLocation(); } catch {}
    return () => {
      document.removeEventListener("click", guard, true);
      try { unwatch(); } catch {}
    };
  }, []);
  useEffect(() => {
    try { trackGooglePageView(`${pathname}${search ? `?${search}` : ""}`); } catch {}
  }, [pathname, search]);
  return null;
}
