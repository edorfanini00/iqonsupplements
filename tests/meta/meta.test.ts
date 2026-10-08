import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  CAPI_TIMEOUT_MS, buildUserData, normalizeEmail, normalizeLetters, normalizePhone, normalizeZip, resetMissingTokenWarning, sendMetaEvents,
} from "../../lib/analytics/meta-capi";
import { handleRelay, sanitizeCustomData } from "../../lib/analytics/meta-relay";
import { DEFAULT_EVENT_SOURCE_URL, handleMetaPurchaseWebhook, mapOrderToPurchase, purchaseEventId } from "../../lib/analytics/meta-purchase";
import {
  DEFAULT_META_PIXEL_ID, META_CART_ATTRIBUTE_KEYS, isRelayEvent, mergeCartAttributes, metaCartAttributes, readCookie, readMetaAttributes, resolvePixelId, shopifyNumericId,
} from "../../lib/analytics/meta-shared";
import { contentId, createDedupe, isTrackedPath, newEventId, trackAddToCart, trackInitiateCheckout, trackViewContent } from "../../lib/analytics/meta";
import { ORDER_ID, SECRET, orderPaidPayload, renewalOrderPayload, sign, webhookHeaders } from "../orders/fixtures";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const FBP = "fb.1.1759876543210.1234567890";
const FBC = "fb.1.1759876543210.IwAR0synthetic_fbclid-123";
const TOKEN = "synthetic-capi-token";
const ENV = { META_CAPI_ACCESS_TOKEN: TOKEN };

type Call = { url: string; init: RequestInit };
function fakeFetch(response: () => Response | Promise<Response> = () => Response.json({ events_received: 1 })) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response();
  }) as typeof fetch;
  return { calls, fn };
}
const sentBody = (call: Call) => JSON.parse(String(call.init.body));

// ---------- hashing and normalisation ----------

test("emails, phones, names, zips are normalised the way Meta expects before hashing", () => {
  assert.equal(normalizeEmail("  Ava.Morgan@Example.COM "), "ava.morgan@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizePhone("(555) 555-0100"), "15555550100", "10 digit number gets the US country code");
  assert.equal(normalizePhone("+44 20 7946 0958"), "442079460958");
  assert.equal(normalizePhone("12"), null);
  assert.equal(normalizeLetters(" San Francisco "), "sanfrancisco");
  assert.equal(normalizeLetters("O'Brien-Smith"), "obriensmith");
  assert.equal(normalizeZip("94105-1234", "US"), "94105");
  assert.equal(normalizeZip("SW1A 1AA", "GB"), "sw1a1aa");
});

test("user_data hashes PII with SHA-256 and leaves browser ids, IP and UA raw", () => {
  const data = buildUserData({
    email: " Ava.Morgan@Example.com", phone: "555-555-0100", firstName: "Ava", lastName: "Morgan", city: "San Francisco", state: "CA", zip: "94105", country: "US",
    externalId: "7001", fbp: FBP, fbc: FBC, clientIpAddress: "203.0.113.9", clientUserAgent: "Synthetic UA",
  });
  assert.deepEqual(data.em, [sha("ava.morgan@example.com")]);
  assert.deepEqual(data.ph, [sha("15555550100")]);
  assert.deepEqual(data.fn, [sha("ava")]);
  assert.deepEqual(data.ln, [sha("morgan")]);
  assert.deepEqual(data.ct, [sha("sanfrancisco")]);
  assert.deepEqual(data.st, [sha("ca")]);
  assert.deepEqual(data.zp, [sha("94105")]);
  assert.deepEqual(data.country, [sha("us")]);
  assert.deepEqual(data.external_id, [sha("7001")]);
  assert.equal(data.fbp, FBP);
  assert.equal(data.fbc, FBC);
  assert.equal(data.client_ip_address, "203.0.113.9");
  assert.equal(data.client_user_agent, "Synthetic UA");
  const serialised = JSON.stringify(data);
  for (const plain of ["ava.morgan", "Morgan", "5550100", "94105", "San Francisco"]) assert.ok(!serialised.includes(plain), `${plain} leaked unhashed`);
});

test("empty and invalid PII fields are dropped, not hashed", () => {
  assert.deepEqual(buildUserData({ email: "", phone: "abc", firstName: "  ", state: "California", country: "USA" }), {});
});

// ---------- event_id and dedupe ----------

test("event ids are unique and match the relay's accepted shape", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newEventId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
});

test("dedupe guard drops a repeat of the same key inside the window only", () => {
  let t = 1000;
  const guard = createDedupe(700, () => t);
  assert.equal(guard("/products/a"), true);
  t += 100;
  assert.equal(guard("/products/a"), false, "strict mode double effect");
  assert.equal(guard("/products/b"), true, "different key fires");
  assert.equal(guard("/products/a"), true, "key changed in between");
  t += 800;
  assert.equal(guard("/products/a"), true, "window passed");
});

test("Purchase event_id is deterministic per order so webhook retries and the browser copy dedupe", () => {
  assert.equal(purchaseEventId("6123456789012"), "purchase_6123456789012");
  const a = mapOrderToPurchase(orderPaidPayload());
  const b = mapOrderToPurchase(orderPaidPayload());
  assert.equal(a?.eventId, `purchase_${ORDER_ID}`);
  assert.equal(a?.eventId, b?.eventId);
});

test("browser helpers send the same event_id to fbq and to the CAPI relay, with dedupe", async () => {
  const relayed: Record<string, unknown>[] = [];
  const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
  const originalFetch = g.fetch;
  g.window = { location: { href: "https://www.iqonbody.com/products/creatine-monohydrate" } };
  g.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    relayed.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    const first = trackViewContent({ routeKey: "/products/creatine-monohydrate", contentId: "8001", name: "Creatine", value: 39, currency: "USD" });
    const repeat = trackViewContent({ routeKey: "/products/creatine-monohydrate", contentId: "8001", name: "Creatine", value: 39, currency: "USD" });
    assert.ok(first);
    assert.equal(repeat, null, "second ViewContent within 700ms is dropped");
    const cart = trackAddToCart({ contentId: "8001", name: "Creatine", quantity: 2, unitPrice: 39, currency: "USD" });
    const checkout = trackInitiateCheckout({ items: [{ contentId: "8001", quantity: 2 }], value: 78, currency: "USD" });
    assert.equal(trackInitiateCheckout({ items: [{ contentId: "8001", quantity: 2 }], value: 78, currency: "USD" }), null, "double click on checkout");
    const fbq = (g.window as { fbq: { queue: unknown[][] } }).fbq;
    const queued = fbq.queue.map((args) => [...args]);
    assert.deepEqual(queued[0], ["init", DEFAULT_META_PIXEL_ID]);
    const tracked = queued.filter((args) => args[0] === "track");
    assert.deepEqual(tracked.map((args) => args[1]), ["ViewContent", "AddToCart", "InitiateCheckout"]);
    assert.deepEqual(tracked.map((args) => (args[3] as { eventID: string }).eventID), [first, cart, checkout]);
    assert.deepEqual(relayed.map((r) => [r.eventName, r.eventId]), [["ViewContent", first], ["AddToCart", cart], ["InitiateCheckout", checkout]]);
    assert.deepEqual(tracked[0][2], { content_ids: ["8001"], content_type: "product", content_name: "Creatine", value: 39, currency: "USD" });
    assert.equal((relayed[1].customData as { value: number }).value, 78);
    assert.equal(relayed[0].eventSourceUrl, "https://www.iqonbody.com/products/creatine-monohydrate");
  } finally {
    delete g.window;
    g.fetch = originalFetch;
  }
});

test("content ids are numeric Shopify variant ids, the same ids the Purchase webhook sends", () => {
  assert.equal(contentId("gid://shopify/ProductVariant/8001", "creatine-monohydrate"), "8001");
  assert.equal(contentId(undefined, "creatine-monohydrate"), "creatine-monohydrate", "preview catalog falls back to the handle");
  assert.equal(shopifyNumericId(8001), "8001");
  const purchase = mapOrderToPurchase(orderPaidPayload());
  assert.deepEqual(purchase?.customData?.content_ids, ["8001", "8002", "8003"]);
});

test("pixel id comes from NEXT_PUBLIC_META_PIXEL_ID, defaults to IQON Body Web, and can be switched off", () => {
  assert.equal(resolvePixelId(undefined), "1006368245818889");
  assert.equal(resolvePixelId(""), "1006368245818889");
  assert.equal(resolvePixelId("123456789012345"), "123456789012345");
  assert.equal(resolvePixelId("off"), null);
  assert.equal(resolvePixelId("<script>"), "1006368245818889");
  assert.equal(isTrackedPath("/"), true);
  assert.equal(isTrackedPath("/products/creatine-monohydrate"), true);
  assert.equal(isTrackedPath("/affiliates/dashboard"), false);
});

// ---------- relay allowlist ----------

function relayRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.iqonbody.com/api/meta/track", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.iqonbody.com",
      cookie: `_fbp=${FBP}; _fbc=${FBC}; iqon_shopify_cart=secret-cart`,
      "user-agent": "Synthetic UA",
      "x-forwarded-for": "198.51.100.7, 10.0.0.1",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("relay forwards allowlisted events with the browser's event_id and server read signals", async () => {
  for (const eventName of ["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]) {
    const { calls, fn } = fakeFetch();
    const result = await handleRelay(relayRequest({
      eventName, eventId: "0f8fad5b-d9cb-469f-a165-70867728950e", eventSourceUrl: "https://www.iqonbody.com/products/creatine-monohydrate#reviews",
      customData: { content_ids: ["8001"], content_type: "product", value: 39, currency: "USD", email: "leak@example.com" },
    }), { env: ENV, fetch: fn, log: () => {} });
    assert.equal(result.status, 202);
    assert.equal(calls.length, 1, eventName);
    assert.equal(calls[0].url, `https://graph.facebook.com/v24.0/${DEFAULT_META_PIXEL_ID}/events`);
    const body = sentBody(calls[0]);
    const [event] = body.data;
    assert.equal(event.event_name, eventName);
    assert.equal(event.event_id, "0f8fad5b-d9cb-469f-a165-70867728950e");
    assert.equal(event.action_source, "website");
    assert.equal(event.event_source_url, "https://www.iqonbody.com/products/creatine-monohydrate");
    assert.equal(event.user_data.fbp, FBP);
    assert.equal(event.user_data.fbc, FBC);
    assert.equal(event.user_data.client_ip_address, "198.51.100.7");
    assert.equal(event.user_data.client_user_agent, "Synthetic UA");
    assert.equal(event.user_data.em, undefined, "relay never takes PII from the browser");
    assert.equal(event.custom_data.email, undefined);
    assert.ok(!JSON.stringify(body).includes("secret-cart"));
    assert.equal(body.access_token, TOKEN);
    assert.ok(!calls[0].url.includes(TOKEN), "token stays out of the URL");
  }
});

test("relay rejects Purchase, unknown events, bad ids, bad JSON, oversize bodies and cross site posts without calling Meta", async () => {
  const { calls, fn } = fakeFetch();
  const deps = { env: ENV, fetch: fn, log: () => {} };
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  for (const body of [{ eventName: "Purchase", eventId: id }, { eventName: "Lead", eventId: id }, { eventName: "toString", eventId: id }, { eventName: "PageView", eventId: "x" }, { eventName: "PageView" }, "not json", "[]"]) {
    const result = await handleRelay(relayRequest(body), deps);
    assert.equal(result.status, 204, JSON.stringify(body));
  }
  assert.equal((await handleRelay(relayRequest({ eventName: "PageView", eventId: id }, { origin: "https://evil.example" }), deps)).status, 403);
  const scripted = relayRequest({ eventName: "PageView", eventId: id });
  scripted.headers.delete("origin");
  assert.equal((await handleRelay(scripted, deps)).status, 403, "no Origin: not a browser on our pages");
  assert.equal((await handleRelay(relayRequest({ eventName: "PageView", eventId: id, pad: "x".repeat(5000) }), deps)).status, 413);
  assert.equal(calls.length, 0);
  assert.equal(isRelayEvent("Purchase"), false);
});

test("relay drops event source URLs from other sites and sanitises custom_data", async () => {
  const { calls, fn } = fakeFetch();
  await handleRelay(relayRequest({ eventName: "PageView", eventId: "0f8fad5b-d9cb-469f-a165-70867728950e", eventSourceUrl: "https://evil.example/x" }, { referer: "https://www.iqonbody.com/" }), { env: ENV, fetch: fn, log: () => {} });
  assert.equal(sentBody(calls[0]).data[0].event_source_url, "https://www.iqonbody.com/");
  assert.deepEqual(sanitizeCustomData({ value: "39", currency: "usd", content_ids: ["8001", { x: 1 }, "<b>"], content_type: "other", num_items: 2.5, contents: [{ id: "8001", quantity: 2, item_price: 39.004 }, { id: 5 }] }), {
    content_ids: ["8001"], contents: [{ id: "8001", quantity: 2, item_price: 39 }],
  });
  assert.equal(sanitizeCustomData("x"), undefined);
});

// ---------- missing token, failures, timeout ----------

test("missing token: no network call, logs once, returns skipped", async () => {
  resetMissingTokenWarning();
  const logs: string[] = [];
  const { calls, fn } = fakeFetch();
  const event = { eventName: "PageView", eventId: "abcdefgh1", user: {} };
  const first = await sendMetaEvents([event], { env: {}, fetch: fn, log: (m) => logs.push(m) });
  const second = await sendMetaEvents([event], { env: { META_CAPI_ACCESS_TOKEN: "  " }, fetch: fn, log: (m) => logs.push(m) });
  assert.deepEqual(first, { ok: false, skipped: "missing_token" });
  assert.deepEqual(second, { ok: false, skipped: "missing_token" });
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /META_CAPI_ACCESS_TOKEN/);
  const relay = await handleRelay(relayRequest({ eventName: "PageView", eventId: "0f8fad5b-d9cb-469f-a165-70867728950e" }), { env: {}, fetch: fn, log: () => {} });
  assert.deepEqual(relay, { status: 202, body: { ok: false, skipped: "missing_token" } });
});

test("pixel switched off: nothing is sent even with a token", async () => {
  const { calls, fn } = fakeFetch();
  const result = await sendMetaEvents([{ eventName: "PageView", eventId: "abcdefgh1", user: {} }], { env: { ...ENV, NEXT_PUBLIC_META_PIXEL_ID: "off" }, fetch: fn });
  assert.deepEqual(result, { ok: false, skipped: "disabled" });
  assert.equal(calls.length, 0);
});

test("sendMetaEvents never throws: network error, Meta 400 and a hung request all resolve", async () => {
  const event = { eventName: "PageView", eventId: "abcdefgh1", user: {} };
  const logs: Record<string, unknown>[] = [];
  const log = (_m: string, d?: Record<string, unknown>) => logs.push(d ?? {});
  const boom = await sendMetaEvents([event], { env: ENV, log, fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
  assert.equal(boom.ok, false);
  const rejected = await sendMetaEvents([event], { env: ENV, log, fetch: fakeFetch(() => new Response(`{"error":{"message":"Invalid token ${TOKEN}"}}`, { status: 400 })).fn });
  assert.equal(rejected.status, 400);
  assert.ok(!JSON.stringify(logs).includes(TOKEN), "token never logged");
  const started = Date.now();
  // AbortSignal.timeout's timer is unref'd; a live server keeps the loop running, the test has to.
  const keepAlive = setInterval(() => {}, 1000);
  const hung = await sendMetaEvents([event], {
    env: ENV, log, timeoutMs: 50,
    fetch: ((_u: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as unknown as typeof fetch,
  });
  clearInterval(keepAlive);
  assert.equal(hung.ok, false);
  assert.match(hung.error ?? "", /TimeoutError/);
  assert.ok(Date.now() - started < 1000);
  assert.equal(CAPI_TIMEOUT_MS, 3500);
  const throwingLog = await sendMetaEvents([event], { env: ENV, log: () => { throw new Error("log down"); }, fetch: (async () => { throw new Error("x"); }) as typeof fetch });
  assert.equal(throwingLog.ok, false);
});

test("test event code is passed through only when configured", async () => {
  const { calls, fn } = fakeFetch();
  await sendMetaEvents([{ eventName: "PageView", eventId: "abcdefgh1", user: {} }], { env: { ...ENV, META_CAPI_TEST_EVENT_CODE: "TEST123" }, fetch: fn });
  await sendMetaEvents([{ eventName: "PageView", eventId: "abcdefgh1", user: {} }], { env: ENV, fetch: fn });
  assert.equal(sentBody(calls[0]).test_event_code, "TEST123");
  assert.equal(sentBody(calls[1]).test_event_code, undefined);
});

// ---------- cart attributes round trip ----------

test("fbp/fbc and event source URL survive cart attributes -> order note_attributes -> Purchase", () => {
  const attributes = metaCartAttributes({ fbp: FBP, fbc: FBC, eventSourceUrl: "https://www.iqonbody.com/products/creatine-monohydrate" });
  assert.deepEqual(attributes.map((a) => a.key), ["_fbp", "_fbc", "_event_source_url"]);
  assert.ok(attributes.every((a) => a.key.startsWith("_")), "hidden from the buyer at checkout");
  // Shopify copies cart attributes {key, value} to the order as note_attributes {name, value}.
  const noteAttributes = [{ name: "gift_note", value: "hello" }, ...attributes.map((a) => ({ name: a.key, value: a.value }))];
  assert.deepEqual(readMetaAttributes(noteAttributes), { fbp: FBP, fbc: FBC, eventSourceUrl: "https://www.iqonbody.com/products/creatine-monohydrate" });
  assert.deepEqual(readMetaAttributes(attributes), { fbp: FBP, fbc: FBC, eventSourceUrl: "https://www.iqonbody.com/products/creatine-monohydrate" });
  const purchase = mapOrderToPurchase(orderPaidPayload({ note_attributes: noteAttributes }));
  assert.equal(purchase?.user.fbp, FBP);
  assert.equal(purchase?.user.fbc, FBC);
  assert.equal(purchase?.eventSourceUrl, "https://www.iqonbody.com/products/creatine-monohydrate");
});

test("invalid cookie values are not written, and other apps' attributes are kept on merge", () => {
  assert.deepEqual(metaCartAttributes({ fbp: "garbage", fbc: "fb.1.x.y", eventSourceUrl: null }), []);
  assert.deepEqual(readMetaAttributes([{ name: "_fbp", value: "evil" }, { name: "_event_source_url", value: "javascript:alert(1)" }]), { fbp: null, fbc: null, eventSourceUrl: null });
  assert.deepEqual(readMetaAttributes(null), { fbp: null, fbc: null, eventSourceUrl: null });
  const ours = metaCartAttributes({ fbp: FBP, fbc: null, eventSourceUrl: "https://www.iqonbody.com/" });
  const merged = mergeCartAttributes([{ key: "ref", value: "creator1" }, { key: META_CART_ATTRIBUTE_KEYS.fbp, value: "fb.1.1700000000000.1" }], ours);
  assert.deepEqual(merged, [{ key: "ref", value: "creator1" }, ...ours]);
  assert.equal(mergeCartAttributes(merged, ours), null, "unchanged: no extra Shopify write");
  assert.deepEqual(mergeCartAttributes([{ key: "other_app", value: null }], ours), [{ key: "other_app", value: "" }, ...ours], "null valued attributes are kept, not wiped");
  assert.equal(mergeCartAttributes([], []), null);
  assert.equal(readCookie("a=1; _fbp=" + FBP + "; b=2", "_fbp"), FBP);
  assert.equal(readCookie("x_fbp=1", "_fbp"), null);
});

// ---------- Purchase mapping ----------

test("Purchase payload maps a synthetic Shopify order: value, currency, contents, hashed PII, client signals", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const event = mapOrderToPurchase(orderPaidPayload({
    processed_at: "2026-10-07T11:58:00Z",
    phone: null,
    client_details: { user_agent: "Mozilla/5.0 Synthetic", browser_ip: "203.0.113.9" },
    note_attributes: [{ name: "_fbp", value: FBP }],
  }), now)!;
  assert.equal(event.eventName, "Purchase");
  assert.equal(event.eventId, `purchase_${ORDER_ID}`);
  assert.equal(event.eventTime, Math.floor(Date.parse("2026-10-07T11:58:00Z") / 1000));
  assert.equal(event.eventSourceUrl, DEFAULT_EVENT_SOURCE_URL);
  assert.deepEqual(event.customData, {
    value: 132.03, currency: "USD", content_type: "product", content_ids: ["8001", "8002", "8003"],
    contents: [{ id: "8001", quantity: 1, item_price: 39 }, { id: "8002", quantity: 2, item_price: 34 }, { id: "8003", quantity: 1, item_price: 36 }],
    num_items: 4, order_id: String(ORDER_ID),
  });
  const user = buildUserData(event.user);
  assert.deepEqual(user.em, [sha("ava.morgan@example.com")]);
  assert.deepEqual(user.ph, [sha("15555550100")], "billing phone used when the order has none");
  assert.deepEqual(user.fn, [sha("ava")]);
  assert.deepEqual(user.zp, [sha("94105")]);
  assert.deepEqual(user.st, [sha("ca")]);
  assert.deepEqual(user.country, [sha("us")]);
  assert.deepEqual(user.external_id, [sha("7001")]);
  assert.equal(user.client_ip_address, "203.0.113.9");
  assert.equal(user.client_user_agent, "Mozilla/5.0 Synthetic");
  assert.equal(user.fbp, FBP);
  assert.equal(user.fbc, undefined);
});

test("Purchase mapping: refunded quantities, gid ids, stale timestamps and junk input", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const base = orderPaidPayload();
  const edited = mapOrderToPurchase({ ...base, id: undefined, admin_graphql_api_id: `gid://shopify/Order/${ORDER_ID}`, created_at: "2026-09-01T00:00:00Z", line_items: [{ ...base.line_items[1], current_quantity: 1 }, { ...base.line_items[2], current_quantity: 0 }] }, now)!;
  assert.equal(edited.eventId, `purchase_${ORDER_ID}`);
  assert.deepEqual(edited.customData?.contents, [{ id: "8002", quantity: 1, item_price: 34 }]);
  assert.equal(edited.eventTime, Math.floor(now / 1000), "older than 7 days: sent as now so Meta accepts it");
  assert.equal(edited.actionSource, "other", "no client_details: not a website event (Meta needs a user agent)");
  assert.equal(mapOrderToPurchase(orderPaidPayload({ client_details: { user_agent: "UA" } }))?.actionSource, "website");
  assert.equal(mapOrderToPurchase(null), null);
  assert.equal(mapOrderToPurchase({ id: "abc" }), null);
  assert.equal(mapOrderToPurchase([1, 2]), null);
});

// ---------- webhook ----------

function deliver(payload: unknown, opts: { topic?: string; headers?: Record<string, string | null>; env?: Record<string, string | undefined>; fetch?: typeof fetch } = {}) {
  const body = JSON.stringify(payload);
  const { calls, fn } = fakeFetch();
  const logs: Record<string, unknown>[] = [];
  const result = handleMetaPurchaseWebhook(body, webhookHeaders(opts.topic ?? "orders/paid", body, opts.headers ?? {}), {
    env: opts.env ?? { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET, ...ENV }, fetch: opts.fetch ?? fn, info: (e) => logs.push(e), log: () => {},
  });
  return { result, calls, logs };
}

test("webhook HMAC: valid signature sends one Purchase to Meta", async () => {
  const { result, calls, logs } = deliver(orderPaidPayload({ note_attributes: [{ name: "_fbc", value: FBC }] }));
  assert.deepEqual(await result, { status: 200, body: { ok: true, sent: true, eventId: `purchase_${ORDER_ID}` } });
  assert.equal(calls.length, 1);
  const [event] = sentBody(calls[0]).data;
  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, `purchase_${ORDER_ID}`);
  assert.equal(event.user_data.fbc, FBC);
  assert.equal(event.custom_data.value, 132.03);
  assert.ok(!JSON.stringify(logs).includes("ava.morgan"), "no PII in logs");
});

test("webhook HMAC: invalid, missing, or signed with another secret is rejected before any Meta call", async () => {
  const payload = orderPaidPayload();
  for (const headers of [{ "x-shopify-hmac-sha256": "bm90LXRoZS1zaWduYXR1cmU=" }, { "x-shopify-hmac-sha256": null }, { "x-shopify-hmac-sha256": sign(JSON.stringify(payload), "other-secret") }]) {
    const { result, calls } = deliver(payload, { headers });
    assert.deepEqual(await result, { status: 401, body: { ok: false, reason: "invalid_signature" } });
    assert.equal(calls.length, 0);
  }
  const tampered = JSON.stringify(payload);
  const headers = webhookHeaders("orders/paid", tampered);
  const r = await handleMetaPurchaseWebhook(tampered.replace("132.03", "1.00"), headers, { env: { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET, ...ENV }, info: () => {} });
  assert.equal(r.status, 401, "body changed after signing");
});

test("webhook: wrong shop 401, missing secret 503, other topics acknowledged, bad JSON 400", async () => {
  assert.equal((await deliver(orderPaidPayload(), { headers: { "x-shopify-shop-domain": "other.myshopify.com" } }).result).status, 401);
  const missing = deliver(orderPaidPayload(), { env: ENV });
  assert.deepEqual(await missing.result, { status: 503, body: { ok: false, retry: true, reason: "not_configured" } });
  const other = deliver(orderPaidPayload(), { topic: "orders/create" });
  assert.deepEqual(await other.result, { status: 200, body: { ok: true, ignored: true, reason: "unsupported_topic" } });
  assert.equal(other.calls.length, 0);
  const raw = "{not json";
  const bad = await handleMetaPurchaseWebhook(raw, webhookHeaders("orders/paid", raw), { env: { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET }, info: () => {} });
  assert.equal(bad.status, 400);
});

test("webhook skips test orders and subscription renewals, and no-ops without a token", async () => {
  const testOrder = deliver(orderPaidPayload({ test: true }));
  assert.deepEqual(await testOrder.result, { status: 200, body: { ok: true, skipped: "test_order" } });
  assert.equal(testOrder.calls.length, 0);
  const withCode = deliver(orderPaidPayload({ test: true }), { env: { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET, ...ENV, META_CAPI_TEST_EVENT_CODE: "TEST1" } });
  assert.equal((await withCode.result).status, 200);
  assert.equal(withCode.calls.length, 1, "test orders go to Meta Test events when a test code is set");
  const renewal = deliver(renewalOrderPayload());
  assert.deepEqual(await renewal.result, { status: 200, body: { ok: true, skipped: "subscription_renewal" } });
  assert.equal(renewal.calls.length, 0);
  const noToken = deliver(orderPaidPayload(), { env: { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET } });
  assert.deepEqual(await noToken.result, { status: 200, body: { ok: true, skipped: "missing_token" } });
  assert.equal(noToken.calls.length, 0);
});

test("webhook asks Shopify to retry only when Meta is unreachable or 5xx/429", async () => {
  const down = deliver(orderPaidPayload(), { fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
  assert.equal((await down.result).status, 503);
  const fiveHundred = deliver(orderPaidPayload(), { fetch: fakeFetch(() => new Response("", { status: 500 })).fn });
  assert.equal((await fiveHundred.result).status, 503);
  const rejected = deliver(orderPaidPayload(), { fetch: fakeFetch(() => new Response("{}", { status: 400 })).fn });
  assert.deepEqual(await rejected.result, { status: 200, body: { ok: false, reason: "meta_rejected" } });
});

test("the Meta webhook route cannot send email: no Resend, sender, ledger or Prisma imports", () => {
  for (const file of ["../../app/api/webhooks/shopify/meta-purchase/route.ts", "../../lib/analytics/meta-purchase.ts", "../../lib/analytics/meta-capi.ts", "../../lib/analytics/meta-shared.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const path of imports) assert.ok(!/resend|sender|store|prisma|emails/.test(path), `${file} imports ${path}`);
  }
  const route = readFileSync(new URL("../../app/api/webhooks/shopify/meta-purchase/route.ts", import.meta.url), "utf8");
  assert.ok(!route.includes("handleShopifyOrderWebhook"));
});
