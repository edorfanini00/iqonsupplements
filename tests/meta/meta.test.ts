import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { createHmac, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runInNewContext } from "node:vm";
import { handleRelay, sanitizeCustomData } from "../../lib/analytics/meta-relay";
import { readLimitedBody, verifyShopifyHmac, SUPPLEMENTS_SHOP } from "../../lib/analytics/meta-security";
import { handleMetaPurchaseWebhook, mapOrderToPurchase } from "../../lib/analytics/meta-purchase";
import { buildUserData, sendMetaEvents, normalizeEmail, normalizePhone, normalizeLetters, normalizeZip, resetMissingTokenWarning } from "../../lib/analytics/meta-capi";
import { META_CONSENT_GRANTED, metaCartAttributes, mergeCartAttributes, readMetaAttributes, validEventSourceUrl } from "../../lib/analytics/meta-shared";
import { trackPageView, trackAddToCart, createDedupe, newEventId } from "../../lib/analytics/meta";
import { advertisingConsent, setAdvertisingConsent } from "../../lib/analytics/meta-consent";
const SECRET = "synthetic-signing-secret";
const NOW = Date.parse("2026-10-08T12:00:00Z");
const ENV = { META_SHOPIFY_WEBHOOK_SECRET: SECRET, META_CAPI_ACCESS_TOKEN: "synthetic-token", META_CAPI_TEST_EVENT_CODE: "TEST-SYNTHETIC" };
const consent = [{ name: "_meta_consent", value: META_CONSENT_GRANTED }, { name: "_meta_test_fixture", value: "synthetic-v1" }];
const fixture = (overrides: Record<string, unknown> = {}) => ({ id: 6123456789012, test: true, source_name: "web", created_at: "2026-10-08T11:00:00Z", currency: "USD", total_price: "1.00", line_items: [{ variant_id: 8001, quantity: 1, price: "1.00" }], note_attributes: consent, ...overrides });
function headers(raw: string) { return new Headers({ "x-shopify-topic": "orders/paid", "x-shopify-shop-domain": SUPPLEMENTS_SHOP, "x-shopify-hmac-sha256": createHmac("sha256", SECRET).update(raw).digest("base64") }); }
async function deliver(payload: unknown, env = ENV, status = 200) {
  const raw = JSON.stringify(payload); const calls: Record<string, unknown>[] = [];
  const result = await handleMetaPurchaseWebhook(raw, headers(raw), { env, now: () => NOW, info: () => {}, log: () => {}, fetch: (async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return Response.json({ events_received: status === 200 ? 1 : 0 }, { status }); }) as typeof fetch });
  return { result, calls };
}
test("signed synthetic fixture is test mode only, fixed ID/time and minimized", async () => {
  const { result, calls } = await deliver(fixture({ email: "must-not-leak@example.invalid", browser_ip: "192.0.2.1", note_attributes: [...consent, { name: "_fbp", value: "fb.1.1759876543210.1234" }] }));
  assert.equal(result.body.sent, true); assert.equal(calls.length, 1);
  assert.equal(calls[0].test_event_code, "TEST-SYNTHETIC");
  const event = (calls[0].data as Record<string, unknown>[])[0];
  assert.equal(event.event_id, "purchase_6123456789012"); assert.equal(event.event_time, NOW / 1000 - 3600);
  assert.deepEqual(event.user_data, { client_user_agent: "IQON synthetic tracking verification", em: [sha("tracking-verification@example.invalid")], external_id: [sha("iqon-tracking-synthetic-v1")] });
  assert.ok(!JSON.stringify(calls).includes("tracking-verification@example.invalid"), "synthetic email is hashed");
  assert.ok(!JSON.stringify(calls).includes("must-not-leak"));
});
test("production orders and unapproved variants cannot use test bypass", async () => {
  for (const order of [fixture({ test: false }), fixture({ note_attributes: [consent[0]] }), fixture({ line_items: [{ variant_id: "diabetes-support", quantity: 1 }] })]) {
    const { calls, result } = await deliver(order); assert.equal(calls.length, 0); assert.equal(result.body.skipped, "health_eligibility_unverified");
  }
  const { calls, result } = await deliver(fixture(), { ...ENV, META_CAPI_TEST_EVENT_CODE: "" }); assert.equal(calls.length, 0); assert.equal(result.body.skipped, "test_order");
});
test("missing, denied or withdrawn advertising consent skips even signed fixtures", async () => {
  for (const note_attributes of [undefined, [], [{ name: "_meta_consent", value: "denied" }]]) {
    const { calls, result } = await deliver(fixture({ note_attributes })); assert.equal(calls.length, 0); assert.equal(result.body.skipped, "advertising_consent_required");
  }
  const raw = JSON.stringify(fixture()); const h = headers(raw); h.set("sec-gpc", "1");
  const result = await handleMetaPurchaseWebhook(raw, h, { env: ENV, now: () => NOW, info: () => {}, send: async () => { throw Error("must not send"); } });
  assert.equal(result.body.skipped, "advertising_consent_required");
});
test("stale, missing, invalid and future dates never become now; replay bounded to 24h", async () => {
  for (const created_at of [undefined, "bad", "2020-01-01", "2026-10-09", "2026-10-07T11:59:59Z"]) {
    assert.equal(mapOrderToPurchase(fixture({ created_at }), NOW), null);
    const { result, calls } = await deliver(fixture({ created_at })); assert.equal(calls.length, 0); assert.equal(result.body.skipped, "invalid_or_stale_event");
  }
  const first = mapOrderToPurchase(fixture(), NOW)!; const retry = mapOrderToPurchase(fixture(), NOW + 3600000)!;
  assert.equal(first.eventId, retry.eventId); assert.equal(first.eventTime, retry.eventTime);
});
test("renewals are excluded in test mode", async () => {
  for (const overrides of [{ source_name: "subscription_contract_checkout_one" }, { tags: "Subscription Recurring Order" }]) {
    const { result, calls } = await deliver(fixture(overrides)); assert.equal(result.body.skipped, "subscription_renewal"); assert.equal(calls.length, 0);
  }
});
test("raw HMAC checks bytes, wrong length/signature/shop and invalid JSON", async () => {
  const raw = JSON.stringify(fixture()); const h = headers(raw);
  assert.equal(verifyShopifyHmac(Buffer.from(raw), h.get("x-shopify-hmac-sha256"), SECRET), true);
  for (const signature of [null, "x", "A".repeat(44), h.get("x-shopify-hmac-sha256")! + "junk"]) assert.equal(verifyShopifyHmac(Buffer.from(raw), signature, SECRET), false);
  assert.equal(verifyShopifyHmac(Buffer.from(raw + " "), h.get("x-shopify-hmac-sha256"), SECRET), false);
  const deps = { env: ENV, info: () => {} };
  assert.equal((await handleMetaPurchaseWebhook(raw + " ", h, deps)).status, 401);
  h.set("x-shopify-shop-domain", "foreign.myshopify.com"); assert.equal((await handleMetaPurchaseWebhook(raw, h, deps)).status, 401);
  assert.equal((await handleMetaPurchaseWebhook("bad", headers("bad"), deps)).status, 400);
});
test("Meta transient responses retry with unchanged test identity; permanent failure acknowledged", async () => {
  for (const status of [429, 500, 503]) assert.equal((await deliver(fixture(), ENV, status)).result.status, 503);
  assert.equal((await deliver(fixture(), ENV, 400)).result.body.reason, "meta_rejected");
  assert.equal((await deliver(fixture(), ENV, 200)).result.body.sent, true);
});
test("webhook waits for transport completion", async () => {
  let finish!: () => void; let done = false;
  const raw = JSON.stringify(fixture());
  const pending = handleMetaPurchaseWebhook(raw, headers(raw), { env: ENV, now: () => NOW, info: () => {}, send: () => new Promise(resolve => { finish = () => resolve({ ok: true }); }) }).then(value => { done = true; return value; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(done, false); finish(); assert.equal((await pending).body.sent, true);
});
function relay(body: string, extra: Record<string, string> = {}) { return new Request("https://www.iqonbody.com/api/meta/track", { method: "POST", headers: { origin: "https://www.iqonbody.com", ...extra }, body }); }
test("spoofed Origin, 100 replays, consent and enable env cannot activate relay", async () => {
  let sent = 0;
  for (let i = 0; i < 100; i++) {
    const result = await handleRelay(relay(JSON.stringify({ eventName: "PageView", eventId: "abcdefgh123" }), { cookie: "iqon_ad_consent=granted-v1", "sec-gpc": "1" }), { env: { ...ENV, META_RELAY_ENABLED: "true" }, fetch: (async () => { sent++; return Response.json({}); }) as typeof fetch });
    assert.equal(result.body?.skipped, "relay_controls_unverified");
  }
  assert.equal(sent, 0); assert.equal((await handleRelay(relay("{}", { origin: "https://evil.invalid" }))).status, 403);
});
test("streaming UTF-8 byte caps, dishonest length, stream errors and total read deadline", async () => {
  assert.equal((await handleRelay(relay(JSON.stringify({ pad: "é".repeat(2200) })))).status, 413);
  assert.equal((await readLimitedBody(relay("x".repeat(20), { "content-length": "1" }), 10)).ok, false);
  let cancelled = false;
  const slow = new Request("https://example.invalid", { method: "POST", body: new ReadableStream({ cancel() { cancelled = true; } }), duplex: "half" } as RequestInit);
  const result = await readLimitedBody(slow, 100, 20); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.status, 408); assert.equal(cancelled, true);
  const broken = new Request("https://example.invalid", { method: "POST", body: new ReadableStream({ start(c) { c.error(Error("secret")); } }), duplex: "half" } as RequestInit);
  assert.deepEqual(await readLimitedBody(broken), { ok: false, status: 400, reason: "invalid_body" });
});
test("no freeform names or health IDs; unapproved URLs fail closed", () => {
  assert.deepEqual(sanitizeCustomData({ content_name: "diagnosis", content_ids: ["diabetes", "8001"], contents: [{ id: "health-condition" }] }), { content_ids: ["8001"] });
  for (const value of ["https://www.iqonbody.com/products/diabetes?email=x", "https://evil.invalid/", "https://user:pass@www.iqonbody.com/"]) assert.equal(validEventSourceUrl(value, ["www.iqonbody.com"]), null);
});
test("absent/withdrawn consent clears IDs and grants, preserves unrelated cart attributes", () => {
  const denied = metaCartAttributes({ fbp: "fb.1.1759876543210.1234", fbc: null, eventSourceUrl: null });
  assert.ok(denied.some(a => a.key === "_meta_consent" && a.value === "denied"));
  assert.equal(denied.find(a => a.key === "_fbp")?.value, "");
  const existing = [{ key: "gift", value: "kept" }, { key: "_meta_consent", value: META_CONSENT_GRANTED }, { key: "_fbp", value: "old" }];
  assert.deepEqual(mergeCartAttributes(existing, denied), [existing[0], ...denied]);
  assert.deepEqual(readMetaAttributes(existing.filter(a => a.key !== "_meta_consent")), { consent: "denied", fbp: null, fbc: null, eventSourceUrl: null });
});
test("browser no consent, GPC and unapproved paths cannot load/send; withdrawal revokes", t => {
  const calls: unknown[][] = [];
  t.mock.method(globalThis, "fetch", (async () => { throw Error("must not send"); }) as typeof fetch);
  const old = Object.getOwnPropertyDescriptors(globalThis);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "https://www.iqonbody.com/products/diabetes?private=1" }, fbq: (...args: unknown[]) => calls.push(args), dispatchEvent() {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "" } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: false } });
  t.after(() => { for (const key of ["window", "document", "navigator"]) { if (old[key]) Object.defineProperty(globalThis, key, old[key]); else Reflect.deleteProperty(globalThis, key); } });
  assert.equal(advertisingConsent(), false); assert.equal(trackPageView("/"), null);
  document.cookie = "iqon_ad_consent=granted-v1"; assert.equal(advertisingConsent(), true);
  assert.equal(trackAddToCart({ contentId: "8001", quantity: 1, unitPrice: 1, currency: "USD" }), null);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: true } }); assert.equal(advertisingConsent(), false);
  setAdvertisingConsent(false); assert.deepEqual(calls, [["consent", "revoke"]]);
});
test("error logs and results never echo thrown or HTTP upstream data", async () => {
  const logs: unknown[] = []; const event = { eventName: "PageView", eventId: "abcdefgh123", user: {} };
  for (const fetcher of [(async () => { throw Error("synthetic-token customer@example.invalid"); }), (async () => new Response("synthetic-token customer@example.invalid", { status: 400 }))]) {
    const result = await sendMetaEvents([event], { env: ENV, fetch: fetcher as typeof fetch, log: (m, d) => logs.push([m, d]) });
    assert.ok(!JSON.stringify([result, logs]).includes("synthetic-token")); assert.ok(!JSON.stringify([result, logs]).includes("customer@example"));
  }
  assert.deepEqual(buildUserData({ email: "" }), {});
});
test("transport abort is awaited and never leaks exception text", async () => {
  const keep = setInterval(() => {}, 1000);
  try { const result = await sendMetaEvents([{ eventName: "PageView", eventId: "abcdefgh123", user: {} }], { env: ENV, timeoutMs: 20, log: () => {}, fetch: ((_url, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(Error("secret"))))) as typeof fetch }); assert.equal(result.error, "meta_transport_error"); }
  finally { clearInterval(keep); }
});
test("actual tracking transitive runtime graph contains no order/email/admin/fulfillment dependencies", () => {
  const seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return; seen.add(file);
    assert.ok(!/\/orders\/|\/emails\/|\/affiliates\/|prisma|fulfillment/.test(file), file);
    const source = readFileSync(file, "utf8");
    for (const [, dependency] of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      if (dependency.startsWith("node:")) continue;
      assert.ok(dependency.startsWith(".") || dependency.startsWith("@/"), dependency);
      const base = dependency.startsWith("@/") ? resolve(dependency.slice(2)) : resolve(dirname(file), dependency);
      const target = [base, base + ".ts", base + ".tsx"].find(existsSync); assert.ok(target, dependency); visit(target);
    }
  }
  visit(resolve("app/api/webhooks/shopify/meta-purchase/route.ts")); assert.ok(seen.size >= 5);
});
test("Shopify snippet handles missing/denied/withdrawn privacy with no SDK or event", () => {
  let privacyListener: (event: unknown) => void = () => {}; let checkoutListener: (event: unknown) => void = () => {}; const calls: unknown[][] = [];
  runInNewContext(readFileSync("docs/tracking/shopify-meta-purchase.js", "utf8"), { init: { customerPrivacy: { marketingAllowed: true, saleOfDataAllowed: true } }, api: { customerPrivacy: { subscribe(_name: string, fn: typeof privacyListener) { privacyListener = fn; } } }, analytics: { subscribe(_name: string, fn: typeof checkoutListener) { checkoutListener = fn; } }, navigator: {}, window: { fbq: (...args: unknown[]) => calls.push(args) } });
  checkoutListener({ data: { checkout: { order: { id: "12345" }, lineItems: [{ variant: { id: "8001" } }] } } }); assert.equal(calls.length, 0);
  privacyListener({ customerPrivacy: { marketingAllowed: false, saleOfDataAllowed: false } }); assert.deepEqual(calls, [["consent", "revoke"]]);
  checkoutListener({}); assert.equal(calls.length, 1);
});
test("dedicated webhook key has no fallback to the existing order/email credential", async () => {
  const raw=JSON.stringify(fixture());
  const result=await handleMetaPurchaseWebhook(raw,headers(raw),{env:{SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET:SECRET,META_CAPI_TEST_EVENT_CODE:"TEST"},info:()=>{}});
  assert.equal(result.status,503); assert.equal(result.body.reason,"not_configured");
});
test("synthetic lane omits health freeform fields and hostile source URL", async () => {
  const {calls}=await deliver(fixture({ note_attributes:[...consent,{name:"_event_source_url",value:"https://evil.invalid/products/diabetes?email=private@example.invalid"}], line_items:[{variant_id:8001,quantity:1,price:"1.00",name:"my diabetes diagnosis",title:"health signal"}], customer:{email:"private@example.invalid"} }));
  assert.equal(calls.length,1);
  const text=JSON.stringify(calls); for(const value of ["diabetes","private@example","evil.invalid","health signal","/products/"]) assert.ok(!text.includes(value),value);
});

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const FBP="fb.1.1759876543210.1234567890";
const FBC="fb.1.1759876543210.IwAR0synthetic_fbclid-123";
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

test("pixel off and missing CAPI token cannot send; missing token logs once", async () => {
  resetMissingTokenWarning(); let calls=0; let warnings=0;
  const event={eventName:"PageView",eventId:"abcdefgh123",user:{}};
  const deps={fetch:(async()=>{calls++;return Response.json({});}) as typeof fetch,log:()=>{warnings++;}};
  assert.equal((await sendMetaEvents([event],{...deps,env:{}})).skipped,"missing_token");
  assert.equal((await sendMetaEvents([event],{...deps,env:{}})).skipped,"missing_token");
  assert.equal(warnings,1);
  assert.equal((await sendMetaEvents([event],{...deps,env:{...ENV,NEXT_PUBLIC_META_PIXEL_ID:"off"}})).skipped,"disabled"); assert.equal(calls,0);
});
test("actual preferences component produces no shopper UI with no approved paths", () => {
  const output=ts.transpileModule(readFileSync("app/meta-pixel.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports: Record<string,()=>unknown>={};
  const mocks:Record<string,unknown>={
    "react/jsx-runtime":{jsx:()=>{throw Error("inert UI rendered");},jsxs:()=>{throw Error("inert UI rendered");}},
    "react":{useState:(value:unknown)=>[value,()=>{}],useEffect:()=>{}},
    "next/script":{},"next/navigation":{usePathname:()=>"/"},
    "@/lib/analytics/meta":{META_PIXEL_ID:"1006368245818889",isTrackedPath:()=>false},
    "@/lib/analytics/meta-consent":{},
    "@/lib/analytics/meta-shared":{APPROVED_META_PATHS:[]},
  };
  runInNewContext(output,{exports,require:(id:string)=>{assert.ok(id in mocks,id);return mocks[id];}});
  assert.equal(exports.MetaPixel(),null);
});

test("CAPI success requires valid JSON and the exact accepted event count", async () => {
  const events=[{eventName:"Purchase",eventId:"purchase_12345678",eventTime:NOW/1000,user:{}}];
  for(const body of ["", "not JSON", "null", "[]", "{}", '{"events_received":0}', '{"events_received":"1"}', '{"events_received":2}', '{"events_received":1,"error":{"message":"secret private@example.invalid"}}']) {
    const result=await sendMetaEvents(events,{env:ENV,log:()=>{},fetch:(async()=>new Response(body,{status:200})) as typeof fetch});
    assert.equal(result.ok,false,body); assert.equal(result.retryable,true,body); assert.equal(result.status,200);
    assert.ok(["meta_invalid_response","meta_event_count_mismatch"].includes(result.error??""));
    assert.ok(!JSON.stringify(result).includes("private@example.invalid"));
  }
  const accepted=await sendMetaEvents(events,{env:ENV,fetch:(async()=>Response.json({events_received:1})) as typeof fetch});
  assert.deepEqual(accepted,{ok:true,status:200});
  const partial=await sendMetaEvents([...events,{...events[0],eventId:"purchase_12345679"}],{env:ENV,fetch:(async()=>Response.json({events_received:1})) as typeof fetch});
  assert.equal(partial.ok,false); assert.equal(partial.retryable,true);
});
test("ambiguous 200 upstream receipt triggers webhook retry without success claim", async () => {
  const raw=JSON.stringify(fixture());
  for(const body of ["not JSON",'{"events_received":0}']) {
    const result=await handleMetaPurchaseWebhook(raw,headers(raw),{env:ENV,now:()=>NOW,info:()=>{},log:()=>{},fetch:(async()=>new Response(body,{status:200})) as typeof fetch});
    assert.equal(result.status,503); assert.equal(result.body.retry,true); assert.equal(result.body.sent,undefined);
  }
});
