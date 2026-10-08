"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { META_PIXEL_ID, META_SCRIPT_SRC, ensureFbq, isTrackedPath, trackPageView } from "@/lib/analytics/meta";
import { advertisingConsent, setAdvertisingConsent } from "@/lib/analytics/meta-consent";
import { META_CONSENT_COOKIE, readCookie, APPROVED_META_PATHS } from "@/lib/analytics/meta-shared";

export function MetaPixel() {
  const pathname = usePathname();
  const [permitted, setPermitted] = useState(false);
  const [open, setOpen] = useState(false);
  const [gpc, setGpc] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const privacySignal = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
      setGpc(privacySignal);
      setPermitted(advertisingConsent());
      if (privacySignal) window.fbq?.("consent", "revoke");
    };
    const initial = setTimeout(() => { refresh(); setOpen(readCookie(document.cookie, META_CONSENT_COOKIE) === null); }, 0);
    window.addEventListener("iqon-ad-consent", refresh);
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(initial); window.removeEventListener("iqon-ad-consent", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const tracked = permitted && isTrackedPath(pathname);
  useEffect(() => { if (tracked) trackPageView(pathname); }, [pathname, tracked]);
  const choose = (allow: boolean) => { setAdvertisingConsent(allow); setPermitted(advertisingConsent()); setOpen(false); };
  if (!APPROVED_META_PATHS.length || !META_PIXEL_ID || pathname.startsWith("/affiliates")) return null;
  return <>
    {META_PIXEL_ID && tracked ? <Script id="meta-pixel" src={META_SCRIPT_SRC} strategy="afterInteractive" onLoad={() => void ensureFbq()} /> : null}
    {open ? <section aria-label="Advertising preferences" style={{ position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 520, padding: 20, background: "#fff", color: "#181818", border: "1px solid #ccc", borderRadius: 12, boxShadow: "0 4px 24px #0002", zIndex: 1000 }}>
      <strong>Advertising preferences</strong>
      <p>Allow advertising cookies and sharing with Meta to measure ads? Your choice does not affect shopping. You can withdraw permission here at any time.</p>
      {gpc ? <p>Your browser privacy signal is on. Advertising sharing is off.</p> : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => choose(false)} style={{ padding: "10px 16px", border: "1px solid currentColor", borderRadius: 6 }}>Decline / withdraw</button>
        <button type="button" disabled={gpc} onClick={() => choose(true)} style={{ padding: "10px 16px", border: "1px solid currentColor", borderRadius: 6 }}>Allow advertising</button>
        <button type="button" onClick={() => setOpen(false)} style={{ padding: "10px 16px" }}>Close</button>
      </div>
    </section> : <button type="button" onClick={() => setOpen(true)} style={{ position: "fixed", bottom: 8, left: 8, background: "white", color: "#181818", border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", fontSize: 12, zIndex: 40 }}>Advertising preferences</button>}
  </>;
}
