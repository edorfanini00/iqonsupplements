"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {installAttributionGuards,syncAttribution} from "@/lib/google-attribution";
import {nativeConsentInvalidated,refreshNativeConsent} from "@/lib/shopify-consent";
export function GoogleAttribution(){
  const pathname=usePathname();
  useEffect(()=>installAttributionGuards(),[]);
  useEffect(()=>{if(nativeConsentInvalidated())refreshNativeConsent();syncAttribution();},[pathname]);
  return null;
}
