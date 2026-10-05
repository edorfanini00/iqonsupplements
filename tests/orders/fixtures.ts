/** Synthetic Shopify webhook payloads shaped like real REST webhook bodies. No real customer data. */
import { createHmac } from "node:crypto";
import type { EmailBrandConfig } from "../../lib/orders/emails/types";

export const SECRET = "synthetic-webhook-secret-for-tests";
export const SHOP = "nr9zd0-t5.myshopify.com";
export const BRAND: EmailBrandConfig = { assetOrigin: "https://www.iqonbody.com", siteUrl: "https://www.iqonbody.com/", supportEmail: "info@iqonhealth.com" };

export function sign(body: string | Buffer, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

export function webhookHeaders(topic: string, body: string, overrides: Record<string, string | null> = {}): Headers {
  const base: Record<string, string | null> = {
    "content-type": "application/json",
    "x-shopify-topic": topic,
    "x-shopify-shop-domain": SHOP,
    "x-shopify-hmac-sha256": sign(body),
    "x-shopify-webhook-id": `wh-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
  const headers = new Headers();
  for (const [k, v] of Object.entries(base)) if (v !== null) headers.set(k, v);
  return headers;
}

const money = (amount: string) => ({ shop_money: { amount, currency_code: "USD" }, presentment_money: { amount, currency_code: "USD" } });

export const ORDER_ID = 6123456789012;
export const LINE_CREATINE = 15000000000001;
export const LINE_COLLAGEN = 15000000000002;
export const LINE_NMN = 15000000000003;

const address = {
  first_name: "Ava",
  last_name: "Morgan",
  name: "Ava Morgan",
  company: null,
  address1: "1 Market Street",
  address2: "Apartment 4B",
  city: "San Francisco",
  province: "California",
  province_code: "CA",
  zip: "94105",
  country: "United States",
  country_code: "US",
  phone: "5555550100",
};

/**
 * Real Shopify semantics (REST Order): total_line_items_price is the pre
 * discount line sum, (current_)subtotal_price is AFTER discounts, total_discounts
 * includes line and order discounts, total_shipping_price_set is before
 * shipping discounts. Here: lines 39 + 2 x 34 + 36 = 143.00, WELCOME15 takes
 * 21.45, subtotal_price 121.55, tax 10.48 (8.625% of 121.55), total 132.03.
 */
export function orderPaidPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    admin_graphql_api_id: `gid://shopify/Order/${ORDER_ID}`,
    name: "#1042",
    order_number: 1042,
    email: "ava.morgan@example.com",
    contact_email: "ava.morgan@example.com",
    test: false,
    currency: "USD",
    presentment_currency: "USD",
    taxes_included: false,
    financial_status: "paid",
    // Created by hosted checkout (headless storefront orders carry the channel's app id as source_name).
    source_name: "web",
    checkout_id: 3100000000001,
    checkout_token: "synthetic-checkout-token-1042",
    cart_token: "synthetic-cart-token-1042",
    order_status_url: "https://www.iqonbody.com/68512342/orders/abc123/authenticate?key=synthetic",
    total_line_items_price: "143.00",
    total_line_items_price_set: money("143.00"),
    subtotal_price: "121.55",
    subtotal_price_set: money("121.55"),
    total_discounts: "21.45",
    total_discounts_set: money("21.45"),
    total_tax: "10.48",
    total_tax_set: money("10.48"),
    total_price: "132.03",
    total_price_set: money("132.03"),
    current_subtotal_price: "121.55",
    current_subtotal_price_set: money("121.55"),
    current_total_discounts: "21.45",
    current_total_discounts_set: money("21.45"),
    current_total_tax: "10.48",
    current_total_tax_set: money("10.48"),
    current_total_price: "132.03",
    current_total_price_set: money("132.03"),
    total_shipping_price_set: money("0.00"),
    shipping_lines: [{ id: 4400000000001, title: "Standard", price: "0.00", discounted_price: "0.00", price_set: money("0.00") }],
    discount_codes: [{ code: "WELCOME15", amount: "21.45", type: "percentage" }],
    customer: { id: 7001, first_name: "Ava", last_name: "Morgan", email: "ava.morgan@example.com" },
    billing_address: { ...address, address1: "PRIVATE BILLING" },
    shipping_address: address,
    // Payment data that must never reach the ledger snapshot.
    payment_gateway_names: ["shopify_payments"],
    browser_ip: "203.0.113.9",
    line_items: [
      { id: LINE_CREATINE, admin_graphql_api_id: `gid://shopify/LineItem/${LINE_CREATINE}`, product_id: 9001, variant_id: 8001, title: "Creatine Monohydrate", variant_title: "Default Title", name: "Creatine Monohydrate", quantity: 1, current_quantity: 1, price: "39.00", price_set: money("39.00"), discount_allocations: [{ amount: "5.85", amount_set: money("5.85"), discount_application_index: 0 }], requires_shipping: true, selling_plan_allocation: { selling_plan: { name: "Delivered every 30 days, save 10%" } } },
      { id: LINE_COLLAGEN, admin_graphql_api_id: `gid://shopify/LineItem/${LINE_COLLAGEN}`, product_id: 9002, variant_id: 8002, title: "Hydrolyzed Collagen Peptides", variant_title: "Unflavored", quantity: 2, current_quantity: 2, price: "34.00", price_set: money("34.00"), discount_allocations: [{ amount: "10.20", amount_set: money("10.20"), discount_application_index: 0 }], requires_shipping: true },
      { id: LINE_NMN, admin_graphql_api_id: `gid://shopify/LineItem/${LINE_NMN}`, product_id: 9003, variant_id: 8003, title: "NMN", variant_title: null, quantity: 1, current_quantity: 1, price: "36.00", price_set: money("36.00"), discount_allocations: [{ amount: "5.40", amount_set: money("5.40"), discount_application_index: 0 }], requires_shipping: true },
    ],
    ...overrides,
  };
}

export const RENEWAL_ORDER_ID = 6123456789099;

/**
 * Renewal order as created by a Shopify Subscriptions billing attempt: no
 * checkout or cart, source_name "subscription_contract", subscription lines only.
 */
export function renewalOrderPayload(overrides: Record<string, unknown> = {}) {
  const base = orderPaidPayload();
  return orderPaidPayload({
    id: RENEWAL_ORDER_ID,
    admin_graphql_api_id: `gid://shopify/Order/${RENEWAL_ORDER_ID}`,
    name: "#1077",
    order_number: 1077,
    source_name: "subscription_contract",
    checkout_id: null,
    checkout_token: null,
    cart_token: null,
    discount_codes: [],
    line_items: [base.line_items[0]],
    ...overrides,
  });
}

export function renewalFulfillmentPayload(overrides: Record<string, unknown> = {}) {
  return fulfillmentPayload({
    id: 5550000000077,
    admin_graphql_api_id: "gid://shopify/Fulfillment/5550000000077",
    order_id: RENEWAL_ORDER_ID,
    name: "#1077.1",
    line_items: [fulfillmentLine(LINE_CREATINE, 9001, 8001, "Creatine Monohydrate", 1)],
    ...overrides,
  });
}

function fulfillmentLine(id: number, productId: number, variantId: number, title: string, quantity: number, fulfillableQuantity = 0) {
  return { id, product_id: productId, variant_id: variantId, title, variant_title: null, quantity, price: "0.00", requires_shipping: true, fulfillable_quantity: fulfillableQuantity };
}

export function fulfillmentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 5550000000001,
    admin_graphql_api_id: "gid://shopify/Fulfillment/5550000000001",
    order_id: ORDER_ID,
    name: "#1042.1",
    status: "success",
    service: "manual",
    shipment_status: null,
    email: "ava.morgan@example.com",
    destination: address,
    tracking_company: "UPS",
    tracking_number: "1Z999AA10123456784",
    tracking_numbers: ["1Z999AA10123456784"],
    tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    tracking_urls: ["https://www.ups.com/track?tracknum=1Z999AA10123456784"],
    line_items: [
      fulfillmentLine(LINE_CREATINE, 9001, 8001, "Creatine Monohydrate", 1),
      fulfillmentLine(LINE_COLLAGEN, 9002, 8002, "Hydrolyzed Collagen Peptides", 2),
      fulfillmentLine(LINE_NMN, 9003, 8003, "NMN", 1),
    ],
    ...overrides,
  };
}

export const partialFirst = () => fulfillmentPayload({
  line_items: [fulfillmentLine(LINE_CREATINE, 9001, 8001, "Creatine Monohydrate", 1), fulfillmentLine(LINE_COLLAGEN, 9002, 8002, "Hydrolyzed Collagen Peptides", 2)],
});
export const partialSecond = () => fulfillmentPayload({
  id: 5550000000002,
  admin_graphql_api_id: "gid://shopify/Fulfillment/5550000000002",
  name: "#1042.2",
  tracking_company: "USPS",
  tracking_number: "9400111899223197428490",
  tracking_numbers: ["9400111899223197428490"],
  tracking_url: null,
  tracking_urls: [],
  line_items: [fulfillmentLine(LINE_NMN, 9003, 8003, "NMN", 1)],
});

/** Visible copy only: drops head, comments (Outlook VML), tags and decodes common entities. */
export function visibleText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#847;|&zwnj;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Any hyphen, en/em dash, minus or other dash character. */
export const DASH = /[-‐-―−﹘﹣－]/;

export const FORBIDDEN_HEALTH_WORDS = [
  "cure", "cures", "treat", "treats", "treatment", "heal", "heals", "prevent", "prevents", "diagnose", "disease", "clinically",
  "medical", "therapy", "therapeutic", "immune", "immunity", "detox", "weight loss", "fat burning", "guaranteed results", "miracle",
];
