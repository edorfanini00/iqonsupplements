"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackGooglePageView } from "@/lib/google-tag";

// Single App Router page_view owner. The library loads gtag.js itself, and only
// once configuration, hostname, route, GPC and a qualified consent source allow it.
export function StorefrontGoogleTag() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    trackGooglePageView(`${pathname}${search ? `?${search}` : ""}`);
  }, [pathname, search]);
  return null;
}
