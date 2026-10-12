// Runs the GENERATED Shopify custom pixel code (exactly what would be pasted into Shopify) in a
// sandbox with mocked `analytics`, `init`, `api.customerPrivacy`, `browser.localStorage` and a
// recording `fetch`. Nothing leaves the process. Provider behaviour is NOT proven here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createHash, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { buildPixel, pixelConfig } from "../../scripts/build-checkout-pixel.mjs";

const dir = new URL("../../shopify/custom-pixels/", import.meta.url);
const read = name => fs.readFileSync(new URL(name, dir), "utf8");
const eligibility = JSON.parse(read("eligibility.json"));
const CREATINE = "52086268985639", COLLAGEN = "52086149480743", COLOSTRUM = "52086282486055";
const GLP1 = "52086119760167", LIVER = "52086204694823", NMN = "52086293889319";
const ALLOWED = {analyticsProcessingAllowed: true, marketingAllowed: true, preferencesProcessingAllowed: true, saleOfDataAllowed: true};
const TOKEN = "SYNTHtok_abc123";
const hashedIc = "ic_" + createHash("sha256").update(`iqon-ic:${TOKEN}`).digest("hex");

function fakeStorage(map = new Map()) {
  return {map, getItem: async key => map.has(key) ? map.get(key) : null, setItem: async (key, value) => { map.set(key, value); }};
}

function run(mode = "live", {privacy = ALLOWED, withApi = true, withInit = true, storage = fakeStorage(), crypto = webcrypto, fetchDelay = null} = {}) {
  const handlers = {}, privacyHandlers = [], requests = [], logs = [];
  const window = {};
  const context = {
    window, console: {info: (...args) => logs.push(args.join(" "))}, crypto, TextEncoder, URLSearchParams, Uint8Array, Array, Promise,
    document: {createElement: () => { throw new Error("no DOM/script injection expected"); }},
    fetch: async (url, init) => { if (fetchDelay) await fetchDelay; requests.push({url, init}); return {ok: true}; },
    analytics: {subscribe: (name, handler) => { handlers[name] = handler; }},
    ...(storage ? {browser: {localStorage: storage}} : {}),
    ...(withInit ? {init: {customerPrivacy: privacy}} : {}),
    ...(withApi ? {api: {customerPrivacy: {subscribe: (name, handler) => { assert.equal(name, "visitorConsentCollected"); privacyHandlers.push(handler); }}}} : {}),
  };
  vm.createContext(context);
  vm.runInContext(read(`iqon-meta-checkout.${mode}.js`), context);
  const sends = () => requests.map(({url, init}) => {
    const parsed = new URL(url);
    const cd = {};
    for (const [key, value] of parsed.searchParams) if (key.startsWith("cd[")) cd[key.slice(3, -1)] = value;
    return {origin: parsed.origin + parsed.pathname, ev: parsed.searchParams.get("ev"), eid: parsed.searchParams.get("eid"), id: parsed.searchParams.get("id"), dl: parsed.searchParams.get("dl"), cd, url, init: JSON.parse(JSON.stringify(init))};
  });
  return {
    handlers, logs, window, requests, sends,
    consent: next => privacyHandlers.forEach(handler => handler({customerPrivacy: next})),
    complete: checkout => handlers.checkout_completed({name: "checkout_completed", data: {checkout}}),
    start: checkout => handlers.checkout_started({name: "checkout_started", data: {checkout}}),
  };
}

const line = (variant, quantity = 1) => ({quantity, title: "never sent", variant: {id: variant, product: {id: "9", title: "never sent", url: "/products/never-sent"}}});
const checkout = (lines, extra = {}) => ({
  token: TOKEN, currencyCode: "USD", totalPrice: {amount: "59.98", currencyCode: "USD"}, attributes: [],
  email: "buyer@example.invalid", order: {id: "gid://shopify/Order/987654"}, lineItems: lines, ...extra,
});

test("eligible order: one controlled Purchase request, deterministic ID, no SDK, no referrer, no PageView", async () => {
  const pixel = run();
  await pixel.complete(checkout([line(`gid://shopify/ProductVariant/${CREATINE}`, 2)]));
  await pixel.complete(checkout([line(CREATINE, 2)])); // same sandbox, repeated event
  const sends = pixel.sends();
  assert.equal(sends.length, 1);
  const [send] = sends;
  assert.equal(send.origin, "https://www.facebook.com/tr");
  assert.deepEqual({ev: send.ev, eid: send.eid, id: send.id, dl: send.dl}, {ev: "Purchase", eid: "purchase_987654", id: "1006368245818889", dl: "https://www.iqonbody.com/"});
  assert.deepEqual(send.cd, {value: "59.98", currency: "USD", content_type: "product", content_ids: `["${CREATINE}"]`, contents: `[{"id":"${CREATINE}","quantity":2}]`, num_items: "2"});
  assert.deepEqual(send.init, {method: "GET", mode: "no-cors", credentials: "include", referrerPolicy: "no-referrer", keepalive: true});
  assert.equal(pixel.window.fbq, undefined, "no Meta SDK");
  for (const secret of ["buyer@example.invalid", "never sent", "/products/", TOKEN, "PageView", "checkouts"]) assert.ok(!send.url.includes(secret), secret);
});

test("S1: InitiateCheckout uses a SHA-256 of the checkout token; the raw token never leaves", async () => {
  const pixel = run();
  const cart = checkout([line(CREATINE), line(COLLAGEN, 3), line(COLOSTRUM)]);
  await pixel.start(cart);
  await pixel.complete(cart);
  assert.deepEqual(pixel.sends().map(s => [s.ev, s.eid, s.cd.num_items]), [["InitiateCheckout", hashedIc, "5"], ["Purchase", "purchase_987654", "5"]]);
  assert.ok(pixel.requests.every(r => !r.url.includes(TOKEN) && !JSON.stringify(r.init).includes(TOKEN)));
  const noCrypto = run("live", {crypto: {subtle: {digest: async () => { throw new Error("unavailable"); }}}});
  await noCrypto.start(cart);
  assert.deepEqual(noCrypto.sends(), [], "no hashing ⇒ no InitiateCheckout, never the raw token");
});

test("S2: a withdrawal while the send is pending (storage/hash in flight) stops it; nothing is queued for later", async () => {
  const cart = checkout([line(CREATINE)]);
  let release;
  const slow = fakeStorage();
  const gate = new Promise(resolve => { release = resolve; });
  const original = slow.getItem; slow.getItem = async key => { await gate; return original(key); };
  const pixel = run("live", {storage: slow});
  const pending = pixel.complete(cart);
  pixel.consent({...ALLOWED, saleOfDataAllowed: false});
  pixel.consent(ALLOWED); // re-granted before the send: still not sent, the decision predates a withdrawal
  release(); await pending;
  assert.deepEqual(pixel.sends(), []);
  // A later, freshly decided event after the re-grant is allowed.
  const fresh = run();
  fresh.consent({...ALLOWED, marketingAllowed: false});
  await fresh.complete(cart);
  assert.deepEqual(fresh.sends(), []);
  fresh.consent(ALLOWED);
  await fresh.complete(checkout([line(CREATINE)], {order: {id: "555"}}));
  assert.deepEqual(fresh.sends().map(s => s.eid), ["purchase_555"]);
});

test("S3: a fresh sandbox (thank-you reload) sharing Shopify browser storage does not resend", async () => {
  const shared = fakeStorage();
  const cart = checkout([line(CREATINE)]);
  const first = run("live", {storage: shared});
  await first.complete(cart);
  const second = run("live", {storage: shared});
  await second.complete(cart);
  assert.equal(first.sends().length + second.sends().length, 1);
  assert.equal(shared.map.get("iqon_meta_sent:purchase_987654"), "1");
  const broken = {getItem: async () => { throw new Error("denied"); }, setItem: async () => { throw new Error("denied"); }};
  const fallback = run("live", {storage: broken});
  await fallback.complete(cart);
  assert.equal(fallback.sends().length, 1, "storage failure relies on Shopify's documented once-per-checkout event");
});

test("mixed and unreviewed carts send nothing at all (no stripping, no renaming)", async () => {
  for (const lines of [[line(CREATINE), line(GLP1)], [line(LIVER)], [line(COLLAGEN), line(NMN)], [line("123")], [line(null)], [line(CREATINE, 0)], [line(CREATINE, 1.5)], []]) {
    const pixel = run();
    await pixel.start(checkout(lines));
    await pixel.complete(checkout(lines));
    assert.deepEqual(pixel.sends(), [], JSON.stringify(lines));
  }
});

test("missing or denied Shopify permission sends nothing", async () => {
  for (const options of [
    {privacy: {...ALLOWED, marketingAllowed: false}}, {privacy: {...ALLOWED, saleOfDataAllowed: false}},
    {privacy: {...ALLOWED, marketingAllowed: undefined}}, {privacy: null}, {withInit: false},
  ]) {
    const pixel = run("live", options);
    await pixel.complete(checkout([line(CREATINE)]));
    assert.deepEqual(pixel.sends(), [], JSON.stringify(options));
  }
});

test("withdrawal during checkout stops Purchase; unknown state is not permission", async () => {
  const pixel = run();
  const cart = checkout([line(CREATINE)]);
  await pixel.start(cart);
  pixel.consent({...ALLOWED, saleOfDataAllowed: false});
  await pixel.complete(cart);
  pixel.consent(null);
  await pixel.complete(cart);
  assert.deepEqual(pixel.sends().map(s => s.ev), ["InitiateCheckout"]);
});

test("the storefront restriction attribute blocks sending; unreadable attributes are treated as restricted", async () => {
  for (const attributes of [[{key: "_iqon_ad_restriction", value: "denied"}], [{key: "_iqon_ad_restriction", value: "gpc"}], [{key: "_iqon_ad_restriction", value: null}], [null], undefined, null, "x"]) {
    const pixel = run();
    await pixel.complete(checkout([line(CREATINE)], {attributes}));
    assert.deepEqual(pixel.sends(), [], JSON.stringify(attributes));
  }
  const pixel = run();
  await pixel.complete(checkout([line(CREATINE)], {attributes: [{key: "gift_note", value: "hi"}, {key: "_iqon_ad_restriction", value: ""}]}));
  assert.equal(pixel.sends().length, 1, "other attributes and an empty value do not restrict");
});

test("malformed checkout payloads never send and never throw", async () => {
  const bad = [undefined, null, {}, checkout([line(CREATINE)], {totalPrice: {amount: "NaN", currencyCode: "USD"}}), checkout([line(CREATINE)], {totalPrice: {amount: "-1", currencyCode: "USD"}}),
    checkout([line(CREATINE)], {totalPrice: {amount: "10", currencyCode: "usd"}, currencyCode: "usd"}), checkout([{quantity: 1}]), checkout("lines")];
  for (const value of bad) {
    const pixel = run();
    await assert.doesNotReject(async () => { await pixel.complete(value); await pixel.start(value); });
    assert.deepEqual(pixel.sends(), [], JSON.stringify(value));
  }
  for (const extra of [{order: null}, {order: {id: "abc"}}]) {
    const pixel = run(); await pixel.complete(checkout([line(CREATINE)], extra));
    assert.deepEqual(pixel.sends(), []);
  }
  const pixel = run();
  await pixel.start(checkout([line(CREATINE)], {token: "bad token/with spaces"}));
  assert.deepEqual(pixel.sends(), []);
});

test("diagnostic artifact never contacts Meta, even when everything is permitted and eligible", async () => {
  const pixel = run("diagnostic");
  await pixel.start(checkout([line(CREATINE)]));
  await pixel.complete(checkout([line(CREATINE)]));
  await pixel.complete(checkout([line(CREATINE), line(GLP1)], {attributes: [{key: "_iqon_ad_restriction", value: "denied"}]}));
  assert.deepEqual(pixel.requests, []);
  assert.deepEqual(pixel.logs.map(entry => JSON.parse(entry.replace("[iqon-meta-checkout diagnostic] ", ""))), [
    {event: "InitiateCheckout", permitted: true, restricted: false, eligible: true},
    {event: "Purchase", permitted: true, restricted: false, eligible: true},
    {event: "Purchase", permitted: true, restricted: true, eligible: false},
  ]);
  assert.ok(!pixel.logs.join().includes("example.invalid") && !pixel.logs.join().includes(TOKEN));
});

test("generator: committed artifacts are current; never-eligible or malformed allowlists are refused", () => {
  execFileSync(process.execPath, [new URL("../../scripts/build-checkout-pixel.mjs", import.meta.url).pathname, "--check"]);
  assert.throws(() => pixelConfig({...eligibility, variants: {...eligibility.variants, [GLP1]: "glp-1-support"}}, "live"), /never eligible/);
  assert.throws(() => pixelConfig({...eligibility, variants: {"gid://shopify/ProductVariant/1": "x"}}, "live"), /numeric/);
  assert.throws(() => pixelConfig({...eligibility, variants: {}}, "live"), /no eligible/);
  assert.throws(() => pixelConfig({...eligibility, pixelId: "abc"}, "live"), /pixelId/);
  assert.throws(() => buildPixel("no marker", eligibility, "live"), /marker/);
  for (const mode of ["live", "diagnostic"]) assert.match(read(`iqon-meta-checkout.${mode}.js`), new RegExp(`"mode":"${mode}"`));
  assert.deepEqual(Object.keys(pixelConfig(eligibility, "live").variants), [COLLAGEN, CREATINE, COLOSTRUM]);
});
