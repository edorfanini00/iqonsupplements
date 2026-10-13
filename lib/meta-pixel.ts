import type { CartItem } from "./catalog";

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1006368245818889";
type Pixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Pixel;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};
declare global {
  interface Window { fbq?: Pixel; _fbq?: Pixel }
}

export function isStorefrontPath(pathname: string) {
  return !/^\/(account|affiliates|api)(\/|$)/.test(pathname);
}
export function pixelAllowed() {
  return typeof window !== "undefined" &&
    (window.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true &&
    isStorefrontPath(window.location.pathname);
}

let initialized = false;
let lastPage: string | undefined;
let lastProduct: string | undefined;

// The standard Meta queue. next/script owns the single external script load.
export function initializePixel() {
  if (!pixelAllowed()) return false;
  if (initialized) return true;
  if (!window.fbq) {
    const queue = function (...args: unknown[]) {
      if (queue.callMethod) queue.callMethod(...args);
      else queue.queue.push(args);
    } as Pixel;
    queue.queue = [];
    queue.push = queue;
    queue.loaded = true;
    queue.version = "2.0";
    window.fbq = queue;
    window._fbq = queue;
  }
  // App Router owns PageView. Meta's history listener would otherwise send
  // automatic views before our route effect can exclude account/affiliate pages.
  window.fbq.disablePushState = true;
  // Only the explicit storefront events below; no automatic button/form events.
  window.fbq("set", "autoConfig", false, META_PIXEL_ID);
  window.fbq("init", META_PIXEL_ID);
  initialized = true;
  return true;
}

export function trackPageView(route: string) {
  if (!pixelAllowed()) {
    lastPage = undefined;
    lastProduct = undefined;
    if (typeof window !== "undefined") window.fbq?.("consent", "revoke");
    return;
  }
  if (!initializePixel() || lastPage === route) return;
  window.fbq?.("consent", "grant");
  window.fbq?.("track", "PageView");
  lastPage = route;
}

type ProductEvent = { variantId: string; name: string; price: number; currency: string; quantity?: number };
export function productPayload({variantId, name, price, currency, quantity = 1}: ProductEvent) {
  const id = /^(?:gid:\/\/shopify\/ProductVariant\/)?(\d+)$/.exec(variantId)?.[1];
  if (!id || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1 || currency !== "USD") return null;
  return {content_ids: [id], content_type: "product", content_name: name,
    value: Math.round(price * quantity * 100) / 100, currency,
    contents: [{id, quantity, item_price: price}]};
}
export function trackViewContent(product: ProductEvent) {
  if (!pixelAllowed()) return;
  const payload = productPayload(product);
  if (!payload) return;
  const key = `${window.location.pathname}${window.location.search}:${product.variantId}`;
  if (lastProduct === key || !initializePixel()) return;
  window.fbq?.("track", "ViewContent", payload);
  lastProduct = key;
}
export function resetProductView() { lastProduct = undefined; }

// Use the confirmed quantity delta and returned line price, including selling plans
// and Shopify quantity adjustments. Failed requests never reach this helper.
export function trackCartAddition(before: CartItem[], after: CartItem[], variantId: string, sellingPlanId?: string) {
  if (!pixelAllowed()) return;
  const matches = (line: CartItem) => line.variantId === variantId && line.sellingPlanId === sellingPlanId;
  const line = after.find(matches);
  const quantity = (line?.quantity || 0) - (before.find(matches)?.quantity || 0);
  if (!line || quantity <= 0 || line.amount === undefined) return;
  const payload = productPayload({variantId, name: line.name || line.id,
    price: line.amount / line.quantity, currency: line.currency || "USD", quantity});
  if (payload && initializePixel()) window.fbq?.("track", "AddToCart", payload);
}
