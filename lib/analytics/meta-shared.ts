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
 * checkout. Shopify copies cart attributes to order note_attributes.
 * These values are not a current hosted-checkout consent authority.
 */
export const META_CART_ATTRIBUTE_KEYS = { fbp: "_fbp", fbc: "_fbc", eventSourceUrl: "_event_source_url", consent: "_meta_consent" } as const;

export const META_CONSENT_COOKIE = "iqon_ad_consent";
export const META_CONSENT_GRANTED = "granted-v1";
// Empty until explicit health-data eligibility review. Never infer eligibility from Meta category None.
export const APPROVED_META_PATHS: readonly string[] = [];
export const APPROVED_META_VARIANTS: readonly string[] = [];
export const metaPathApproved = (path: string) => APPROVED_META_PATHS.includes(path);
export const metaVariantsApproved = (ids: readonly string[]) => ids.length > 0 && ids.every(id => /^\d{1,20}$/.test(id) && APPROVED_META_VARIANTS.includes(id));

export type MetaBrowserIds = { consent?: string | null; fbp: string | null; fbc: string | null; eventSourceUrl: string | null };
export type CartAttribute = { key: string; value: string };

const FBP_PATTERN = /^fb\.\d\.\d{10,14}\.\d{1,30}$/;
const FBC_PATTERN = /^fb\.\d\.\d{10,14}\.[A-Za-z0-9_\-.]{1,400}$/;

export const validFbp = (value: unknown): string | null =>
  typeof value === "string" && FBP_PATTERN.test(value.trim()) ? value.trim() : null;
export const validFbc = (value: unknown): string | null =>
  typeof value === "string" && FBC_PATTERN.test(value.trim()) ? value.trim() : null;

/** Only reviewed storefront routes; emitted URL contains no path, query, credentials or fragment. */
export function validEventSourceUrl(value: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!allowedHosts.includes(url.hostname) || !metaPathApproved(url.pathname)) return null;
    return `${url.origin}/`;
  } catch { return null; }
}

/** Explicit negative entries clear stale cart attribution after absence/withdrawal. */
export function metaCartAttributes(ids: MetaBrowserIds): CartAttribute[] {
  const granted = ids.consent === META_CONSENT_GRANTED;
  return [
    { key: META_CART_ATTRIBUTE_KEYS.consent, value: granted ? META_CONSENT_GRANTED : "denied" },
    { key: META_CART_ATTRIBUTE_KEYS.fbp, value: granted ? validFbp(ids.fbp) ?? "" : "" },
    { key: META_CART_ATTRIBUTE_KEYS.fbc, value: granted ? validFbc(ids.fbc) ?? "" : "" },
    { key: META_CART_ATTRIBUTE_KEYS.eventSourceUrl, value: granted ? validEventSourceUrl(ids.eventSourceUrl, ["www.iqonbody.com", "iqonbody.com"]) ?? "" : "" },
  ];
}

/**
 * Replaces our keys in an existing attribute list and keeps everyone else's.
 * Returns null when nothing would change, so callers can skip the write.
 */
export function mergeCartAttributes(existing: readonly { key: string; value: string | null }[] | null | undefined, ours: readonly CartAttribute[]): CartAttribute[] | null {
  if (!ours.length) return null;
  // cartAttributesUpdate replaces the whole list: keep other apps' entries, null values as "".
  const current = (existing ?? []).filter((a) => a && typeof a.key === "string").map((a) => ({ key: a.key, value: typeof a.value === "string" ? a.value : "" }));
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
  const granted = found[META_CART_ATTRIBUTE_KEYS.consent] === META_CONSENT_GRANTED;
  const url = found[META_CART_ATTRIBUTE_KEYS.eventSourceUrl];
  return {
    consent: granted ? META_CONSENT_GRANTED : "denied",
    fbp: granted ? validFbp(found[META_CART_ATTRIBUTE_KEYS.fbp]) : null,
    fbc: granted ? validFbc(found[META_CART_ATTRIBUTE_KEYS.fbc]) : null,
    eventSourceUrl: granted ? validEventSourceUrl(url, ["www.iqonbody.com", "iqonbody.com"]) : null,
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
