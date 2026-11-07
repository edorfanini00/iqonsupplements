"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {installAttributionGuards,syncAttribution} from "@/lib/google-attribution";
export function GoogleAttribution(){
  const pathname=usePathname();
  useEffect(()=>installAttributionGuards(),[]);
  useEffect(()=>syncAttribution(),[pathname]);
  return null;
}
