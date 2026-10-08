/**
 * Browser pixel event -> Conversions API relay (POST /api/meta/track).
 *
 * The browser sends only the event name, its event_id and product data; the
 * match signals (_fbp/_fbc cookies, IP, user agent) are read here from the
 * request. No PII is accepted from the browser. Server only.
 */
import { type MetaSendDeps } from "./meta-capi";
import { readLimitedBody } from "./meta-security";

export const RELAY_MAX_BODY = 4096;
export const STORE_HOSTS = ["www.iqonbody.com", "iqonbody.com"] as const;

export type RelayResult = { status: number; body: Record<string, unknown> | null };

/** Unknown events and malformed bodies: 204, nothing forwarded (same as the iqonhealth relay). */


/** Keeps only the custom_data fields Meta uses for these events, with checked types. */
export function sanitizeCustomData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof input.value === "number" && Number.isFinite(input.value) && input.value >= 0 && input.value < 1_000_000) out.value = Math.round(input.value * 100) / 100;
  if (typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency)) out.currency = input.currency;
  if (Array.isArray(input.content_ids)) {
    const ids = input.content_ids.filter((id): id is string => typeof id === "string" && /^\d{1,20}$/.test(id)).slice(0, 50);
    if (ids.length) out.content_ids = ids;
  }
  if (input.content_type === "product") out.content_type = "product";

  if (typeof input.num_items === "number" && Number.isInteger(input.num_items) && input.num_items > 0 && input.num_items <= 2000) out.num_items = input.num_items;
  if (Array.isArray(input.contents)) {
    const contents = input.contents.flatMap((c) => {
      if (!c || typeof c !== "object") return [];
      const item = c as Record<string, unknown>;
      if (typeof item.id !== "string" || !/^\d{1,20}$/.test(item.id)) return [];
      const quantity = typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100 ? item.quantity : 1;
      const price = typeof item.item_price === "number" && Number.isFinite(item.item_price) && item.item_price >= 0 ? { item_price: Math.round(item.item_price * 100) / 100 } : {};
      return [{ id: item.id, quantity, ...price }];
    }).slice(0, 50);
    if (contents.length) out.contents = contents;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Hard gate: Origin is not authentication. No configuration flag can bypass this gate.
 * Re-enable only with independently reviewed signed provenance AND durable rate/replay
 * control, current consent verification, and explicit health-data eligibility.
 */
export async function handleRelay(request: Request, deps: MetaSendDeps = {}): Promise<RelayResult> {
  void deps;
  if (request.headers.get("origin") !== new URL(request.url).origin) return { status: 403, body: { ok: false } };
  const read = await readLimitedBody(request, RELAY_MAX_BODY);
  if (!read.ok) return { status: read.status, body: { ok: false, reason: read.reason } };
  return { status: 200, body: { ok: true, skipped: "relay_controls_unverified" } };
}
