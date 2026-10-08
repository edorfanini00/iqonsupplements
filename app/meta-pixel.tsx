"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { META_PIXEL_ID, META_SCRIPT_SRC, ensureFbq, isTrackedPath, trackPageView } from "@/lib/analytics/meta";

/** Meta Pixel base code and a PageView (with event_id) on every storefront route change. */
export function MetaPixel() {
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);
  useEffect(() => {
    if (tracked) trackPageView(pathname);
  }, [pathname, tracked]);
  if (!META_PIXEL_ID || !tracked) return null;
  return <Script id="meta-pixel" src={META_SCRIPT_SRC} strategy="afterInteractive" onLoad={() => void ensureFbq()} />;
}
