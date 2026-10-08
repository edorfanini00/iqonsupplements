/**
 * Browser pixel event -> Conversions API relay (POST /api/meta/track).
 *
 * The browser sends only the event name, its event_id and product data; the
 * match signals (_fbp/_fbc cookies, IP, user agent) are read here from the
 * request. No PII is accepted from the browser. Server only.
 */
import { clientIp, sendMetaEvents, type MetaSendDeps, type MetaServerEvent } from "./meta-capi";
import { EVENT_ID_PATTERN, isRelayEvent, readCookie, validEventSourceUrl, validFbc, validFbp } from "./meta-shared";

export const RELAY_MAX_BODY = 4096;
export const STORE_HOSTS = ["www.iqonbody.com", "iqonbody.com"] as const;

export type RelayResult = { status: number; body: Record<string, unknown> | null };

/** Unknown events and malformed bodies: 204, nothing forwarded (same as the iqonhealth relay). */
const ignored = (): RelayResult => ({ status: 204, body: null });

/** Keeps only the custom_data fields Meta uses for these events, with checked types. */
export function sanitizeCustomData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof input.value === "number" && Number.isFinite(input.value) && input.value >= 0 && input.value < 1_000_000) out.value = Math.round(input.value * 100) / 100;
  if (typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency)) out.currency = input.currency;
  if (Array.isArray(input.content_ids)) {
    const ids = input.content_ids.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id)).slice(0, 50);
    if (ids.length) out.content_ids = ids;
  }
  if (input.content_type === "product") out.content_type = "product";
  if (typeof input.content_name === "string" && input.content_name.trim()) out.content_name = input.content_name.trim().slice(0, 120);
  if (typeof input.num_items === "number" && Number.isInteger(input.num_items) && input.num_items > 0 && input.num_items <= 2000) out.num_items = input.num_items;
  if (Array.isArray(input.contents)) {
    const contents = input.contents.flatMap((c) => {
      if (!c || typeof c !== "object") return [];
      const item = c as Record<string, unknown>;
      if (typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(item.id)) return [];
      const quantity = typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100 ? item.quantity : 1;
      const price = typeof item.item_price === "number" && Number.isFinite(item.item_price) && item.item_price >= 0 ? { item_price: Math.round(item.item_price * 100) / 100 } : {};
      return [{ id: item.id, quantity, ...price }];
    }).slice(0, 50);
    if (contents.length) out.contents = contents;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function handleRelay(request: Request, deps: MetaSendDeps = {}): Promise<RelayResult> {
  try {
    const host = new URL(request.url).hostname;
    // Only our own pages post here; a different Origin is a cross site call.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return { status: 403, body: { ok: false } };
    if (Number(request.headers.get("content-length") ?? 0) > RELAY_MAX_BODY) return { status: 413, body: { ok: false } };
    const text = await request.text();
    if (text.length > RELAY_MAX_BODY) return { status: 413, body: { ok: false } };
    let input: Record<string, unknown>;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return ignored();
      input = parsed as Record<string, unknown>;
    } catch {
      return ignored();
    }
    if (!isRelayEvent(input.eventName)) return ignored();
    if (typeof input.eventId !== "string" || !EVENT_ID_PATTERN.test(input.eventId)) return ignored();
    const allowedHosts = [...STORE_HOSTS, host];
    const cookies = request.headers.get("cookie");
    const event: MetaServerEvent = {
      eventName: input.eventName,
      eventId: input.eventId,
      eventSourceUrl: validEventSourceUrl(input.eventSourceUrl, allowedHosts) ?? validEventSourceUrl(request.headers.get("referer"), allowedHosts),
      customData: sanitizeCustomData(input.customData),
      user: {
        fbp: validFbp(readCookie(cookies, "_fbp")),
        fbc: validFbc(readCookie(cookies, "_fbc")),
        clientIpAddress: clientIp(request.headers),
        clientUserAgent: request.headers.get("user-agent"),
      },
    };
    const result = await sendMetaEvents([event], deps);
    return { status: 202, body: { ok: result.ok, ...(result.skipped ? { skipped: result.skipped } : {}) } };
  } catch {
    return { status: 202, body: { ok: false } };
  }
}
