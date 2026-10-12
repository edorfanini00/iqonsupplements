"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AD_CHOICE_COOKIE, adChoiceFromCookies, choiceKey, formatAdChoice, type AdChoice, type AdDecision } from "@/lib/ad-privacy";

// Browser side of the storefront advertising choice (docs/ad-tracking.md). The cookie written here
// is the only record; it is read fresh at every decision point, so every tab sees the latest click.

const MAX_AGE = 60 * 60 * 24 * 400;
const CHANNEL = "iqon-ad-choice";

export function readAdChoice(): AdChoice | null {
  try { return adChoiceFromCookies(document.cookie); } catch { return null; }
}
export const browserGpc = () => typeof navigator !== "undefined" && (navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl === true;

function newChoiceId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function writeCookie(value: string) {
  document.cookie = `${AD_CHOICE_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export type SaveResult = "saved" | "changed" | "blocked" | "blocked-page";
// Opt-outs whose cookie could not be stored: kept for this tab (sessionStorage) or, if that is
// refused too, for this page, and sent with checkout. They can only restrict.
const TAB_OPT_OUT = "iqon_ad_opt_out";
let pageOptOut = false;
export function hasMemoryOptOut() {
  if (pageOptOut) return true;
  try { return sessionStorage.getItem(TAB_OPT_OUT) === "1"; } catch { return false; }
}
function rememberOptOut(): boolean {
  pageOptOut = true;
  try { sessionStorage.setItem(TAB_OPT_OUT, "1"); return sessionStorage.getItem(TAB_OPT_OUT) === "1"; } catch { return false; }
}
function forgetOptOut() {
  pageOptOut = false;
  try { sessionStorage.removeItem(TAB_OPT_OUT); } catch {}
}

/**
 * Applies a click. `basedOn` is the choice the panel showed; if another tab changed it since, the
 * click is not applied (a stale panel can never re-grant an opt-out it did not show).
 */
export function saveAdChoice(decision: AdDecision, basedOn: string): SaveResult {
  if (choiceKey(readAdChoice()) !== basedOn) return "changed";
  const choice: AdChoice = {decision, id: newChoiceId()};
  try { writeCookie(formatAdChoice(choice)); } catch {}
  const stored = choiceKey(readAdChoice()) === choice.id;
  let tab = true;
  if (decision === "denied") {
    if (!stored) tab = rememberOptOut();
    // Also restrict the current bag, so a checkout that is already open is covered. Restrict-only.
    void fetch("/api/ad-choice", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}", keepalive: true}).catch(() => {});
  } else if (stored) forgetOptOut();
  try { new BroadcastChannel(CHANNEL).postMessage("changed"); } catch {}
  return stored ? "saved" : tab ? "blocked" : "blocked-page";
}

type AdPrivacy = {controls: boolean; choice: AdChoice | null; gpc: boolean; refresh: () => void};
const AdPrivacyContext = createContext<AdPrivacy>({controls: false, choice: null, gpc: false, refresh: () => {}});
export const useAdPrivacy = () => useContext(AdPrivacyContext);

export function AdPrivacyProvider({controls, children}: {controls: boolean; children: ReactNode}) {
  const [state, setState] = useState<{choice: AdChoice | null; gpc: boolean}>({choice: null, gpc: false});
  const refresh = useCallback(() => setState({choice: readAdChoice(), gpc: browserGpc()}), []);
  useEffect(() => {
    if (!controls) return;
    // Keep an opt-out alive while the visitor keeps visiting (Safari caps script cookies at
    // 7 days). Only opt-outs are refreshed: rewriting can never revive a grant.
    const current = readAdChoice();
    if (current?.decision === "denied") try { writeCookie(formatAdChoice(current)); } catch {}
    const initial = setTimeout(refresh, 0);
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = refresh; } catch {}
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(initial); channel?.close(); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", onVisible); };
  }, [controls, refresh]);
  return <AdPrivacyContext.Provider value={{controls, ...state, refresh}}>{children}</AdPrivacyContext.Provider>;
}
