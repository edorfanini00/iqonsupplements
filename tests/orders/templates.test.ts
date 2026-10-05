import { test } from "node:test";
import assert from "node:assert/strict";
import { renderOrderConfirmationEmail } from "../../lib/orders/emails/order-confirmation";
import { MORE_TO_FOLLOW_COPY, SHIPPING_TIME_COPY, renderShippingConfirmationEmail } from "../../lib/orders/emails/shipping-confirmation";
import { brandConfig, maskEmail } from "../../lib/orders/emails/format";
import { resolveLineItemImages, storefrontImageLookup } from "../../lib/orders/emails/images";
import type { OrderSnapshot, ShipmentDetails } from "../../lib/orders/emails/types";
import { hasMoreToFollow, parseFulfillment, parseOrderPaid, shipmentReadiness, totalsMismatch } from "../../lib/orders/webhooks/shopify-payload";
import { totalRows } from "../../lib/orders/emails/layout";
import { BRAND, DASH, FORBIDDEN_HEALTH_WORDS, fulfillmentPayload, orderPaidPayload, partialFirst, visibleText } from "./fixtures";

async function snapshot(overrides: Record<string, unknown> = {}): Promise<OrderSnapshot> {
  const order = parseOrderPaid(orderPaidPayload(overrides))!;
  return { ...order, lineItems: await resolveLineItemImages(order.lineItems, BRAND, null) };
}

function shipment(order: OrderSnapshot, overrides: Partial<ShipmentDetails> = {}): ShipmentDetails {
  const f = parseFulfillment(fulfillmentPayload())!;
  return {
    fulfillmentId: f.fulfillmentId, orderId: f.orderId, orderName: order.orderName, email: f.email, firstName: order.firstName,
    carrier: f.carrier, trackingNumber: f.trackingNumber, trackingUrl: f.trackingUrl, lineItems: order.lineItems,
    shippingAddress: f.destination, moreToFollow: false, orderStatusUrl: order.orderStatusUrl, ...overrides,
  };
}

function textWithoutUrls(text: string): string {
  return text.replace(/https:\/\/\S+/g, " ");
}

function assertCustomerCopyClean(html: string, text: string) {
  const visible = visibleText(html);
  for (const [label, copy] of [["html", visible], ["text", textWithoutUrls(text)]] as const) {
    const dash = copy.match(DASH);
    assert.equal(dash, null, `${label} contains a dash: ...${dash ? copy.slice(Math.max(0, dash.index! - 40), dash.index! + 40) : ""}...`);
    const lower = copy.toLowerCase();
    for (const word of FORBIDDEN_HEALTH_WORDS) assert.ok(!new RegExp(`\\b${word}\\b`).test(lower), `${label} contains "${word}"`);
  }
}

test("order payload parsing uses current totals, presentment currency and drops payment data", () => {
  const order = parseOrderPaid(orderPaidPayload())!;
  assert.equal(order.orderId, "6123456789012");
  assert.equal(order.orderName, "#1042");
  assert.equal(order.firstName, "Ava");
  // Pre discount line sum, not Shopify's post discount subtotal_price (121.55).
  assert.equal(order.subtotal, "143.00");
  assert.equal(order.discounts, "21.45");
  assert.equal(order.tax, "10.48");
  assert.equal(order.total, "132.03");
  assert.deepEqual(order.discountCodes, ["WELCOME15"]);
  assert.equal(order.lineItems[0].sellingPlanName, "Delivered every 30 days, save 10%");
  assert.equal(order.lineItems[1].lineTotal, "68.00");
  assert.equal(order.shippingAddress?.province, "CA");
  assert.ok(!JSON.stringify(order).includes("PRIVATE BILLING"));
  assert.equal(parseOrderPaid({ id: "not-a-number" }), null);
  const eur = parseOrderPaid(orderPaidPayload({ presentment_currency: "EUR", current_total_price_set: { shop_money: { amount: "132.03" }, presentment_money: { amount: "121.00" } } }))!;
  assert.equal(eur.currency, "EUR");
  assert.equal(eur.total, "121.00");
});

const usd = (amount: string) => ({ shop_money: { amount, currency_code: "USD" }, presentment_money: { amount, currency_code: "USD" } });
const eur = (amount: string) => ({ shop_money: { amount, currency_code: "EUR" }, presentment_money: { amount, currency_code: "EUR" } });

/** Realistic Shopify orders/paid totals, each internally consistent the way Shopify reports them. */
const TOTALS_SCENARIOS: [string, Record<string, unknown>, { subtotal: string; discounts: string; shipping: string; total: string }][] = [
  ["percentage code, free shipping (base fixture)", {}, { subtotal: "143.00", discounts: "21.45", shipping: "0.00", total: "132.03" }],
  [
    "paid shipping removed by a shipping discount",
    {
      current_total_discounts: "28.40", current_total_discounts_set: usd("28.40"),
      total_shipping_price_set: usd("6.95"),
      shipping_lines: [{ id: 1, title: "Standard", price: "6.95", discounted_price: "0.00", price_set: usd("6.95") }],
    },
    { subtotal: "143.00", discounts: "28.40", shipping: "6.95", total: "132.03" },
  ],
  [
    "no discount, paid shipping",
    {
      discount_codes: [], current_total_discounts: "0.00", current_total_discounts_set: usd("0.00"),
      current_subtotal_price: "143.00", current_subtotal_price_set: usd("143.00"),
      current_total_tax: "12.33", current_total_tax_set: usd("12.33"),
      total_shipping_price_set: usd("6.95"),
      current_total_price: "162.28", current_total_price_set: usd("162.28"),
    },
    { subtotal: "143.00", discounts: "0.00", shipping: "6.95", total: "162.28" },
  ],
  [
    "tax included in prices (EUR), discount and shipping",
    {
      currency: "EUR", presentment_currency: "EUR", taxes_included: true,
      line_items: [{ id: 1, product_id: 9002, variant_id: 8002, title: "Hydrolyzed Collagen Peptides", quantity: 2, current_quantity: 2, price: "30.00", price_set: eur("30.00"), requires_shipping: true }],
      current_subtotal_price: "54.00", current_subtotal_price_set: eur("54.00"),
      current_total_discounts: "6.00", current_total_discounts_set: eur("6.00"),
      total_shipping_price_set: eur("4.90"),
      current_total_tax: "9.40", current_total_tax_set: eur("9.40"),
      current_total_price: "58.90", current_total_price_set: eur("58.90"),
    },
    { subtotal: "60.00", discounts: "6.00", shipping: "4.90", total: "58.90" },
  ],
  [
    "order edited after checkout: one line removed (current_quantity 0)",
    {
      line_items: (orderPaidPayload().line_items as Record<string, unknown>[]).map((line, i) => (i === 0 ? { ...line, current_quantity: 0 } : line)),
      current_subtotal_price: "88.40", current_subtotal_price_set: usd("88.40"),
      current_total_discounts: "15.60", current_total_discounts_set: usd("15.60"),
      current_total_tax: "7.62", current_total_tax_set: usd("7.62"),
      current_total_price: "96.02", current_total_price_set: usd("96.02"),
    },
    { subtotal: "104.00", discounts: "15.60", shipping: "0.00", total: "96.02" },
  ],
];

test("receipt totals add up: subtotal minus discounts plus shipping plus tax (unless included) equals total", () => {
  for (const [label, overrides, expected] of TOTALS_SCENARIOS) {
    const payload = orderPaidPayload(overrides);
    const order = parseOrderPaid(payload)!;
    assert.deepEqual(
      { subtotal: order.subtotal, discounts: order.discounts, shipping: order.shipping, total: order.total },
      expected,
      label,
    );
    assert.ok(Math.abs(totalsMismatch(order)) <= 0.01, `${label}: off by ${totalsMismatch(order)}`);
    // Shopify's own subtotal_price is after discounts; showing it would double count.
    if (Number(order.discounts) > 0) assert.notEqual(order.subtotal, (payload as Record<string, unknown>).current_subtotal_price, label);
    // The rendered rows carry the same arithmetic.
    const rows = Object.fromEntries(totalRows(order).map((row) => [row.label.replace(/ \(.*\)$/, ""), row.value]));
    assert.ok(rows.Subtotal.endsWith(expected.subtotal.replace(/\.00$/, ".00")), label);
  }
  // A mismatch (for example a tip the email does not itemise) is detectable.
  assert.equal(totalsMismatch({ subtotal: "10.00", discounts: "0.00", shipping: "0.00", tax: "0.00", taxesIncluded: false, total: "12.00" }), 2);
});

test("fulfilment readiness: tracking required, live statuses only", () => {
  assert.deepEqual(shipmentReadiness(parseFulfillment(fulfillmentPayload())!), { ready: true });
  assert.deepEqual(shipmentReadiness(parseFulfillment(fulfillmentPayload({ status: "open" }))!), { ready: true });
  const untracked = parseFulfillment(fulfillmentPayload({ tracking_number: null, tracking_numbers: [], tracking_url: null, tracking_urls: [] }))!;
  assert.deepEqual(shipmentReadiness(untracked), { ready: false, reason: "awaiting_tracking", terminal: false });
  for (const status of ["cancelled", "error", "failure"]) assert.equal((shipmentReadiness(parseFulfillment(fulfillmentPayload({ status }))!) as { terminal: boolean }).terminal, true);
  assert.equal(parseFulfillment(fulfillmentPayload({ tracking_url: "javascript:alert(1)", tracking_urls: [] }))!.trackingUrl, null);
});

test("partial detection across multiple fulfilments", async () => {
  const order = await snapshot();
  const first = parseFulfillment(partialFirst())!;
  assert.equal(hasMoreToFollow(order, first), true);
  assert.equal(hasMoreToFollow(order, parseFulfillment(fulfillmentPayload())!), false);
  const nmnOnly = { ...first, lineItems: order.lineItems.filter((l) => l.title === "NMN") };
  assert.equal(hasMoreToFollow(order, nmnOnly, { "15000000000001": 1, "15000000000002": 2 }), false);
  assert.equal(hasMoreToFollow(null, { lineItems: [], payloadShowsRemaining: true }), true);
  assert.equal(hasMoreToFollow(null, { lineItems: [], payloadShowsRemaining: false }), false);
});

test("order confirmation renders every required detail", async () => {
  const order = await snapshot();
  const email = renderOrderConfirmationEmail(order, BRAND);
  const visible = visibleText(email.html);
  assert.equal(email.subject, "Your IQON order #1042 is confirmed");
  for (const expected of [
    "Order #1042", "Thank you, Ava.", "Creatine Monohydrate", "Hydrolyzed Collagen Peptides", "NMN", "Unflavored", "Qty 2",
    "Subscription: Delivered every 30 days, save 10%", "$39.00", "$68.00", "$36.00", "Subtotal", "$143.00",
    "Discount (WELCOME15)", "$21.45 off", "Shipping", "Free", "Tax", "$10.48", "Total", "$132.03 USD",
    "Ava Morgan", "1 Market Street", "Apartment 4B", "San Francisco, CA 94105", "United States",
    "info@iqonhealth.com", "View your order",
  ]) assert.ok(visible.includes(expected), `missing ${expected}`);
  assert.ok(!visible.includes("Default Title"));
  // Preheader is the first hidden element in the body.
  assert.match(email.html, /<body[^>]*>\s*<div style="display:none;[^"]*mso-hide:all;[^"]*">Thank you for your order\./);
  assert.ok(email.text.includes("Creatine Monohydrate  $39.00") && email.text.includes("Total: $132.03 USD"));
  assertCustomerCopyClean(email.html, email.text);
});

test("email markup is table based, 600px, Outlook and dark mode aware, and only uses absolute https assets", async () => {
  const order = await snapshot();
  for (const email of [renderOrderConfirmationEmail(order, BRAND), renderShippingConfirmationEmail(shipment(order), BRAND)]) {
    const { html } = email;
    assert.ok(html.includes('role="presentation"'));
    assert.ok(html.includes("max-width:600px"));
    assert.ok(html.includes('<meta name="color-scheme" content="light dark">'));
    assert.ok(html.includes("@media (prefers-color-scheme:dark)"));
    assert.ok(html.includes("[data-ogsc]"));
    assert.ok(html.includes("<!--[if mso]>"));
    assert.ok(html.includes("v:roundrect"));
    assert.ok(html.includes("@media screen and (max-width:620px)"));
    for (const [, src] of html.matchAll(/<img[^>]+src="([^"]+)"/g)) assert.match(src, /^https:\/\//);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) assert.match(href, /^(https:\/\/|mailto:)/);
    assert.ok(!/<script/i.test(html));
  }
});

test("shipping confirmation with tracking", async () => {
  const order = await snapshot();
  const email = renderShippingConfirmationEmail(shipment(order), BRAND);
  const visible = visibleText(email.html);
  assert.equal(email.subject, "Your IQON order #1042 is on its way");
  for (const expected of ["Good news, Ava. Your order is on its way.", "UPS", "1Z999AA10123456784", "Track your parcel", SHIPPING_TIME_COPY, "Creatine Monohydrate", "Delivering to", "1 Market Street"])
    assert.ok(visible.includes(expected), `missing ${expected}`);
  // Same preference as lib/orders/tracking.ts resolveTrackingUrl: universal tracker by number first.
  assert.ok(email.html.includes('href="https://parcelsapp.com/en/tracking/1Z999AA10123456784"'));
  const urlOnly = renderShippingConfirmationEmail(shipment(order, { trackingNumber: null }), BRAND);
  assert.ok(urlOnly.html.includes('href="https://www.ups.com/track?tracknum=1Z999AA10123456784"'));
  assert.ok(!visible.includes("$39.00"), "shipping email does not repeat prices");
  assert.ok(!visible.includes(MORE_TO_FOLLOW_COPY));
  assert.ok(email.text.includes("Tracking number: 1Z999AA10123456784"));
  assertCustomerCopyClean(email.html, email.text);
});

test("shipping confirmation, partial shipment, no carrier URL", async () => {
  const order = await snapshot();
  const email = renderShippingConfirmationEmail(
    shipment(order, { lineItems: order.lineItems.slice(0, 2), moreToFollow: true, trackingUrl: null, carrier: null }),
    BRAND,
  );
  const visible = visibleText(email.html);
  assert.equal(email.subject, "Part of your IQON order #1042 is on its way");
  assert.ok(visible.includes("Good news, Ava. Part of your order is on its way."));
  assert.ok(!visible.includes("Your order is on its way"));
  assert.ok(visible.includes(MORE_TO_FOLLOW_COPY));
  assert.ok(visible.includes("In this shipment"));
  assert.ok(!visible.includes("NMN"));
  assert.ok(email.html.includes("https://parcelsapp.com/en/tracking/1Z999AA10123456784"));
  assertCustomerCopyClean(email.html, email.text);
});

test("no first name falls back to warm generic greetings", async () => {
  const order = await snapshot({ customer: null, shipping_address: { address1: "1 Market Street", city: "San Francisco" }, billing_address: null });
  assert.ok(visibleText(renderOrderConfirmationEmail(order, BRAND).html).includes("Thank you for your order."));
  assert.ok(visibleText(renderShippingConfirmationEmail(shipment(order, { firstName: null }), BRAND).html).includes("Good news. Your order is on its way."));
});

test("every dynamic value is HTML escaped (XSS)", async () => {
  const evil = '<script>alert("x")</script><img src=x onerror=alert(1)>';
  const order = await snapshot({
    name: `#1042${evil}`,
    customer: { first_name: `Ava"><svg onload=alert(1)>` },
    discount_codes: [{ code: evil }],
    shipping_address: { name: evil, address1: evil, city: "San Francisco", zip: "94105", country: "United States" },
    order_status_url: 'javascript:alert(1)//"',
    line_items: [{ id: 1, product_id: 1, variant_id: 1, title: evil, variant_title: evil, quantity: 1, price: "1.00", selling_plan_allocation: { selling_plan: { name: evil } } }],
  });
  const confirmation = renderOrderConfirmationEmail(order, BRAND);
  const shipped = renderShippingConfirmationEmail(shipment(order, { carrier: evil, trackingNumber: evil, trackingUrl: "javascript:alert(1)" }), BRAND);
  for (const { html } of [confirmation, shipped]) {
    assert.ok(!html.includes("<script"));
    assert.ok(!html.includes("<img src=x"));
    assert.ok(!html.includes("<svg"));
    assert.ok(!/href="javascript:/i.test(html));
    assert.ok(html.includes("&lt;script&gt;"));
  }
});

test("brand config: env overrides, unsafe origins ignored, emails masked for logs", () => {
  assert.deepEqual(brandConfig({}), BRAND);
  assert.equal(brandConfig({}).supportEmail, "info@iqonhealth.com", "owner decision: support inbox and Reply-To");
  assert.equal(brandConfig({ SUPPLEMENTS_EMAIL_ASSET_ORIGIN: "https://preview.iqonbody.com/x" }).assetOrigin, "https://preview.iqonbody.com");
  assert.equal(brandConfig({ SUPPLEMENTS_EMAIL_ASSET_ORIGIN: "http://insecure.test" }).assetOrigin, "https://www.iqonbody.com");
  assert.equal(brandConfig({ SUPPLEMENTS_SUPPORT_EMAIL: "help@iqonbody.com" }).supportEmail, "help@iqonbody.com");
  assert.equal(maskEmail("ava.morgan@example.com"), "a***@example.com");
  assert.equal(maskEmail(null), "(none)");
});

test("images: Storefront first, then catalog by handle or title, then placeholder", async () => {
  const items = parseOrderPaid(orderPaidPayload({
    line_items: [
      { id: 1, product_id: 11, variant_id: 21, title: "Creatine Monohydrate", quantity: 1, price: "39.00" },
      { id: 2, product_id: 12, variant_id: 22, title: "Renamed In Shopify", quantity: 1, price: "34.00" },
      { id: 3, product_id: 13, variant_id: 23, title: "NMN", quantity: 1, price: "36.00" },
      { id: 4, product_id: 14, variant_id: 24, title: "Mystery Item", quantity: 1, price: "1.00" },
    ],
  }))!.lineItems;
  const lookup = async () => new Map([
    ["variant:21", { handle: "creatine-monohydrate", imageUrl: "https://cdn.shopify.com/s/files/creatine.jpg" }],
    ["variant:22", { handle: "hydrolyzed-collagen-peptides", imageUrl: null }],
  ]);
  const resolved = await resolveLineItemImages(items, BRAND, lookup);
  assert.deepEqual(resolved.map((i) => i.imageUrl), [
    "https://cdn.shopify.com/s/files/creatine.jpg",
    "https://www.iqonbody.com/images/email/products/hydrolyzed-collagen-peptides.jpg",
    "https://www.iqonbody.com/images/email/products/nmn.jpg",
    "https://www.iqonbody.com/images/email/products/placeholder.jpg",
  ]);
});

test("Storefront image lookup builds the query from variant ids and maps the response", async () => {
  let body: { query: string; variables: { ids: string[] } } | null = null;
  const fetcher = (async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return Response.json({ data: { nodes: [
      { id: "gid://shopify/ProductVariant/8001", image: null, product: { id: "gid://shopify/Product/9001", handle: "creatine-monohydrate", featuredImage: { url: "https://cdn.shopify.com/creatine.jpg" } } },
      null,
    ] } });
  }) as unknown as typeof fetch;
  const lookup = storefrontImageLookup({ SHOPIFY_STORE_DOMAIN: "nr9zd0-t5.myshopify.com", SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "synthetic", SHOPIFY_API_VERSION: "2026-07" }, 1000, fetcher);
  const map = await lookup(["8001"], []);
  assert.deepEqual(body!.variables.ids, ["gid://shopify/ProductVariant/8001"]);
  assert.match(body!.query, /preferredContentType:JPG/);
  assert.deepEqual(map.get("variant:8001"), { handle: "creatine-monohydrate", imageUrl: "https://cdn.shopify.com/creatine.jpg" });
  assert.equal((await storefrontImageLookup({}, 1000, fetcher)(["1"], [])).size, 0);
});
