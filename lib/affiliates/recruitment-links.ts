"use client";
import { useEffect, useState } from "react";
export function affiliatePath(path: string, ref: string): string {
  return ref ? `${path}?ref=${encodeURIComponent(ref)}` : path;
}
/** Session-only attribution survives a detour through login; never reassigns existing accounts. */
export function useRecruitmentRef() {
  const [ref, setRef] = useState("");
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("ref");
    try {
      if (incoming !== null) sessionStorage.setItem("iqon-recruitment-ref", incoming);
      setRef(incoming ?? sessionStorage.getItem("iqon-recruitment-ref") ?? "");
    } catch { setRef(incoming ?? ""); }
  }, []);
  return ref;
}
