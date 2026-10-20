import type { CartSnapshot } from "./shopify";

// Default-off Google tag foundation. Nothing loads or is queued unless a valid
// configuration is built in, the hostname is allowlisted, GPC is absent, the page
// is one of the advertised products with a clean URL, and a qualified consent
// source has granted a purpose through setGoogleConsent().
// Purchase belongs to Shopify checkout (official Google & YouTube app), never here.
export type GoogleConfig = { adsId?: string; ga4Id?: string; adsAddToCartLabel?: string; hostnames: string[] };
// Separate purposes so the future adapter maps each one explicitly (no single "marketing" switch).
export type GoogleConsent = { analytics: boolean; adStorage: boolean; adUserData: boolean };
export const GOOGLE_EVENTS = ["page_view", "add_to_cart"] as const;
// Fail-closed eligibility until the owner reviews other products: only these
// advertised IQON Daily products (unflavored collagen, not chocolate) are tagged.
export const GOOGLE_PRODUCTS = ["creatine-monohydrate", "hydrolyzed-collagen-peptides", "colostrum-powder"] as const;
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
let scriptAdded = false;
let leaving = false;
let applied = "";
const configured = new Set<string>();
let currentRoute: string | undefined;
let lastPage: string | undefined;
const NONE = {ga4: undefined, ads: undefined};

// Replaces the configuration and forgets this document's tag state (tests).
export function configureGoogleTag(next: GoogleConfig | null) {
  config = next; consent = null; bootstrapped = false; scriptAdded = false; leaving = false; applied = "";
  configured.clear(); currentRoute = undefined; lastPage = undefined;
  if (typeof window !== "undefined") { delete window.dataLayer; delete window.gtag; }
}

// The seam for a qualified consent source (Shopify Customer Privacy API or an
// approved CMP): call with the visitor's current choice on load and every change.
// null means unknown/loading/error and is treated as denied. No source is wired yet.
export function setGoogleConsent(next: GoogleConsent | null) {
  consent = next ? {analytics: next.analytics === true, adStorage: next.adStorage === true, adUserData: next.adUserData === true} : null;
  if (currentRoute !== undefined) trackGooglePageView(currentRoute);
  else sync();
}

const CLICK_PARAMS = ["gclid", "gbraid", "wbraid"];
function advertisedProduct(pathname: string) {
  const slug = /^\/products\/([a-z0-9-]+)$/.exec(pathname)?.[1];
  return GOOGLE_PRODUCTS.find(product => product === slug);
}
// A URL Google may see: an advertised product path whose query holds only
// well-formed Google click IDs. Campaign values, emails, tokens and codes fail closed.
export function googleEligibleUrl(url: URL) {
  if (!advertisedProduct(url.pathname)) return false;
  for (const [key, value] of url.searchParams) {
    if (!CLICK_PARAMS.includes(key) || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) return false;
  }
  return true;
}

// gtag.js falls back to document.location/referrer, so the real document must be
// clean too, not just the parameters this library sets.
function eligible(route?: string) {
  if (!config || leaving || typeof window === "undefined") return false;
  if ((window.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
  if (!config.hostnames.includes(window.location.hostname.toLowerCase())) return false;
  const here = new URL(window.location.href);
  if (!googleEligibleUrl(here)) return false;
  if (route !== undefined && !googleEligibleUrl(new URL(route, here))) return false;
  if (document.referrer) {
    const referrer = new URL(document.referrer);
    if (referrer.origin === here.origin && !googleEligibleUrl(referrer)) return false;
  }
  return true;
}
function permitted(route?: string) {
  try {
    if (!eligible(route) || !consent) return NONE;
    return {ga4: consent.analytics && config?.ga4Id ? config.ga4Id : undefined,
      ads: consent.adStorage && consent.adUserData && config?.adsId ? config.adsId : undefined};
  } catch { return NONE; }
}

// Explicit page metadata for config and every hit: path only, click IDs only
// under advertising consent, origin-only referrer, fixed title.
function metadata(advertising: boolean) {
  const here = new URL(window.location.href);
  const kept = new URLSearchParams();
  if (advertising) for (const [key, value] of here.searchParams) if (CLICK_PARAMS.includes(key)) kept.append(key, value);
  const query = kept.toString();
  return {page_location: `${here.origin}${here.pathname}${query ? `?${query}` : ""}`,
    ...(document.referrer ? {page_referrer: `${new URL(document.referrer).origin}/`} : {}),
    page_title: "IQON Daily"};
}

function gtag(...args: unknown[]) {
  try { window.gtag?.(...args); } catch {}
}
const DENIED = {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"};
// Google documents ga-disable only before any gtag() call, and denied consent still
// allows cookieless pings. So once gtag.js may be running, any narrower permission
// (withdrawal, GPC, ineligible page) is enforced by leaving this document.
function leave(href?: string) {
  if (leaving) return;
  gtag("consent", "update", DENIED);
  leaving = true;
  if (href) window.location.assign(href);
  else window.location.reload();
}

// Basic consent mode: Google is untouched until a destination is permitted. Denied
// defaults are queued before js/config; ad personalization is never granted here.
function sync(route?: string) {
  const {ga4, ads} = permitted(route);
  try {
    if (scriptAdded && [...configured].some(id => id !== ga4 && id !== ads)) { leave(); return NONE; }
    if (!bootstrapped) {
      if (!ga4 && !ads) return NONE;
      window.dataLayer = window.dataLayer || [];
      // gtag.js reads the standard Arguments objects from dataLayer.
      // eslint-disable-next-line prefer-rest-params
      window.gtag = function () { (window.dataLayer = window.dataLayer || []).push(arguments); };
      gtag("consent", "default", DENIED);
      gtag("set", "ads_data_redaction", true);
      gtag("set", "url_passthrough", false);
      bootstrapped = true;
    }
    const state = {ad_storage: ads ? "granted" : "denied", analytics_storage: ga4 ? "granted" : "denied",
      ad_user_data: ads ? "granted" : "denied", ad_personalization: "denied"};
    if (JSON.stringify(state) !== applied) { gtag("consent", "update", state); applied = JSON.stringify(state); }
    if (!ga4 && !ads) return NONE;
    gtag("set", metadata(!!ads));
    if (!configured.size) gtag("js", new Date());
    for (const id of [ga4, ads]) {
      if (!id || configured.has(id)) continue;
      // Manual SPA page views; no Google signals, remarketing or enhanced conversions.
      gtag("config", id, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
      configured.add(id);
    }
    if (!scriptAdded) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent((ga4 || ads)!)}`;
      document.head.appendChild(script);
      scriptAdded = true;
    }
  } catch { return NONE; }
  return {ga4, ads};
}

function send(name: GoogleEvent, params: Record<string, unknown>) { gtag("event", name, params); }

// Capture-phase click guard: once gtag.js may be running, a same-origin link to a
// page Google may not see becomes a full navigation, so the tag never observes it.
// Other client navigations (router.push, back) are caught by the next page view.
export function guardGoogleNavigation(event: MouseEvent) {
  try {
    if (!scriptAdded || leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || googleEligibleUrl(url)) return;
    event.preventDefault();
    event.stopPropagation();
    leave(url.href);
  } catch {}
}

// One owner for initial and App Router page views. Nothing observed while denied
// or ineligible is replayed later.
export function trackGooglePageView(route: string) {
  currentRoute = route;
  const {ga4, ads} = sync(route);
  if (!ga4) { lastPage = undefined; return; }
  if (lastPage === route) return;
  try {
    const page = metadata(!!ads);
    gtag("set", page);
    send("page_view", {send_to: [ga4], ...page});
  } catch {}
  lastPage = route;
}

// Called only after this add request succeeds. A Shopify warning (stock cap,
// removed line) means this request may have added less than asked, so it is not
// counted. Ads receives it only through an explicit conversion label.
export function trackGoogleCartAddition(snapshot: Pick<CartSnapshot, "items" | "notice">, variantId: string, requestedQuantity: number, sellingPlanId?: string) {
  try {
    if (snapshot.notice || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) return;
    const {ga4, ads} = sync();
    const sendTo = [ga4, ads && config?.adsAddToCartLabel ? `${ads}/${config.adsAddToCartLabel}` : undefined].filter(Boolean);
    if (!sendTo.length) return;
    const line = snapshot.items.find(item => item.variantId === variantId && item.sellingPlanId === sellingPlanId);
    const id = /^(?:gid:\/\/shopify\/ProductVariant\/)?(\d+)$/.exec(variantId)?.[1];
    if (!id || !line || !GOOGLE_PRODUCTS.some(product => product === line.id)) return;
    if (line.quantity < requestedQuantity || line.amount === undefined || (line.currency || "USD") !== "USD") return;
    const price = Math.round(line.amount / line.quantity * 100) / 100;
    if (!Number.isFinite(price) || price < 0) return;
    send("add_to_cart", {send_to: sendTo, ...metadata(!!ads), currency: "USD",
      value: Math.round(price * requestedQuantity * 100) / 100, items: [{item_id: id, price, quantity: requestedQuantity}]});
  } catch {}
}
