import { test } from "node:test";
import assert from "node:assert/strict";
import { handleShopifyOrderWebhook, readLimitedBody, type WebhookDeps } from "../../lib/orders/webhooks/handler";
import { MORE_TO_FOLLOW_COPY } from "../../lib/orders/emails/shipping-confirmation";
import { verifyShopifyWebhookSignature } from "../../lib/affiliates/shopify-webhook";
import { BRAND, ORDER_ID, SECRET, fulfillmentPayload, orderPaidPayload, partialFirst, partialSecond, sign, visibleText, webhookHeaders } from "./fixtures";
import { FakeSender, MemoryStore } from "./memory";

function setup(overrides: Partial<WebhookDeps> = {}) {
  const store = new MemoryStore();
  const sender = new FakeSender();
  const logs: Record<string, unknown>[] = [];
  const deps: WebhookDeps = {
    env: { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET },
    store,
    sender,
    imageLookup: null,
    adminOrderLookup: null,
    brand: BRAND,
    log: (e) => logs.push(e),
    ...overrides,
  };
  return { store, sender, logs, deps };
}

async function deliver(deps: WebhookDeps, topic: string, payload: unknown, headerOverrides: Record<string, string | null> = {}) {
  const body = JSON.stringify(payload);
  return handleShopifyOrderWebhook(body, webhookHeaders(topic, body, headerOverrides), deps);
}

test("HMAC helper: valid, tampered, wrong secret and missing secret", () => {
  const body = JSON.stringify(orderPaidPayload());
  assert.equal(verifyShopifyWebhookSignature(body, sign(body), SECRET).valid, true);
  assert.equal(verifyShopifyWebhookSignature(body + " ", sign(body), SECRET).valid, false);
  assert.equal(verifyShopifyWebhookSignature(body, sign(body, "other-secret"), SECRET).valid, false);
  assert.equal(verifyShopifyWebhookSignature(body, sign(body), undefined).valid, false);
  assert.equal(verifyShopifyWebhookSignature(body, null, SECRET).valid, false);
});

test("orders/paid with a valid signature sends exactly one confirmation", async () => {
  const { deps, sender, store } = setup();
  const res = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(res.status, 200);
  assert.equal(res.body.sent, true);
  assert.equal(sender.sent.length, 1);
  const mail = sender.sent[0];
  assert.equal(mail.to, "ava.morgan@example.com");
  assert.equal(mail.idempotencyKey, `order-confirmation/${ORDER_ID}`);
  assert.equal(mail.subject, "Your IQON order #1042 is confirmed");
  assert.equal(mail.replyTo, BRAND.supportEmail);
  const row = store.get("order_confirmation", String(ORDER_ID))!;
  assert.equal(row.status, "sent");
  assert.equal(row.messageId, "msg_1");
});

test("ledger snapshot keeps only what the emails need (no payment or billing data)", async () => {
  const { deps, store } = setup();
  await deliver(deps, "orders/paid", orderPaidPayload());
  const json = JSON.stringify(store.get("order_confirmation", String(ORDER_ID))!.snapshot);
  for (const forbidden of ["PRIVATE BILLING", "203.0.113.9", "shopify_payments", "5555550100", "gateway"]) assert.ok(!json.includes(forbidden), forbidden);
});

test("rejects bad signature, wrong shop and missing secret without sending", async () => {
  const { deps, sender } = setup();
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload(), { "x-shopify-hmac-sha256": sign("tampered") })).status, 401);
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload(), { "x-shopify-hmac-sha256": null })).status, 401);
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload(), { "x-shopify-shop-domain": "evil.myshopify.com" })).status, 401);
  const noSecret = setup({ env: {} });
  const res = await deliver(noSecret.deps, "orders/paid", orderPaidPayload());
  assert.equal(res.status, 503);
  assert.equal(sender.sent.length + noSecret.sender.sent.length, 0);
});

test("unknown topics are acknowledged and ignored; oversized bodies are refused", async () => {
  const { deps, sender } = setup();
  const res = await deliver(deps, "orders/create", orderPaidPayload());
  assert.equal(res.status, 200);
  assert.equal(res.body.ignored, true);
  const huge = "x".repeat(1_000_001);
  assert.equal((await handleShopifyOrderWebhook(huge, webhookHeaders("orders/paid", huge), deps)).status, 413);
  assert.equal(await readLimitedBody(new Request("https://x.test", { method: "POST", body: huge })), null);
  assert.equal(await readLimitedBody(new Request("https://x.test", { method: "POST", body: "{}" })), "{}");
  assert.equal(sender.sent.length, 0);
});

test("fails closed with 503 when the database or Resend is not configured", async () => {
  for (const missing of [{ store: null }, { sender: null }]) {
    const { deps } = setup(missing);
    const res = await deliver(deps, "orders/paid", orderPaidPayload());
    assert.equal(res.status, 503);
    assert.equal(res.body.reason, "not_configured");
  }
});

test("duplicate delivery of the same order sends once", async () => {
  const { deps, sender } = setup();
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload())).status, 200);
  const again = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(sender.sent.length, 1);
});

test("concurrent duplicate deliveries result in exactly one send", async () => {
  const { deps, sender } = setup({ sender: new FakeSender([], 50) });
  const results = await Promise.all(Array.from({ length: 8 }, () => deliver(deps, "orders/paid", orderPaidPayload())));
  assert.equal((deps.sender as FakeSender).sent.length, 1);
  assert.equal(sender.sent.length, 0); // the default sender was replaced
  assert.equal(results.filter((r) => r.body.sent === true).length, 1);
  // Losers either see the live claim (503, retried later) or the finished send (200 duplicate).
  for (const r of results.filter((r) => r.body.sent !== true)) assert.ok(r.status === 503 || r.body.duplicate === true);
  // A Shopify retry after the winner finished is a clean duplicate.
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload())).body.duplicate, true);
});

test("a stale sending claim is reclaimed and sent; a fresh one is not", async () => {
  let clock = 1_000_000;
  const store = new MemoryStore(() => clock);
  const { deps, sender } = setup({ store, now: () => clock, staleClaimMs: 60_000 });
  await store.claim({ kind: "order_confirmation", dedupeKey: String(ORDER_ID), orderId: String(ORDER_ID), staleAfterMs: 60_000 });
  const busy = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(busy.status, 503);
  assert.equal(busy.body.reason, "claim_in_progress");
  assert.equal(sender.sent.length, 0);
  clock += 61_000;
  const res = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(res.status, 200);
  assert.equal(sender.sent.length, 1);
  assert.equal(store.get("order_confirmation", String(ORDER_ID))!.attempts, 2);
});

test("transient send failure releases the claim, returns 503, and the retry sends with the same idempotency key", async () => {
  const sender = new FakeSender([{ ok: false, retryable: true, error: "resend_internal_server_error" }]);
  const { deps, store } = setup({ sender });
  const first = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(first.status, 503);
  assert.equal(store.get("order_confirmation", String(ORDER_ID))!.status, "failed");
  const second = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(second.status, 200);
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.attempts.length, 2);
  assert.equal(sender.attempts[0].idempotencyKey, sender.attempts[1].idempotencyKey);
  const row = store.get("order_confirmation", String(ORDER_ID))!;
  assert.equal(row.status, "sent");
  assert.equal(row.attempts, 2);
});

test("a hung Resend call is cut off inside the budget and retried later", async () => {
  const sender = new FakeSender(["hang"]);
  const { deps, store } = setup({ sender, budgetMs: 2500 });
  const started = Date.now();
  const res = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.ok(Date.now() - started < 3000);
  assert.equal(res.status, 503);
  assert.equal(store.get("order_confirmation", String(ORDER_ID))!.status, "failed");
});

test("a permanent Resend rejection is recorded and acknowledged (no endless retries)", async () => {
  const sender = new FakeSender([{ ok: false, retryable: false, error: "resend_validation_error" }]);
  const { deps, store } = setup({ sender });
  const res = await deliver(deps, "orders/paid", orderPaidPayload());
  assert.equal(res.status, 200);
  assert.equal(res.body.sent, false);
  assert.equal(store.get("order_confirmation", String(ORDER_ID))!.status, "failed");
});

test("an order without an email is skipped durably and never retried", async () => {
  const { deps, sender, store } = setup();
  const payload = orderPaidPayload({ email: null, contact_email: null, customer: null });
  assert.equal((await deliver(deps, "orders/paid", payload)).body.reason, "no_recipient");
  assert.equal(store.get("order_confirmation", String(ORDER_ID))!.status, "skipped");
  assert.equal((await deliver(deps, "orders/paid", payload)).body.duplicate, true);
  assert.equal(sender.sent.length, 0);
});

test("Shopify test orders still send and are flagged in logs", async () => {
  const { deps, sender, logs } = setup();
  await deliver(deps, "orders/paid", orderPaidPayload({ test: true }));
  assert.equal(sender.sent.length, 1);
  assert.ok(logs.some((l) => l.event === "test_order" && l.test === true));
});

test("logs never contain a full email address or the secret", async () => {
  const { deps, logs } = setup();
  await deliver(deps, "orders/paid", orderPaidPayload());
  await deliver(deps, "fulfillments/create", fulfillmentPayload());
  const text = JSON.stringify(logs);
  assert.ok(!text.includes("ava.morgan@example.com"));
  assert.ok(text.includes("a***@example.com"));
  assert.ok(!text.includes(SECRET));
});

test("fulfilment without tracking waits; the update that adds tracking sends; later tracking changes do not resend", async () => {
  const { deps, sender } = setup();
  await deliver(deps, "orders/paid", orderPaidPayload());
  const untracked = fulfillmentPayload({ tracking_company: null, tracking_number: null, tracking_numbers: [], tracking_url: null, tracking_urls: [] });
  const waiting = await deliver(deps, "fulfillments/create", untracked);
  assert.equal(waiting.status, 200);
  assert.equal(waiting.body.reason, "awaiting_tracking");
  assert.equal(sender.sent.length, 1); // only the confirmation
  const tracked = await deliver(deps, "fulfillments/update", fulfillmentPayload());
  assert.equal(tracked.body.sent, true);
  assert.equal(sender.sent.length, 2);
  const shipped = sender.sent[1];
  assert.equal(shipped.idempotencyKey, "shipped/5550000000001");
  assert.equal(shipped.subject, "Your IQON order #1042 is on its way");
  const changed = await deliver(deps, "fulfillments/update", fulfillmentPayload({ tracking_number: "1Z999AA10123456785", tracking_numbers: ["1Z999AA10123456785"] }));
  assert.equal(changed.body.duplicate, true);
  assert.equal(sender.sent.length, 2);
});

test("create and update for the same fulfilment arriving together send once", async () => {
  const { deps } = setup({ sender: new FakeSender([], 30) });
  await deliver(deps, "orders/paid", orderPaidPayload());
  await Promise.all([deliver(deps, "fulfillments/create", fulfillmentPayload()), deliver(deps, "fulfillments/update", fulfillmentPayload())]);
  const sent = (deps.sender as FakeSender).sent.filter((m) => m.idempotencyKey.startsWith("shipped/"));
  assert.equal(sent.length, 1);
});

test("cancelled, error, failure and pending fulfilments never send", async () => {
  const { deps, sender, store } = setup();
  for (const status of ["cancelled", "error", "failure", "pending"]) {
    const res = await deliver(deps, "fulfillments/update", fulfillmentPayload({ status }));
    assert.equal(res.status, 200);
    assert.equal(res.body.skipped, true);
  }
  assert.equal(sender.sent.length, 0);
  assert.equal(store.rows.size, 0);
});

test("partial fulfilment lists only its items and says the rest will follow; the final shipment does not", async () => {
  const { deps, sender } = setup();
  await deliver(deps, "orders/paid", orderPaidPayload());
  await deliver(deps, "fulfillments/create", partialFirst());
  await deliver(deps, "fulfillments/create", partialSecond());
  const [, first, second] = sender.sent;
  assert.equal(sender.sent.length, 3);
  assert.equal(first.subject, "Part of your IQON order #1042 is on its way");
  const firstText = visibleText(first.html);
  assert.ok(firstText.includes(MORE_TO_FOLLOW_COPY));
  assert.ok(firstText.includes("Creatine Monohydrate") && firstText.includes("Hydrolyzed Collagen Peptides"));
  assert.ok(!firstText.includes("NMN"));
  assert.equal(second.subject, "Your IQON order #1042 is on its way");
  const secondText = visibleText(second.html);
  assert.ok(!secondText.includes(MORE_TO_FOLLOW_COPY));
  assert.ok(secondText.includes("NMN") && !secondText.includes("Creatine Monohydrate"));
  // USPS without a carrier URL falls back to a universal tracking lookup.
  assert.ok(second.html.includes("https://parcelsapp.com/en/tracking/9400111899223197428490"));
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
});

test("shipping email reuses the stored snapshot (name, subscription label, images)", async () => {
  const { deps, sender } = setup();
  await deliver(deps, "orders/paid", orderPaidPayload());
  await deliver(deps, "fulfillments/create", fulfillmentPayload({ email: null }));
  const shipped = sender.sent[1];
  assert.equal(shipped.to, "ava.morgan@example.com");
  const text = visibleText(shipped.html);
  assert.ok(text.includes("Good news, Ava."));
  assert.ok(text.includes("Subscription: Delivered every 30 days, save 10%"));
  assert.ok(shipped.html.includes("https://www.iqonbody.com/images/email/products/creatine-monohydrate.jpg"));
});

test("shipping email with no recipient anywhere is skipped; with the Admin API it recovers the address", async () => {
  const bare = fulfillmentPayload({ email: null });
  const noAdmin = setup();
  const skipped = await deliver(noAdmin.deps, "fulfillments/create", bare);
  assert.equal(skipped.status, 200);
  assert.equal(skipped.body.reason, "no_recipient");
  assert.equal(noAdmin.sender.sent.length, 0);

  const withAdmin = setup({
    adminOrderLookup: async () => ({ name: "#1042", email: "ava.morgan@example.com", firstName: "Ava", shippingAddress: null, orderStatusUrl: null, lineItems: [] }),
  });
  const res = await deliver(withAdmin.deps, "fulfillments/create", bare);
  assert.equal(res.body.sent, true);
  assert.equal(withAdmin.sender.sent[0].to, "ava.morgan@example.com");
});

test("a failing Admin or Storefront lookup never blocks the email", async () => {
  const { deps, sender } = setup({
    adminOrderLookup: async () => { throw new Error("SHOPIFY_AUTH_FAILED"); },
    imageLookup: async () => { throw new Error("storefront down"); },
  });
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload())).status, 200);
  assert.equal(sender.sent.length, 1);
  assert.ok(sender.sent[0].html.includes("/images/email/products/nmn.jpg"));
});

test("a database outage before the claim returns 503 and sends nothing", async () => {
  const store = new MemoryStore();
  store.claim = async () => { throw new Error("connection refused"); };
  const { deps, sender } = setup({ store });
  assert.equal((await deliver(deps, "orders/paid", orderPaidPayload())).status, 503);
  assert.equal(sender.sent.length, 0);
});
