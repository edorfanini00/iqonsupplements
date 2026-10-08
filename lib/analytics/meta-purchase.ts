/**
 * Shopify orders/paid webhook -> Meta Conversions API Purchase.
 *
 * Checkout runs on Shopify's hosted checkout, which the storefront cannot see,
 * so Purchase is sent from here: event_id purchase_<order id>, the same id the
 * Shopify Customer Events pixel uses for the browser copy (docs/meta-pixel.md).
 * _fbp/_fbc and the last storefront URL come from the order's note_attributes,
 * written as cart attributes at checkout handoff (lib/shopify.server.ts).
 *
 * This route only talks to Meta. It sends no email and writes nothing; it is a
 * separate endpoint from /api/webhooks/shopify/orders (order emails), so
 * subscribing it can never trigger a customer email.
 *
 * Responses (Shopify retries anything that is not 2xx):
 *   200  sent, skipped (test order, subscription renewal, no token, pixel off),
 *        unsupported topic, or Meta rejected the event (4xx: a retry cannot fix it)
 *   401  wrong shop or bad signature
 *   400  unreadable JSON
 *   503  webhook secret missing, or Meta unreachable / 5xx / 429 (safe to retry:
 *        Meta deduplicates on event_id)
 */
import { SUPPLEMENTS_SHOP } from "../affiliates/shopify-admin";
import { MAX_BODY_BYTES, verifyShopifyHmac } from "../orders/webhooks/handler";
import { isSubscriptionRenewal } from "../orders/webhooks/shopify-payload";
import { sendMetaEvents, type MetaSendDeps, type MetaSendResult, type MetaServerEvent } from "./meta-capi";
import { readMetaAttributes, shopifyNumericId } from "./meta-shared";

export const PURCHASE_TOPICS = ["orders/paid"] as const;
export const DEFAULT_EVENT_SOURCE_URL = "https://www.iqonbody.com/";
const MAX_EVENT_AGE_S = 7 * 24 * 3600 - 3600;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown, max = 300): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(str(v) ?? NaN);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

export const purchaseEventId = (orderId: string) => `purchase_${orderId}`;

/** Order total in shop currency: current_* (after edits) when present, else the checkout total. */
function orderValue(order: Json): number {
  for (const key of ["current_total_price", "total_price"]) {
    const set = obj(obj(order[`${key}_set`])?.shop_money);
    const fromSet = num(set?.amount);
    if (fromSet !== null) return fromSet;
    const plain = num(order[key]);
    if (plain !== null) return plain;
  }
  return 0;
}

function eventTime(order: Json, nowS: number): number {
  const parsed = Date.parse(str(order.processed_at) ?? str(order.created_at) ?? "");
  const t = Number.isFinite(parsed) ? Math.floor(parsed / 1000) : nowS;
  // Meta rejects future events and events older than 7 days.
  return t > nowS || nowS - t > MAX_EVENT_AGE_S ? nowS : t;
}

/** Maps a Shopify REST order payload to the Meta Purchase event. Null when it is not an order. */
export function mapOrderToPurchase(payload: unknown, now = Date.now()): MetaServerEvent | null {
  const order = obj(payload);
  const orderId = shopifyNumericId(str(order?.id, 40) ?? str(order?.admin_graphql_api_id, 80));
  if (!order || !orderId || !/^\d+$/.test(orderId)) return null;
  const lines = (Array.isArray(order.line_items) ? order.line_items : []).flatMap((value) => {
    const line = obj(value);
    const id = shopifyNumericId(str(line?.variant_id, 40)) ?? shopifyNumericId(str(line?.product_id, 40));
    const quantity = Number(line?.current_quantity ?? line?.quantity);
    if (!line || !id || !Number.isInteger(quantity) || quantity <= 0) return [];
    const price = num(line.price);
    return [{ id, quantity, ...(price !== null ? { item_price: price } : {}) }];
  });
  const customer = obj(order.customer);
  const billing = obj(order.billing_address);
  const shipping = obj(order.shipping_address);
  const address = billing ?? shipping;
  const ids = readMetaAttributes(order.note_attributes);
  const currency = (str(order.currency, 3) ?? "USD").toUpperCase();
  const userAgent = str(obj(order.client_details)?.user_agent, 500);
  return {
    eventName: "Purchase",
    // Orders without a browser (draft, admin, POS) cannot be website events: Meta rejects those without a user agent.
    actionSource: userAgent ? "website" : "other",
    eventId: purchaseEventId(orderId),
    eventTime: eventTime(order, Math.floor(now / 1000)),
    eventSourceUrl: ids.eventSourceUrl ?? DEFAULT_EVENT_SOURCE_URL,
    customData: {
      value: orderValue(order),
      currency,
      content_type: "product",
      content_ids: [...new Set(lines.map((l) => l.id))],
      contents: lines,
      num_items: lines.reduce((sum, l) => sum + l.quantity, 0),
      order_id: orderId,
    },
    user: {
      email: str(order.email, 320) ?? str(order.contact_email, 320) ?? str(customer?.email, 320),
      phone: str(order.phone, 40) ?? str(billing?.phone, 40) ?? str(shipping?.phone, 40) ?? str(customer?.phone, 40),
      firstName: str(address?.first_name, 100) ?? str(customer?.first_name, 100),
      lastName: str(address?.last_name, 100) ?? str(customer?.last_name, 100),
      city: str(address?.city, 100),
      state: str(address?.province_code, 10),
      zip: str(address?.zip, 20),
      country: str(address?.country_code, 2),
      externalId: shopifyNumericId(str(customer?.id, 40)),
      fbp: ids.fbp,
      fbc: ids.fbc,
      clientIpAddress: str(order.browser_ip, 64),
      clientUserAgent: userAgent,
    },
  };
}

export interface PurchaseWebhookDeps extends MetaSendDeps {
  env: Record<string, string | undefined>;
  send?: (events: MetaServerEvent[], deps: MetaSendDeps) => Promise<MetaSendResult>;
  info?: (event: Record<string, unknown>) => void;
  now?: () => number;
}

export interface PurchaseWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleMetaPurchaseWebhook(rawBody: Buffer | string, headers: Headers, deps: PurchaseWebhookDeps): Promise<PurchaseWebhookResult> {
  const topic = headers.get("x-shopify-topic") ?? "";
  const info = (event: Record<string, unknown>) => {
    try {
      (deps.info ?? ((e) => console.info("[meta-purchase]", JSON.stringify(e))))({ topic, ...event });
    } catch {
      /* logging must not break the webhook */
    }
  };
  const raw = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  if (raw.byteLength > MAX_BODY_BYTES) return { status: 413, body: { ok: false, reason: "too_large" } };
  if (headers.get("x-shopify-shop-domain") !== SUPPLEMENTS_SHOP) {
    info({ event: "rejected", reason: "unexpected_shop" });
    return { status: 401, body: { ok: false, reason: "unexpected_shop" } };
  }
  const secret = deps.env.SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    info({ event: "not_configured", reason: "missing_webhook_secret" });
    return { status: 503, body: { ok: false, retry: true, reason: "not_configured" } };
  }
  if (!verifyShopifyHmac(raw, headers.get("x-shopify-hmac-sha256"), secret)) {
    info({ event: "rejected", reason: "invalid_signature" });
    return { status: 401, body: { ok: false, reason: "invalid_signature" } };
  }
  if (!(PURCHASE_TOPICS as readonly string[]).includes(topic)) return { status: 200, body: { ok: true, ignored: true, reason: "unsupported_topic" } };
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return { status: 400, body: { ok: false, reason: "invalid_json" } };
  }
  const order = obj(payload);
  const event = mapOrderToPurchase(payload, (deps.now ?? Date.now)());
  if (!order || !event) return { status: 400, body: { ok: false, reason: "not_an_order" } };
  const orderId = String(event.customData?.order_id);
  if (order.test === true && !deps.env.META_CAPI_TEST_EVENT_CODE?.trim()) {
    info({ event: "skipped", reason: "test_order", orderId });
    return { status: 200, body: { ok: true, skipped: "test_order" } };
  }
  const renewal = isSubscriptionRenewal(payload);
  if (renewal.renewal) {
    // Renewals are billed by the Subscriptions app, not a website conversion.
    info({ event: "skipped", reason: "subscription_renewal", signal: renewal.signal, orderId });
    return { status: 200, body: { ok: true, skipped: "subscription_renewal" } };
  }
  const result = await (deps.send ?? sendMetaEvents)([event], deps);
  info({ event: result.ok ? "sent" : "not_sent", orderId, eventId: event.eventId, status: result.status, skipped: result.skipped, hasFbp: !!event.user.fbp, hasFbc: !!event.user.fbc });
  if (result.ok) return { status: 200, body: { ok: true, sent: true, eventId: event.eventId } };
  if (result.skipped) return { status: 200, body: { ok: true, skipped: result.skipped } };
  const transient = result.status === undefined || result.status === 429 || result.status >= 500;
  return transient
    ? { status: 503, body: { ok: false, retry: true, reason: "meta_unavailable" } }
    : { status: 200, body: { ok: false, reason: "meta_rejected" } };
}
