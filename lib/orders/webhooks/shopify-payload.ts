/**
 * Pure mapping from Shopify REST webhook payloads (orders/paid,
 * fulfillments/create, fulfillments/update) to the email data shapes.
 * Never trusts field types: every value is coerced or dropped.
 */
import type { EmailAddress, EmailLineItem, OrderSnapshot } from "../emails/types";
import { safeHttpsUrl } from "../emails/format";

type Json = Record<string, unknown>;

function obj(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}
function str(value: unknown, max = 300): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}
function id(value: unknown): string | null {
  const v = str(value, 100);
  if (!v) return null;
  const tail = v.split("/").pop() ?? "";
  return /^\d{1,20}$/.test(tail) ? tail : null;
}
function amount(value: unknown): string {
  const v = typeof value === "number" ? value : Number(str(value) ?? "0");
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}
function email(value: unknown): string | null {
  const v = str(value, 320);
  return v && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? v : null;
}

/** Prefer the amount the buyer saw (presentment money) over shop money. */
function money(order: Json, setKey: string, plainKey: string): string {
  const set = obj(order[setKey]);
  const presentment = obj(set?.presentment_money);
  if (presentment && str(presentment.amount)) return amount(presentment.amount);
  const shop = obj(set?.shop_money);
  if (shop && str(shop.amount)) return amount(shop.amount);
  return amount(order[plainKey]);
}

/** Shopify's current_* fields reflect edits and refunds after checkout; fall back to the originals. */
function currentMoney(order: Json, base: string): string {
  const current = `current_${base}`;
  return order[current] !== undefined || obj(order[`${current}_set`])
    ? money(order, `${current}_set`, current)
    : money(order, `${base}_set`, base);
}

const cents = (value: string) => Math.round(Number(value) * 100);

/**
 * Pre discount merchandise subtotal. Shopify's (current_)subtotal_price is
 * already AFTER discounts, so it cannot sit above a "Discount" row. Sum the
 * lines at their current quantities (edits and removals applied), falling back
 * to total_line_items_price when no line is usable.
 */
function lineSubtotal(order: Json, lines: EmailLineItem[]): string {
  if (!lines.length) return money(order, "total_line_items_price_set", "total_line_items_price");
  return (lines.reduce((sum, line) => sum + cents(line.lineTotal), 0) / 100).toFixed(2);
}

/** Shipping before shipping discounts (those are part of total_discounts). */
function shippingTotal(order: Json): string {
  const set = obj(order.total_shipping_price_set);
  if (set) return money(order, "total_shipping_price_set", "total_shipping_price");
  const lines = Array.isArray(order.shipping_lines) ? order.shipping_lines : [];
  return amount(lines.reduce((sum: number, line) => sum + (Number(obj(line)?.price) || 0), 0));
}

export function parseAddress(value: unknown): EmailAddress | null {
  const a = obj(value);
  if (!a) return null;
  const name = str(a.name) ?? ([str(a.first_name), str(a.last_name)].filter(Boolean).join(" ") || null);
  const address: EmailAddress = {
    name,
    company: str(a.company),
    address1: str(a.address1),
    address2: str(a.address2),
    city: str(a.city),
    province: str(a.province_code) ?? str(a.province),
    zip: str(a.zip, 40),
    country: str(a.country) ?? str(a.country_code),
  };
  return address.address1 || address.city ? address : null;
}

function sellingPlanName(line: Json): string | null {
  const allocation = obj(line.selling_plan_allocation);
  const plan = obj(allocation?.selling_plan) ?? obj(line.selling_plan);
  return str(plan?.name) ?? str(line.selling_plan_name);
}

function unitPrice(line: Json): string {
  const set = obj(line.price_set);
  const presentment = obj(set?.presentment_money);
  return amount(presentment?.amount ?? line.price);
}

export function parseLineItem(value: unknown, quantityKey: "current_quantity" | "quantity" = "quantity"): EmailLineItem | null {
  const line = obj(value);
  if (!line) return null;
  const lineId = id(line.id) ?? id(line.admin_graphql_api_id);
  const quantity = Number(line[quantityKey] ?? line.quantity);
  if (!lineId || !Number.isInteger(quantity) || quantity <= 0) return null;
  const price = unitPrice(line);
  return {
    id: lineId,
    productId: id(line.product_id),
    variantId: id(line.variant_id),
    title: str(line.title) ?? str(line.name) ?? "IQON item",
    variantTitle: str(line.variant_title),
    quantity,
    unitPrice: price,
    lineTotal: (Number(price) * quantity).toFixed(2),
    sellingPlanName: sellingPlanName(line),
    requiresShipping: line.requires_shipping !== false,
    imageUrl: null,
  };
}

export function firstName(order: Json): string | null {
  const customer = obj(order.customer);
  const shipping = obj(order.shipping_address);
  const billing = obj(order.billing_address);
  return str(customer?.first_name, 60) ?? str(shipping?.first_name, 60) ?? str(billing?.first_name, 60);
}

export function orderEmail(order: Json): string | null {
  return email(order.email) ?? email(order.contact_email) ?? email(obj(order.customer)?.email);
}

export function orderName(order: Json, fallbackId: string): string {
  return str(order.name, 40) ?? (str(order.order_number, 20) ? `#${str(order.order_number, 20)}` : `#${fallbackId}`);
}

/** orders/paid payload -> persisted snapshot. Returns null when the payload is unusable. */
export function parseOrderPaid(payload: unknown): OrderSnapshot | null {
  const order = obj(payload);
  if (!order) return null;
  const orderId = id(order.id) ?? id(order.admin_graphql_api_id);
  if (!orderId) return null;
  const currency = (str(order.presentment_currency, 3) ?? str(order.currency, 3) ?? "USD").toUpperCase();
  const allLines = (Array.isArray(order.line_items) ? order.line_items : [])
    .map((line) => parseLineItem(line, "current_quantity"))
    .filter((line): line is EmailLineItem => !!line);
  const codes = (Array.isArray(order.discount_codes) ? order.discount_codes : [])
    .map((d) => str(obj(d)?.code, 60))
    .filter((c): c is string => !!c);
  return {
    orderId,
    orderName: orderName(order, orderId),
    email: orderEmail(order),
    firstName: firstName(order),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
    test: order.test === true,
    lineItems: allLines.slice(0, 100),
    subtotal: lineSubtotal(order, allLines),
    discounts: currentMoney(order, "total_discounts"),
    discountCodes: codes,
    shipping: shippingTotal(order),
    tax: currentMoney(order, "total_tax"),
    taxesIncluded: order.taxes_included === true,
    total: currentMoney(order, "total_price"),
    shippingAddress: parseAddress(order.shipping_address),
    orderStatusUrl: safeHttpsUrl(order.order_status_url),
  };
}

export type FulfillmentStatus = "pending" | "open" | "success" | "cancelled" | "error" | "failure" | "unknown";

export interface ParsedFulfillment {
  fulfillmentId: string;
  orderId: string;
  status: FulfillmentStatus;
  email: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  destination: EmailAddress | null;
  firstName: string | null;
  lineItems: EmailLineItem[];
  /** Order lines in this payload that Shopify still reports as fulfillable. */
  payloadShowsRemaining: boolean;
  name: string | null;
}

export function parseFulfillment(payload: unknown): ParsedFulfillment | null {
  const f = obj(payload);
  if (!f) return null;
  const fulfillmentId = id(f.id) ?? id(f.admin_graphql_api_id);
  const orderId = id(f.order_id);
  if (!fulfillmentId || !orderId) return null;
  const rawStatus = str(f.status, 20)?.toLowerCase() ?? "unknown";
  const status = (["pending", "open", "success", "cancelled", "error", "failure"].includes(rawStatus) ? rawStatus : "unknown") as FulfillmentStatus;
  const numbers = Array.isArray(f.tracking_numbers) ? f.tracking_numbers.map((n) => str(n, 100)).filter(Boolean) : [];
  const urls = Array.isArray(f.tracking_urls) ? f.tracking_urls.map((u) => safeHttpsUrl(u)).filter(Boolean) : [];
  const rawLines = Array.isArray(f.line_items) ? f.line_items : [];
  const destination = obj(f.destination);
  return {
    fulfillmentId,
    orderId,
    status,
    email: email(f.email),
    carrier: str(f.tracking_company, 80),
    trackingNumber: str(f.tracking_number, 100) ?? (numbers[0] as string | undefined) ?? null,
    trackingUrl: safeHttpsUrl(f.tracking_url) ?? (urls[0] as string | undefined) ?? null,
    destination: parseAddress(destination),
    firstName: str(destination?.first_name, 60),
    lineItems: rawLines.map((line) => parseLineItem(line)).filter((line): line is EmailLineItem => !!line).slice(0, 100),
    payloadShowsRemaining: rawLines.some((line) => Number(obj(line)?.fulfillable_quantity) > 0),
    name: str(f.name, 40),
  };
}

/**
 * Receipt arithmetic: subtotal minus discounts plus shipping plus tax (unless
 * tax is included in prices) must equal the total. Returns the difference in
 * the order currency; anything beyond a cent means Shopify charged something
 * the email does not itemise (tips, duties) and is logged by the handler.
 */
export function totalsMismatch(order: Pick<OrderSnapshot, "subtotal" | "discounts" | "shipping" | "tax" | "taxesIncluded" | "total">): number {
  const computed = cents(order.subtotal) - cents(order.discounts) + cents(order.shipping) + (order.taxesIncluded ? 0 : cents(order.tax));
  return (cents(order.total) - computed) / 100;
}

/** A shipping email goes out only for a live fulfilment that carries tracking. */
export function shipmentReadiness(f: ParsedFulfillment): { ready: true } | { ready: false; reason: string; terminal: boolean } {
  if (f.status !== "success" && f.status !== "open")
    return { ready: false, reason: `fulfillment_status_${f.status}`, terminal: ["cancelled", "error", "failure"].includes(f.status) };
  if (!f.trackingNumber && !f.trackingUrl) return { ready: false, reason: "awaiting_tracking", terminal: false };
  if (!f.lineItems.length) return { ready: false, reason: "no_line_items", terminal: false };
  return { ready: true };
}

/**
 * Whether items from the order are still waiting to ship after this
 * fulfilment. `shippedElsewhere` counts quantities already covered by earlier
 * shipping emails for the same order (line item id -> quantity).
 */
export function hasMoreToFollow(
  order: { lineItems: Pick<EmailLineItem, "id" | "quantity" | "requiresShipping">[] } | null,
  shipment: Pick<ParsedFulfillment, "lineItems" | "payloadShowsRemaining">,
  shippedElsewhere: Record<string, number> = {},
): boolean {
  if (shipment.payloadShowsRemaining) return true;
  if (!order) return false;
  const shipped = new Map<string, number>(Object.entries(shippedElsewhere));
  for (const line of shipment.lineItems) shipped.set(line.id, (shipped.get(line.id) ?? 0) + line.quantity);
  return order.lineItems.some((line) => line.requiresShipping && (shipped.get(line.id) ?? 0) < line.quantity);
}
