import type { CartItem } from "./catalog";
import { isStorefrontPath } from "./meta-pixel";

// Default-off Google tag foundation. Nothing loads or is queued unless a valid
// configuration is built in, the hostname is allowlisted, GPC is absent and a
// qualified consent source has granted a purpose through setGoogleConsent().
// Purchase belongs to Shopify checkout (official Google & YouTube app), never here.
export type GoogleConfig = { adsId?: string; ga4Id?: string; adsAddToCartLabel?: string; hostnames: string[] };
export type GoogleConsent = { analytics: boolean; advertising: boolean };
export const GOOGLE_EVENTS = ["page_view", "add_to_cart"] as const;
type GoogleEvent = typeof GOOGLE_EVENTS[number];
type GoogleEnv = Partial<Record<
  "NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED" | "NEXT_PUBLIC_GOOGLE_ADS_ID" | "NEXT_PUBLIC_GOOGLE_GA4_ID" |
  "NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL" | "NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES", string>>;
declare global {
  interface Window { dataLayer?: ArrayLike<unknown>[]; gtag?: (...args: unknown[]) => void }
}

// Any supplied-but-invalid value disables the whole tag rather than a partial setup.
export function readGoogleConfig(env: GoogleEnv): GoogleConfig | null {
  if (env.NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED !== "true") return null;
  const optional = (value: string | undefined, pattern: RegExp) => {
    const trimmed = value?.trim();
    return !trimmed ? undefined : pattern.test(trimmed) ? trimmed : null;
  };
  const adsId = optional(env.NEXT_PUBLIC_GOOGLE_ADS_ID, /^AW-\d{6,15}$/);
  const ga4Id = optional(env.NEXT_PUBLIC_GOOGLE_GA4_ID, /^G-[A-Z0-9]{6,15}$/);
  const adsAddToCartLabel = optional(env.NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL, /^[A-Za-z0-9_-]{6,40}$/);
  const hostnames = (env.NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES || "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  if (adsId === null || ga4Id === null || adsAddToCartLabel === null || (!adsId && !ga4Id) || (adsAddToCartLabel && !adsId)) return null;
  if (!hostnames.length || !hostnames.every(host => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host))) return null;
  return {...(adsId ? {adsId} : {}), ...(ga4Id ? {ga4Id} : {}), ...(adsAddToCartLabel ? {adsAddToCartLabel} : {}), hostnames};
}

// Literal references so Next inlines these public values at build time.
let config = readGoogleConfig({
  NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED,
  NEXT_PUBLIC_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  NEXT_PUBLIC_GOOGLE_GA4_ID: process.env.NEXT_PUBLIC_GOOGLE_GA4_ID,
  NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: process.env.NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL,
  NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: process.env.NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES,
});
let consent: GoogleConsent | null = null;
let bootstrapped = false;
let scriptLoaded = false;
let applied = "";
const configured = new Set<string>();
let currentRoute: string | undefined;
let lastPage: string | undefined;

// Replaces the configuration and forgets this document's tag state (tests).
export function configureGoogleTag(next: GoogleConfig | null) {
  config = next; consent = null; bootstrapped = false; scriptLoaded = false; applied = "";
  configured.clear(); currentRoute = undefined; lastPage = undefined;
  if (typeof window !== "undefined") { delete window.dataLayer; delete window.gtag; }
}

// The seam for a qualified consent source (Shopify Customer Privacy API or an
// approved CMP): call with the visitor's current choice on load and every change.
// null means unknown/loading/error and is treated as denied. No source is wired yet.
export function setGoogleConsent(next: GoogleConsent | null) {
  consent = next ? {analytics: next.analytics === true, advertising: next.advertising === true} : null;
  if (currentRoute !== undefined) trackGooglePageView(currentRoute);
  else sync();
}

function eligible() {
  return !!config && typeof window !== "undefined" &&
    (window.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true &&
    config.hostnames.includes(window.location.hostname.toLowerCase()) &&
    isStorefrontPath(window.location.pathname);
}
function permitted() {
  const allowed = eligible() && consent ? consent : {analytics: false, advertising: false};
  return {ga4: allowed.analytics && config?.ga4Id ? config.ga4Id : undefined,
    ads: allowed.advertising && config?.adsId ? config.adsId : undefined};
}

function gtag(...args: unknown[]) {
  try { window.gtag?.(...args); } catch {}
}
// Basic consent mode: Google is untouched until a destination is permitted. Denied
// defaults are queued before js/config; ad personalization is never granted here.
function sync() {
  const {ga4, ads} = permitted();
  try {
    if (!bootstrapped) {
      if (!ga4 && !ads) return {ga4, ads};
      window.dataLayer = window.dataLayer || [];
      // gtag.js reads the standard Arguments objects from dataLayer.
      // eslint-disable-next-line prefer-rest-params
      window.gtag = function () { (window.dataLayer = window.dataLayer || []).push(arguments); };
      gtag("consent", "default", {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"});
      gtag("set", "ads_data_redaction", true);
      gtag("set", "url_passthrough", false);
      bootstrapped = true;
    }
    const state = {ad_storage: ads ? "granted" : "denied", analytics_storage: ga4 ? "granted" : "denied",
      ad_user_data: ads ? "granted" : "denied", ad_personalization: "denied"};
    if (JSON.stringify(state) !== applied) { gtag("consent", "update", state); applied = JSON.stringify(state); }
    if (!ga4 && !ads) return {ga4, ads};
    if (!configured.size) gtag("js", new Date());
    for (const id of [ga4, ads]) {
      if (!id || configured.has(id)) continue;
      // Manual SPA page views; no Google signals, remarketing or enhanced conversions.
      gtag("config", id, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
      configured.add(id);
    }
    if (!scriptLoaded) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent((ga4 || ads)!)}`;
      scriptLoaded = true;
      document.head.appendChild(script);
    }
  } catch {}
  return {ga4, ads};
}

function send(name: GoogleEvent, params: Record<string, unknown>) { gtag("event", name, params); }

const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"];
const CLICK_PARAMS = ["gclid", "gbraid", "wbraid"];
function pageLocation(route: string, advertising: boolean) {
  const url = new URL(route, window.location.origin);
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (CAMPAIGN_PARAMS.includes(key) || (advertising && CLICK_PARAMS.includes(key))) kept.append(key, value);
  }
  const query = kept.toString();
  return `${window.location.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

// One owner for initial and App Router page views. Withdrawal or an excluded
// route resets the dedupe key; nothing seen while denied is replayed later.
export function trackGooglePageView(route: string) {
  currentRoute = route;
  const {ga4, ads} = sync();
  if (!ga4) { lastPage = undefined; return; }
  if (lastPage === route) return;
  try { send("page_view", {send_to: [ga4], page_location: pageLocation(route, !!ads)}); } catch {}
  lastPage = route;
}

// Called only after this add request succeeds; same bounding as the Meta pixel.
// Ads receives it only through an explicit conversion label, never as a bare event.
export function trackGoogleCartAddition(items: CartItem[], variantId: string, requestedQuantity: number, sellingPlanId?: string) {
  try {
    const {ga4, ads} = sync();
    const sendTo = [ga4, ads && config?.adsAddToCartLabel ? `${ads}/${config.adsAddToCartLabel}` : undefined].filter(Boolean);
    if (!sendTo.length || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) return;
    const line = items.find(item => item.variantId === variantId && item.sellingPlanId === sellingPlanId);
    const id = /^(?:gid:\/\/shopify\/ProductVariant\/)?(\d+)$/.exec(variantId)?.[1];
    if (!id || !line || line.quantity <= 0 || line.amount === undefined || (line.currency || "USD") !== "USD") return;
    const quantity = Math.min(requestedQuantity, line.quantity);
    const price = Math.round(line.amount / line.quantity * 100) / 100;
    if (!Number.isFinite(price) || price < 0) return;
    send("add_to_cart", {send_to: sendTo, currency: "USD", value: Math.round(price * quantity * 100) / 100,
      items: [{item_id: id, price, quantity}]});
  } catch {}
}
