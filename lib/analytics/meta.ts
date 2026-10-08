/** Storefront advertising helpers. Explicit consent and reviewed health eligibility
 * are both required. No routes/products are approved in this release; the SDK and
 * event relay stay inactive. Purchase belongs to the isolated Shopify webhook.
 */
import { resolvePixelId, shopifyNumericId, metaPathApproved, metaVariantsApproved, type RelayEvent } from "./meta-shared";

import { advertisingConsent } from "./meta-consent";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; push: Fbq; loaded: boolean; version: string };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export const META_PIXEL_ID = resolvePixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
export const META_SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** Pages that are not storefront (affiliate portal): no pixel events there. */
export const isTrackedPath = metaPathApproved;

export function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Drops a repeat of the same key inside the window (React Strict Mode double
 * effects, double clicks, hydration re-runs). Returns true when the event may fire.
 */
export function createDedupe(windowMs: number, now: () => number = Date.now) {
  let last = { key: "", at: -Infinity };
  return (key: string) => {
    const t = now();
    if (last.key === key && t - last.at < windowMs) return false;
    last = { key, at: t };
    return true;
  };
}

const pageViewGuard = createDedupe(700);
const viewContentGuard = createDedupe(700);
const addToCartGuard = createDedupe(400);
const initiateCheckoutGuard = createDedupe(1500);

let initialised = false;

/** Standard fbq queue stub (same as Meta's base code) plus init, once. The SDK is loaded by next/script. */
export function ensureFbq(): Fbq | null {
  if (typeof window === "undefined" || !META_PIXEL_ID || !advertisingConsent()) return null;
  const location = new URL(window.location.href);
  if (!isTrackedPath(location.pathname) || location.search || location.hash) return null;
  try {
    if (!window.fbq) {
      const n = function (...args: unknown[]) {
        if (n.callMethod) n.callMethod(...args);
        else n.queue.push(args);
      } as Fbq;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      window.fbq = n;
      if (!window._fbq) window._fbq = n;
    }
    if (!initialised) {
      initialised = true;
      window.fbq("init", META_PIXEL_ID);
    }
    return window.fbq;
  } catch {
    return null;
  }
}

function prune(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)));
}

/** Reserved transport: no public relay dispatch until abuse controls are verified. */
function postServerEvent(eventName: RelayEvent, eventId: string, customData: Record<string, unknown>) {
  // Relay remains disabled until independently reviewed provenance/rate/replay control.
  void eventName; void eventId; void customData;
}

function track(eventName: RelayEvent, params: Record<string, unknown>): string | null {
  if (!advertisingConsent()) return null;
  const ids = params.content_ids;
  if (eventName !== "PageView" && (!Array.isArray(ids) || !metaVariantsApproved(ids))) return null;
  const fbq = ensureFbq();
  if (!fbq) return null;
  const eventId = newEventId();
  const data = prune(params);
  try {
    fbq("track", eventName, data, { eventID: eventId });
  } catch {
    /* SDK problems must not break the store */
  }
  postServerEvent(eventName, eventId, data);
  return eventId;
}

/** content_ids use the numeric Shopify variant id, the same id the Purchase webhook sends. */
export const contentId = (variantId: string | undefined | null, fallback: string) => shopifyNumericId(variantId) ?? fallback;

const money = (value: number) => (Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : undefined);

export function trackPageView(routeKey: string) {
  if (!pageViewGuard(routeKey)) return null;
  return track("PageView", {});
}

export function trackViewContent(p: { routeKey: string; contentId: string; name?: string; value: number; currency: string }) {
  if (!viewContentGuard(`${p.routeKey}|${p.contentId}`)) return null;
  return track("ViewContent", { content_ids: [p.contentId], content_type: "product", value: money(p.value), currency: p.currency });
}

export function trackAddToCart(p: { contentId: string; name?: string; quantity: number; unitPrice: number; currency: string }) {
  if (!addToCartGuard(`${p.contentId}|${p.quantity}`)) return null;
  return track("AddToCart", {
    content_ids: [p.contentId],
    content_type: "product",
    contents: [{ id: p.contentId, quantity: p.quantity, item_price: money(p.unitPrice) }],
    num_items: p.quantity,
    value: money(p.unitPrice * p.quantity),
    currency: p.currency,
  });
}

export function trackInitiateCheckout(p: { items: { contentId: string; quantity: number }[]; value: number; currency: string }) {
  const ids = [...new Set(p.items.map((i) => i.contentId))];
  if (!initiateCheckoutGuard(ids.join(","))) return null;
  return track("InitiateCheckout", {
    content_ids: ids,
    content_type: "product",
    contents: p.items.map((i) => ({ id: i.contentId, quantity: i.quantity })),
    num_items: p.items.reduce((sum, i) => sum + i.quantity, 0),
    value: money(p.value),
    currency: p.currency,
  });
}
