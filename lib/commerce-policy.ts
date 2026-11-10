import { isHeldSkincareHandle } from "./skincare-identity";
/** Keep skincare visible for discovery, but closed to every purchase entry point. */
export const SKINCARE_COMING_SOON = true;
/** Informational releases: exact handles are reserved independently of Shopify tags/stock
 * and of any future category-wide launch. Do not add them to the purchase catalog. */
export function isReservedSkincareHandle(handle:unknown):boolean {
  return handle === "enzyme-gel-cleanser" || handle === "hyaluronic-serum" || handle === "peptide-anti-wrinkle-day-cream";
}
export function isComingSoon(product:{id?:string;category?:string}) {
  return isHeldSkincareHandle(product.id) || (SKINCARE_COMING_SOON && product.category === "skincare");
}
/** The storefront's shipping statement, shared by /help and every product page. The typical window is the owner's
 * (21 October 2026): "3 to 5 days", not business days, with no guarantee or start point. Methods and costs come
 * from Shopify checkout. */
export const SHIPPING_NOTE = "Shipping usually takes 3 to 5 days. Available shipping options and costs are shown at checkout.";
/** Help only: Shopify's Shop handles tracking updates (owner, 21 October 2026); no separate message from IQON is implied. */
export const SHOP_TRACKING_NOTE = "Tracking updates are available through Shop once your order is on its way.";
/** A product a shopper can order right now: live Shopify data, not coming soon or unpriced, with an available
 * variant. Product links presented as a next purchase step (guides, selections) require this; anything else fails closed. */
export function isOrderable(product:{id?:string;category?:string;available?:boolean;pricePending?:boolean;variants?:{available:boolean}[]}, mode:string) {
  return mode === "live" && !isComingSoon(product) && !product.pricePending && product.available !== false && !!product.variants?.some(v => v.available);
}
