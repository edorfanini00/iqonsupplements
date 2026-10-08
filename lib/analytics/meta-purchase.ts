/** Dedicated tracking webhook. Production dispatch is fail-closed until health,
 * checkout consent/withdrawal and durable replay controls are independently reviewed.
 * Signed explicitly synthetic test orders can be delivered only to Meta Test Events.
 * No order, email, fulfillment, admin or database runtime dependencies.
 */
import { SUPPLEMENTS_SHOP, MAX_BODY_BYTES, verifyShopifyHmac, isSubscriptionRenewal } from "./meta-security";
import { sendMetaEvents, type MetaSendDeps, type MetaSendResult, type MetaServerEvent } from "./meta-capi";
import { readMetaAttributes, shopifyNumericId, META_CONSENT_GRANTED, metaVariantsApproved } from "./meta-shared";

export const PURCHASE_TOPICS = ["orders/paid"] as const;
export const DEFAULT_EVENT_SOURCE_URL = "https://www.iqonbody.com/";
export const MAX_EVENT_AGE_S = 24 * 3600;

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

function eventTime(order: Json, nowS: number): number | null {
  const parsed = Date.parse(str(order.processed_at) ?? str(order.created_at) ?? "");
  const t = Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  // Keep original time; a retry cannot refresh a stale conversion.
  return t === null || t > nowS || nowS - t > MAX_EVENT_AGE_S ? null : t;
}

/** Maps a Shopify REST order payload to the Meta Purchase event. Null when it is not an order. */
export function mapOrderToPurchase(payload: unknown, now = Date.now()): MetaServerEvent | null {
  const order = obj(payload);
  const orderId = shopifyNumericId(str(order?.id, 40) ?? str(order?.admin_graphql_api_id, 80));
  if (!order || !orderId || !/^\d+$/.test(orderId)) return null;
  const timestamp = eventTime(order, Math.floor(now / 1000));
  if (timestamp === null) return null;
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
    eventTime: timestamp,
    eventSourceUrl: DEFAULT_EVENT_SOURCE_URL,
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
  const secret = deps.env.META_SHOPIFY_WEBHOOK_SECRET;
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
  if (!order || !/^\d{1,20}$/.test(String(order.id ?? ""))) return { status: 400, body: { ok: false, reason: "not_an_order" } };
  const orderId = String(order.id);
  if (order.test === true && !deps.env.META_CAPI_TEST_EVENT_CODE?.trim()) {
    info({ event: "skipped", reason: "test_order", orderId });
    return { status: 200, body: { ok: true, skipped: "test_order" } };
  }
  const renewal = isSubscriptionRenewal(payload);
  if (renewal.renewal) {
    // Renewals are billed by the Subscriptions app, not a website conversion.
    info({ event: "skipped", reason: "subscription_renewal", orderId });
    return { status: 200, body: { ok: true, skipped: "subscription_renewal" } };
  }
  const consent = readMetaAttributes(order.note_attributes);
  if (consent.consent !== META_CONSENT_GRANTED || headers.get("sec-gpc") === "1") return { status: 200, body: { ok: true, skipped: "advertising_consent_required" } };
  const event = mapOrderToPurchase(payload, (deps.now ?? Date.now)());
  if (!event) return { status: 200, body: { ok: true, skipped: "invalid_or_stale_event" } };
  const variantIds = Array.isArray(order.line_items) ? order.line_items.map(line => shopifyNumericId(obj(line)?.variant_id as string) ?? "") : [];
  const testFixture = order.test === true && !!deps.env.META_CAPI_TEST_EVENT_CODE?.trim()
    && Array.isArray(order.note_attributes) && order.note_attributes.some(a => obj(a)?.name === "_meta_test_fixture" && obj(a)?.value === "synthetic-v1")
    && variantIds.length > 0 && variantIds.every(id => ["8001", "8002", "8003"].includes(id));
  if (testFixture) {
    // Test Events only. Never transmit customer matching inputs from fixtures.
    event.user = {
      clientUserAgent: "IQON synthetic tracking verification",
      email: "tracking-verification@example.invalid",
      externalId: "iqon-tracking-synthetic-v1",
    };
    event.actionSource = "website";
    return deliverEligiblePurchase(event, deps);
  }
  if (!metaVariantsApproved(variantIds)) return { status: 200, body: { ok: true, skipped: "health_eligibility_unverified" } };
  // A cart attribute is a snapshot, not current checkout advertising consent.
  // No dispatch until supported checkout consent + withdrawal and durable replay
  // controls have been independently verified. No environment bypass.
  return { status: 200, body: { ok: true, skipped: "purchase_controls_unverified" } };
}

/** Internal transport retained for a future reviewed activation, never called by the route. */
async function deliverEligiblePurchase(event: MetaServerEvent, deps: PurchaseWebhookDeps): Promise<PurchaseWebhookResult> {
  const result = await (deps.send ?? sendMetaEvents)([event], deps);

  if (result.ok) return { status: 200, body: { ok: true, sent: true, eventId: event.eventId } };
  if (result.skipped) return { status: 200, body: { ok: true, skipped: result.skipped } };
  const transient = result.retryable === true || result.status === undefined || result.status === 429 || result.status >= 500;
  return transient
    ? { status: 503, body: { ok: false, retry: true, reason: "meta_unavailable" } }
    : { status: 200, body: { ok: false, reason: "meta_rejected" } };
}
