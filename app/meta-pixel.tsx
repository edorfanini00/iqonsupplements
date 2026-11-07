"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { initializePixel, pixelAllowed, resetProductView, syncPixelConsent, trackPageView } from "@/lib/meta-pixel";

import {NATIVE_CONSENT_INVALIDATED,nativeConsentInvalidated,refreshNativeConsent} from "@/lib/shopify-consent";

const subscribe = (notify:()=>void) => {
  let unloading=false;
  const update=()=>{
    const unload=syncPixelConsent();notify();
    if(unload&&!unloading&&!nativeConsentInvalidated()){unloading=true;refreshNativeConsent();}
  };
  for(const name of ["consentTrackingApiLoaded","visitorConsentCollected",NATIVE_CONSENT_INVALIDATED])document.addEventListener(name,update);
  for(const name of ["focus","pageshow"])window.addEventListener(name,update);
  return ()=>{
    for(const name of ["consentTrackingApiLoaded","visitorConsentCollected",NATIVE_CONSENT_INVALIDATED])document.removeEventListener(name,update);
    for(const name of ["focus","pageshow"])window.removeEventListener(name,update);
  };
};
const clientSnapshot = () => pixelAllowed();
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
  }, [pathname, search, load]);
  return load ? <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive"/> : null;
}
