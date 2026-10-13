// Storefront Meta events (PageView, ViewContent, AddToCart). Pure module, used by the browser.
// Sent only after an explicit "Allow" on this site, never under GPC, only on allowlisted routes
// and only for carts made up entirely of reviewed variants (shopify/custom-pixels/eligibility.json,
// the same list as the checkout pixel). Each event is one request whose every parameter is set
// here: no Meta SDK, so no automatic events, page scraping, cookies, referrer or query strings.
import eligibility from "../shopify/custom-pixels/eligibility.json";

export const META_PIXEL_ID: string = eligibility.pixelId;
const VARIANTS: Record<string, string> = eligibility.variants;
const HANDLES = new Set(Object.values(VARIANTS));
const ROUTES = new Set(["/", "/collections/all", "/collections/supplements"]);

export const numericVariant = (id: string | null | undefined) => {
  const tail = typeof id === "string" ? id.split("/").pop() || "" : "";
  return /^\d{1,20}$/.test(tail) ? tail : null;
};
export const variantEligible = (id: string | null | undefined) => { const n = numericVariant(id); return !!n && Object.hasOwn(VARIANTS, n); };
export const productHandle = (pathname: string) => /^\/products\/([a-z0-9-]+)$/.exec(pathname)?.[1] || null;
/** Routes where a PageView may be sent: home, supplement collections and reviewed product pages only. */
export function trackablePath(pathname: string) {
  const handle = productHandle(pathname);
  return ROUTES.has(pathname) || (!!handle && HANDLES.has(handle));
}
/** Every line must be a reviewed variant; one other item suppresses the whole event. */
export const cartEligible = (variantIds: (string | undefined)[]) => variantIds.length > 0 && variantIds.every(id => variantEligible(id));

export type StorefrontEvent = "PageView" | "ViewContent" | "AddToCart";
export type StorefrontPayload = {value: number; currency: string; contents: {id: string; quantity: number}[]};

export function storefrontEventUrl(event: StorefrontEvent, eventId: string, pageUrl: string, payload?: StorefrontPayload): string | null {
  let page: URL;
  try { page = new URL(pageUrl); } catch { return null; }
  if (!trackablePath(page.pathname) || !/^[A-Za-z0-9_-]{8,64}$/.test(eventId)) return null;
  const params = new URLSearchParams({id: META_PIXEL_ID, ev: event, eid: eventId, dl: `${page.origin}${page.pathname}`, noscript: "1"});
  if (payload) {
    if (!payload.contents.length || !payload.contents.every(item => variantEligible(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20)) return null;
    if (!Number.isFinite(payload.value) || payload.value < 0 || !/^[A-Z]{3}$/.test(payload.currency)) return null;
    const contents = payload.contents.map(item => ({id: numericVariant(item.id)!, quantity: item.quantity}));
    params.set("cd[value]", String(Math.round(payload.value * 100) / 100));
    params.set("cd[currency]", payload.currency);
    params.set("cd[content_type]", "product");
    params.set("cd[content_ids]", JSON.stringify(contents.map(item => item.id)));
    params.set("cd[contents]", JSON.stringify(contents));
    params.set("cd[num_items]", String(contents.reduce((sum, item) => sum + item.quantity, 0)));
  } else if (event !== "PageView") return null;
  return `https://www.facebook.com/tr?${params}`;
}
