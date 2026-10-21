/** Keep skincare visible for discovery, but closed to every purchase entry point. */
export const SKINCARE_COMING_SOON = true;
export function isComingSoon(product:{category?:string}) {
  return SKINCARE_COMING_SOON && product.category === "skincare";
}
/** The only shipping statement the storefront makes: Shopify checkout calculates the options. No delivery window
 * or policy is published until the merchant approves one. Shared by /help and every product page. */
export const SHIPPING_NOTE = "Available shipping options and costs are shown at checkout. Processing and delivery can vary by product and destination.";
/** A product a shopper can order right now: live Shopify data, not coming soon or unpriced, with an available
 * variant. Product links presented as a next purchase step (guides, selections) require this; anything else fails closed. */
export function isOrderable(product:{category?:string;available?:boolean;pricePending?:boolean;variants?:{available:boolean}[]}, mode:string) {
  return mode === "live" && !isComingSoon(product) && !product.pricePending && product.available !== false && !!product.variants?.some(v => v.available);
}
