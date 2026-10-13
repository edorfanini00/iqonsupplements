"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { initializePixel, pixelAllowed, resetProductView, trackPageView } from "@/lib/meta-pixel";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function StorefrontMetaPixel() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const load = hydrated && pixelAllowed();
  useEffect(() => {
    initializePixel();
    trackPageView(`${pathname}${search ? `?${search}` : ""}`);
    if (!pathname.startsWith("/products/")) resetProductView();
  }, [pathname, search]);
  return load ? <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive"/> : null;
}
