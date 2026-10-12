// Runs the GENERATED Shopify custom pixel code (exactly what would be pasted into Shopify) in a
// sandbox with mocked `analytics`, `init`, `api.customerPrivacy`, `window` and `document`.
// Nothing is loaded from Meta; the fbq stub only records calls.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { buildPixel, pixelConfig } from "../../scripts/build-checkout-pixel.mjs";

const dir = new URL("../../shopify/custom-pixels/", import.meta.url);
const read = name => fs.readFileSync(new URL(name, dir), "utf8");
const eligibility = JSON.parse(read("eligibility.json"));
const CREATINE = "52086268985639", COLLAGEN = "52086149480743", COLOSTRUM = "52086282486055";
const GLP1 = "52086119760167", LIVER = "52086204694823", NMN = "52086293889319";
const ALLOWED = {analyticsProcessingAllowed: true, marketingAllowed: true, preferencesProcessingAllowed: true, saleOfDataAllowed: true};

function run(mode = "live", {privacy = ALLOWED, withApi = true, withInit = true} = {}) {
  const handlers = {}, privacyHandlers = [], scripts = [], logs = [], fbqCalls = [];
  const window = {};
  const document = {head: {appendChild: node => scripts.push(node.src)}, createElement: () => ({})};
  const context = {
    window, document, console: {info: (...args) => logs.push(args.join(" "))},
    analytics: {subscribe: (name, handler) => { handlers[name] = handler; }},
    ...(withInit ? {init: {customerPrivacy: privacy}} : {}),
    ...(withApi ? {api: {customerPrivacy: {subscribe: (name, handler) => { assert.equal(name, "visitorConsentCollected"); privacyHandlers.push(handler); }}}} : {}),
  };
  vm.createContext(context);
  vm.runInContext(read(`iqon-meta-checkout.${mode}.js`), context);
  // Replace the queue stub with a recorder once the pixel created it (as fbevents.js would).
  const fbqRecorder = () => {
    const recorded = window.fbq ? [...window.fbq.queue].map(args => [...args]) : [];
    // JSON round trip: objects created inside the vm realm have different prototypes.
    return JSON.parse(JSON.stringify([...recorded, ...fbqCalls]));
  };
  return {
    handlers, scripts, logs, window,
    calls: fbqRecorder,
    tracks: () => fbqRecorder().filter(args => args[0] === "track"),
    consent: next => privacyHandlers.forEach(handler => handler({customerPrivacy: next})),
    complete: checkout => handlers.checkout_completed({name: "checkout_completed", data: {checkout}}),
    start: checkout => handlers.checkout_started({name: "checkout_started", data: {checkout}}),
  };
}

const line = (variant, quantity = 1) => ({quantity, title: "never sent", variant: {id: variant, product: {id: "9", title: "never sent", url: "/products/never-sent"}}});
const checkout = (lines, extra = {}) => ({
  token: "tok_123", currencyCode: "USD", totalPrice: {amount: "59.98", currencyCode: "USD"}, attributes: [],
  email: "buyer@example.invalid", order: {id: "gid://shopify/Order/987654"}, lineItems: lines, ...extra,
});

test("eligible order: exactly one Purchase with deterministic ID, minimal payload, no PageView or automatic events", () => {
  const pixel = run();
  assert.deepEqual(pixel.scripts, [], "Meta is not loaded before an eligible, permitted event");
  pixel.complete(checkout([line(`gid://shopify/ProductVariant/${CREATINE}`, 2)]));
  pixel.complete(checkout([line(CREATINE, 2)])); // thank-you page reload
  assert.deepEqual(pixel.scripts, ["https://connect.facebook.net/en_US/fbevents.js"]);
  assert.equal(pixel.window.fbq.disablePushState, true);
  const calls = pixel.calls();
  assert.deepEqual(calls.slice(0, 3), [["set", "autoConfig", false, "1006368245818889"], ["consent", "grant"], ["init", "1006368245818889"]]);
  assert.deepEqual(pixel.tracks(), [["track", "Purchase", {
    value: 59.98, currency: "USD", content_type: "product", content_ids: [CREATINE],
    contents: [{id: CREATINE, quantity: 2}], num_items: 2,
  }, {eventID: "purchase_987654"}]]);
  const serialized = JSON.stringify(calls);
  for (const secret of ["buyer@example.invalid", "never sent", "/products/", "tok_123", "PageView"]) assert.ok(!serialized.includes(secret), secret);
});

test("all three reviewed products together are eligible; InitiateCheckout uses the checkout token", () => {
  const pixel = run();
  const cart = checkout([line(CREATINE), line(COLLAGEN, 3), line(COLOSTRUM)]);
  pixel.start(cart);
  pixel.complete(cart);
  assert.deepEqual(pixel.tracks().map(args => [args[1], args[3].eventID, args[2].num_items]), [["InitiateCheckout", "ic_tok_123", 5], ["Purchase", "purchase_987654", 5]]);
});

test("mixed and unreviewed carts send nothing at all (no stripping, no renaming, no Meta load)", () => {
  for (const lines of [[line(CREATINE), line(GLP1)], [line(LIVER)], [line(COLLAGEN), line(NMN)], [line("123")], [line(null)], [line(CREATINE, 0)], [line(CREATINE, 1.5)], []]) {
    const pixel = run();
    pixel.start(checkout(lines));
    pixel.complete(checkout(lines));
    assert.deepEqual(pixel.tracks(), [], JSON.stringify(lines));
    assert.deepEqual(pixel.scripts, []);
  }
});

test("missing or denied Shopify permission sends nothing", () => {
  for (const options of [
    {privacy: {...ALLOWED, marketingAllowed: false}}, {privacy: {...ALLOWED, saleOfDataAllowed: false}},
    {privacy: {...ALLOWED, marketingAllowed: undefined}}, {privacy: null}, {withInit: false},
  ]) {
    const pixel = run("live", options);
    pixel.complete(checkout([line(CREATINE)]));
    assert.deepEqual(pixel.tracks(), [], JSON.stringify(options));
    assert.deepEqual(pixel.scripts, []);
  }
});

test("withdrawal during checkout revokes Meta and stops Purchase; a later grant is honoured", () => {
  const pixel = run();
  const cart = checkout([line(CREATINE)]);
  pixel.start(cart);
  pixel.consent({...ALLOWED, saleOfDataAllowed: false});
  pixel.complete(cart);
  assert.deepEqual(pixel.tracks().map(args => args[1]), ["InitiateCheckout"]);
  assert.ok(pixel.calls().some(args => args[0] === "consent" && args[1] === "revoke"));
  pixel.consent(null);
  pixel.complete(cart);
  assert.deepEqual(pixel.tracks().map(args => args[1]), ["InitiateCheckout"], "unknown state after an event is not permission");

  const late = run("live", {privacy: {...ALLOWED, marketingAllowed: false}});
  late.consent(ALLOWED);
  late.complete(cart);
  assert.deepEqual(late.tracks().map(args => args[1]), ["Purchase"]);
});

test("the storefront restriction attribute blocks sending; unreadable attributes are treated as restricted", () => {
  for (const attributes of [[{key: "_iqon_ad_restriction", value: "denied"}], [{key: "_iqon_ad_restriction", value: "gpc"}], undefined, null, "x"]) {
    const pixel = run();
    pixel.complete(checkout([line(CREATINE)], {attributes}));
    assert.deepEqual(pixel.tracks(), [], JSON.stringify(attributes));
  }
  const pixel = run();
  pixel.complete(checkout([line(CREATINE)], {attributes: [{key: "gift_note", value: "hi"}, {key: "_iqon_ad_restriction", value: ""}]}));
  assert.equal(pixel.tracks().length, 1, "other attributes and an empty value do not restrict");
});

test("malformed checkout payloads never send and never throw", () => {
  const bad = [
    undefined, null, {}, checkout([line(CREATINE)], {order: null}), checkout([line(CREATINE)], {order: {id: "abc"}}),
    checkout([line(CREATINE)], {totalPrice: {amount: "NaN", currencyCode: "USD"}}), checkout([line(CREATINE)], {totalPrice: {amount: "-1", currencyCode: "USD"}}),
    checkout([line(CREATINE)], {totalPrice: {amount: "10", currencyCode: "usd"}, currencyCode: "usd"}), checkout([{quantity: 1}]), checkout("lines"),
  ];
  for (const value of bad) {
    const pixel = run();
    assert.doesNotThrow(() => pixel.complete(value));
    assert.doesNotThrow(() => pixel.start(value));
    // Order-ID problems only affect Purchase; everything else here also blocks InitiateCheckout.
    const orderOnly = value && value.order !== undefined && !(value.order && /^gid/.test(value.order.id));
    assert.deepEqual(pixel.tracks().filter(args => !orderOnly || args[1] === "Purchase"), [], JSON.stringify(value));
  }
  const pixel = run();
  pixel.start(checkout([line(CREATINE)], {token: "bad token/with spaces"}));
  assert.deepEqual(pixel.tracks(), []);
});

test("diagnostic artifact never loads Meta and logs only the decision", () => {
  const pixel = run("diagnostic");
  pixel.start(checkout([line(CREATINE)]));
  pixel.complete(checkout([line(CREATINE), line(GLP1)], {attributes: [{key: "_iqon_ad_restriction", value: "denied"}]}));
  assert.deepEqual(pixel.scripts, []);
  assert.equal(pixel.window.fbq, undefined);
  assert.deepEqual(pixel.logs.map(entry => JSON.parse(entry.replace("[iqon-meta-checkout diagnostic] ", ""))), [
    {event: "InitiateCheckout", permitted: true, restricted: false, eligible: true},
    {event: "Purchase", permitted: true, restricted: true, eligible: false},
  ]);
  assert.ok(!pixel.logs.join().includes("example.invalid"));
});

test("works without the consent subscription API (no withdrawal events) but still requires initial permission", () => {
  const pixel = run("live", {withApi: false});
  pixel.complete(checkout([line(CREATINE)]));
  assert.equal(pixel.tracks().length, 1);
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
