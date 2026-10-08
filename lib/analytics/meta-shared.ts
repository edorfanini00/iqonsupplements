/**
 * Meta Pixel / Conversions API values shared by the browser and the server.
 * Pure module: no Node or DOM APIs, safe to import from either side.
 */

/** "IQON Body Web" dataset, connected to ad account act_1600704801853649. */
export const DEFAULT_META_PIXEL_ID = "1006368245818889";
export const META_DOMAIN_VERIFICATION = "0lu4a3qv07rw7jbt484id6y35f7pwf";

/**
 * Pixel id from NEXT_PUBLIC_META_PIXEL_ID, defaulting to the IQON Body dataset.
 * "off", "disabled" or "0" turns the pixel off (for example on preview deployments).
 */
export function resolvePixelId(value: string | undefined | null): string | null {
  const v = value?.trim();
  if (!v) return DEFAULT_META_PIXEL_ID;
  if (/^(off|disabled|false|0)$/i.test(v)) return null;
  return /^\d{5,20}$/.test(v) ? v : DEFAULT_META_PIXEL_ID;
}

/** Events the browser relay forwards. Purchase comes only from the Shopify webhook. */
export const RELAY_EVENTS = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout"] as const;
export type RelayEvent = (typeof RELAY_EVENTS)[number];
export const isRelayEvent = (value: unknown): value is RelayEvent =>
  typeof value === "string" && (RELAY_EVENTS as readonly string[]).includes(value);

/** event_id shape accepted by the relay: UUIDs and the evt_ fallback. */
export const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Numeric id from a Shopify gid ("gid://shopify/ProductVariant/123" -> "123"); other values pass through. */
export function shopifyNumericId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (!v) return null;
  const tail = v.split("/").pop() ?? "";
  return /^\d{1,20}$/.test(tail) ? tail : v;
}

/**
 * Cart attributes that carry the Meta browser ids into Shopify's hosted
 * checkout. The leading underscore hides them from the buyer; Shopify copies
 * cart attributes to the order's note_attributes, where the Purchase webhook
 * reads them.
 */
export const META_CART_ATTRIBUTE_KEYS = { fbp: "_fbp", fbc: "_fbc", eventSourceUrl: "_event_source_url" } as const;

export type MetaBrowserIds = { fbp: string | null; fbc: string | null; eventSourceUrl: string | null };
export type CartAttribute = { key: string; value: string };

const FBP_PATTERN = /^fb\.\d\.\d{10,14}\.\d{1,30}$/;
const FBC_PATTERN = /^fb\.\d\.\d{10,14}\.[A-Za-z0-9_\-.]{1,400}$/;

export const validFbp = (value: unknown): string | null =>
  typeof value === "string" && FBP_PATTERN.test(value.trim()) ? value.trim() : null;
export const validFbc = (value: unknown): string | null =>
  typeof value === "string" && FBC_PATTERN.test(value.trim()) ? value.trim() : null;

/** https URL on one of the allowed hosts, without the fragment, at most 1000 chars. */
export function validEventSourceUrl(value: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (!allowedHosts.includes(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Cart attributes to write; invalid or empty values are left out. */
export function metaCartAttributes(ids: MetaBrowserIds): CartAttribute[] {
  const out: CartAttribute[] = [];
  const fbp = validFbp(ids.fbp);
  const fbc = validFbc(ids.fbc);
  if (fbp) out.push({ key: META_CART_ATTRIBUTE_KEYS.fbp, value: fbp });
  if (fbc) out.push({ key: META_CART_ATTRIBUTE_KEYS.fbc, value: fbc });
  if (ids.eventSourceUrl) out.push({ key: META_CART_ATTRIBUTE_KEYS.eventSourceUrl, value: ids.eventSourceUrl.slice(0, 1000) });
  return out;
}

/**
 * Replaces our keys in an existing attribute list and keeps everyone else's.
 * Returns null when nothing would change, so callers can skip the write.
 */
export function mergeCartAttributes(existing: readonly CartAttribute[] | null | undefined, ours: readonly CartAttribute[]): CartAttribute[] | null {
  if (!ours.length) return null;
  const current = (existing ?? []).filter((a) => a && typeof a.key === "string" && typeof a.value === "string");
  const keys = new Set(ours.map((a) => a.key));
  const merged = [...current.filter((a) => !keys.has(a.key)), ...ours];
  const same = ours.every((a) => current.some((c) => c.key === a.key && c.value === a.value));
  return same ? null : merged;
}

/** Reads the Meta ids back from Shopify order note_attributes ([{name, value}]) or cart attributes ([{key, value}]). */
export function readMetaAttributes(attributes: unknown): MetaBrowserIds {
  const found: Record<string, string> = {};
  if (Array.isArray(attributes)) {
    for (const entry of attributes) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const key = typeof e.name === "string" ? e.name : typeof e.key === "string" ? e.key : null;
      if (key && typeof e.value === "string") found[key] = e.value;
    }
  }
  const url = found[META_CART_ATTRIBUTE_KEYS.eventSourceUrl];
  return {
    fbp: validFbp(found[META_CART_ATTRIBUTE_KEYS.fbp]),
    fbc: validFbc(found[META_CART_ATTRIBUTE_KEYS.fbc]),
    eventSourceUrl: typeof url === "string" && /^https:\/\//.test(url) && url.length <= 1000 ? url : null,
  };
}

/** Value of one cookie from a Cookie header. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
