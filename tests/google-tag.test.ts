import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GOOGLE_EVENTS, GOOGLE_PRODUCTS, configureGoogleTag, googleEligibleUrl, guardGoogleNavigation, readGoogleConfig, setGoogleConsent, trackGoogleCartAddition, trackGooglePageView, type GoogleConfig } from "../lib/google-tag";
import type { CartItem } from "../lib/catalog";

const ORIGIN = "https://www.iqondaily.com";
const CREATINE = "/products/creatine-monohydrate";
const COLLAGEN = "/products/hydrolyzed-collagen-peptides";
const left: string[] = [];
const scripts: string[] = [];
const location = {
  hostname: "www.iqondaily.com", pathname: CREATINE, search: "",
  get origin() { return `https://${this.hostname}`; },
  get href() { return `${this.origin}${this.pathname}${this.search}`; },
  reload() { left.push("reload"); },
  assign(href: string) { left.push(href); },
};
const browser = {
  navigator: {globalPrivacyControl: false as boolean | undefined},
  location,
  document: {title: "Creatine Monohydrate – secret title", referrer: "", head: {appendChild: (node: {src: string}) => { scripts.push(node.src); }}, createElement: () => ({src: "", async: false})},
  dataLayer: undefined as ArrayLike<unknown>[] | undefined,
};
Object.defineProperty(globalThis, "window", {value: browser, configurable: true});
Object.defineProperty(globalThis, "document", {value: browser.document, configurable: true});

const config: GoogleConfig = {adsId: "AW-123456789", ga4Id: "G-ABC123DEF4", adsAddToCartLabel: "AbC-dEf_123", hostnames: ["www.iqondaily.com"]};
const env = {
  NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: "true",
  NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-123456789",
  NEXT_PUBLIC_GOOGLE_GA4_ID: "G-ABC123DEF4",
  NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: "AbC-dEf_123",
  NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: "www.iqondaily.com, iqondaily.com",
};
const granted = {analytics: true, adStorage: true, adUserData: true};
const analyticsOnly = {analytics: true, adStorage: false, adUserData: false};
const denied = {analytics: false, adStorage: false, adUserData: false};
const variant = "gid://shopify/ProductVariant/52086268985639";
const DENIED = {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"};

const calls = () => (browser.dataLayer || []).map(entry => Array.from(entry));
const events = (name?: string) => calls().filter(call => call[0] === "event" && (!name || call[1] === name));
const consents = () => calls().filter(call => call[0] === "consent");
const at = (route: string) => { const url = new URL(route, ORIGIN); location.pathname = url.pathname; location.search = url.search; };
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {id: "creatine-monohydrate", variantId: variant, quantity: 2, amount: 70, name: "Creatine", currency: "USD", purchase: "once", frequency: "once", ...overrides};
}
const cart = (items: CartItem[], notice?: string) => ({items, ...(notice ? {notice} : {})});
function click(href: string, init: Partial<MouseEvent> = {}) {
  const state = {prevented: false, stopped: false};
  const anchor = {href: new URL(href, ORIGIN).href, target: "", hasAttribute: () => false};
  guardGoogleNavigation({button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...init,
    target: {closest: () => anchor}, preventDefault: () => { state.prevented = true; }, stopPropagation: () => { state.stopped = true; }} as unknown as MouseEvent);
  return state;
}

beforeEach(() => {
  configureGoogleTag(config);
  scripts.length = 0; left.length = 0;
  browser.navigator.globalPrivacyControl = false;
  browser.document.referrer = "";
  location.hostname = "www.iqondaily.com";
  at(CREATINE);
});

test("absent or invalid configuration disables the tag", () => {
  assert.deepEqual(readGoogleConfig(env), {...config, hostnames: ["www.iqondaily.com", "iqondaily.com"]});
  assert.equal(readGoogleConfig({}), null);
  for (const invalid of [
    {NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: undefined}, {NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: "1"}, {NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: "false"},
    {NEXT_PUBLIC_GOOGLE_ADS_ID: "616-667-2235"}, {NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-abc"}, {NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-123\"><script>"},
    {NEXT_PUBLIC_GOOGLE_GA4_ID: "UA-1234-1"}, {NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: "bad label"},
    {NEXT_PUBLIC_GOOGLE_ADS_ID: "", NEXT_PUBLIC_GOOGLE_GA4_ID: ""}, {NEXT_PUBLIC_GOOGLE_ADS_ID: ""},
    {NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: ""}, {NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: "*.vercel.app"}, {NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: "https://www.iqondaily.com"},
  ]) assert.equal(readGoogleConfig({...env, ...invalid}), null, JSON.stringify(invalid));
  assert.equal(readGoogleConfig({...env, NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: ""})?.adsAddToCartLabel, undefined);
  assert.equal(readGoogleConfig({...env, NEXT_PUBLIC_GOOGLE_GA4_ID: ""})?.ga4Id, undefined);

  configureGoogleTag(null);
  setGoogleConsent(granted); trackGooglePageView(CREATINE);
  trackGoogleCartAddition(cart([line()]), variant, 1);
  assert.equal(scripts.length, 0);
  assert.equal(browser.dataLayer, undefined);
});

test("unknown and denied consent load no script and queue nothing", () => {
  trackGooglePageView(CREATINE);
  setGoogleConsent(null); trackGooglePageView(COLLAGEN);
  setGoogleConsent(denied); trackGooglePageView(CREATINE);
  setGoogleConsent({analytics: false, adStorage: true, adUserData: false});
  trackGoogleCartAddition(cart([line()]), variant, 1);
  assert.equal(scripts.length, 0);
  assert.equal(browser.dataLayer, undefined);
});

test("denied defaults, then update and sanitized page metadata, precede js, config and the script", () => {
  browser.document.referrer = "https://www.google.com/search?q=creatine";
  setGoogleConsent(granted);
  const all = calls();
  assert.deepEqual(all.slice(0, 5), [
    ["consent", "default", DENIED], ["set", "ads_data_redaction", true], ["set", "url_passthrough", false],
    ["consent", "update", {ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "denied"}],
    ["set", {page_location: `${ORIGIN}${CREATINE}`, page_referrer: "https://www.google.com/", page_title: "IQON Daily"}],
  ]);
  assert.equal(all[5][0], "js");
  assert.deepEqual(all.slice(6).map(call => call.slice(0, 2)), [["config", "G-ABC123DEF4"], ["config", "AW-123456789"]]);
  for (const call of all.filter(call => call[0] === "config")) {
    assert.deepEqual(call[2], {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
  }
  assert.deepEqual(scripts, ["https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4"]);
  setGoogleConsent(granted);
  assert.equal(scripts.length, 1, "script loads once");
  assert.equal(calls().filter(call => call[0] === "config").length, 2, "each destination configured once");
});

test("each purpose is mapped separately; Ads needs both ad_storage and ad_user_data", () => {
  setGoogleConsent({analytics: false, adStorage: true, adUserData: false});
  assert.equal(browser.dataLayer, undefined);
  setGoogleConsent(analyticsOnly);
  assert.deepEqual(calls().filter(call => call[0] === "config").map(call => call[1]), ["G-ABC123DEF4"]);
  trackGoogleCartAddition(cart([line()]), variant, 1);
  assert.deepEqual(events("add_to_cart")[0]?.[2], {send_to: ["G-ABC123DEF4"], page_location: `${ORIGIN}${CREATINE}`, page_title: "IQON Daily",
    currency: "USD", value: 35, items: [{item_id: "52086268985639", price: 35, quantity: 1}]});
  setGoogleConsent(granted);
  assert.deepEqual(calls().filter(call => call[0] === "config").map(call => call[1]), ["G-ABC123DEF4", "AW-123456789"]);
  assert.equal(left.length, 0, "widening permission never reloads");

  configureGoogleTag(config); scripts.length = 0;
  setGoogleConsent({analytics: false, adStorage: true, adUserData: true});
  assert.deepEqual(scripts, ["https://www.googletagmanager.com/gtag/js?id=AW-123456789"]);
  trackGooglePageView(CREATINE);
  assert.equal(events("page_view").length, 0, "page_view is analytics-only");
  trackGoogleCartAddition(cart([line()]), variant, 1);
  assert.deepEqual((events("add_to_cart")[0]?.[2] as {send_to: string[]}).send_to, ["AW-123456789/AbC-dEf_123"]);

  configureGoogleTag({...config, adsAddToCartLabel: undefined, ga4Id: undefined});
  setGoogleConsent(granted);
  trackGoogleCartAddition(cart([line()]), variant, 1);
  assert.equal(events().length, 0, "no unlabeled (remarketing-style) Ads events");
});

test("only the three advertised product pages are eligible", () => {
  assert.deepEqual([...GOOGLE_PRODUCTS], ["creatine-monohydrate", "hydrolyzed-collagen-peptides", "colostrum-powder"]);
  for (const path of ["/", "/collections/all", "/collections/supplements", "/products/glp-1-support", "/products/collagen-peptides-chocolate",
    "/products/creatine-monohydrate/x", "/checkout", "/account", "/account/orders/1", "/affiliates", "/api/cart", "/journal"]) {
    configureGoogleTag(config);
    at(path); setGoogleConsent(granted); trackGooglePageView(path);
    assert.equal(browser.dataLayer, undefined, path);
  }
  assert.equal(scripts.length, 0);
  for (const path of [CREATINE, COLLAGEN, "/products/colostrum-powder"]) assert.equal(googleEligibleUrl(new URL(path, ORIGIN)), true);
});

test("dirty URLs, sensitive same-origin referrers, GPC and unlisted hosts fail closed", () => {
  for (const search of ["?utm_term=jane%40example.com", "?utm_source=google", "?email=a%40b.com", "?token=secret", "?gclid=a%40b", "?gclid=" + "a".repeat(201), "?discount=SAVE"]) {
    configureGoogleTag(config); at(CREATINE + search);
    setGoogleConsent(granted); trackGooglePageView(CREATINE + search);
    assert.equal(browser.dataLayer, undefined, search);
  }
  configureGoogleTag(config); at(CREATINE);
  browser.document.referrer = `${ORIGIN}/products/glp-1-support`;
  setGoogleConsent(granted);
  assert.equal(browser.dataLayer, undefined, "same-origin sensitive referrer");
  browser.document.referrer = `${ORIGIN}${COLLAGEN}`;
  browser.navigator.globalPrivacyControl = true;
  setGoogleConsent(granted);
  browser.navigator.globalPrivacyControl = false;
  location.hostname = "iqon-preview.vercel.app";
  setGoogleConsent(granted);
  assert.equal(browser.dataLayer, undefined);
  location.hostname = "www.iqondaily.com";
  // Route argument and real document must both be eligible (Next history timing).
  trackGooglePageView("/account");
  assert.equal(browser.dataLayer, undefined);
  trackGooglePageView(CREATINE);
  assert.deepEqual((events("page_view")[0]?.[2] as {page_referrer: string}).page_referrer, `${ORIGIN}/`);
});

test("click IDs reach page metadata only under advertising consent; titles never leave", () => {
  at(`${CREATINE}?gclid=Abc_123&wbraid=w-1`);
  setGoogleConsent(analyticsOnly); trackGooglePageView(`${CREATINE}?gclid=Abc_123&wbraid=w-1`);
  setGoogleConsent(granted);
  at(COLLAGEN + "?gbraid=g1"); trackGooglePageView(COLLAGEN + "?gbraid=g1");
  assert.deepEqual(events("page_view").map(call => (call[2] as {page_location: string}).page_location), [`${ORIGIN}${CREATINE}`, `${ORIGIN}${COLLAGEN}?gbraid=g1`]);
  const sets = calls().filter(call => call[0] === "set" && typeof call[1] === "object");
  assert.ok(sets.length >= 3, "metadata is set globally before config and each page view");
  assert.doesNotMatch(JSON.stringify(calls()), /secret title|Creatine Monohydrate/);
});

test("one page_view per SPA route among advertised products, including back navigation", () => {
  setGoogleConsent(granted);
  for (const route of [CREATINE, CREATINE, COLLAGEN, COLLAGEN, CREATINE]) { at(route); trackGooglePageView(route); }
  assert.equal(events("page_view").length, 3);
  setGoogleConsent(granted);
  assert.equal(events("page_view").length, 3, "repeated grant does not resend the current page");
});

test("withdrawal after the script is added denies storage and leaves the document", () => {
  setGoogleConsent(granted); trackGooglePageView(CREATINE);
  setGoogleConsent(denied);
  assert.deepEqual(consents().at(-1), ["consent", "update", DENIED]);
  assert.deepEqual(left, ["reload"]);
  const count = calls().length;
  trackGooglePageView(COLLAGEN); trackGoogleCartAddition(cart([line()]), variant, 1); setGoogleConsent(granted);
  assert.equal(calls().length, count, "nothing more is queued in a document being left");
  assert.deepEqual(left, ["reload"]);
});

test("a narrower grant, GPC or an ineligible client navigation after load also leaves", () => {
  setGoogleConsent(granted);
  setGoogleConsent(analyticsOnly);
  assert.deepEqual(left, ["reload"], "Ads withdrawn while GA4 stays");

  configureGoogleTag(config); left.length = 0;
  setGoogleConsent(granted);
  browser.navigator.globalPrivacyControl = true;
  trackGooglePageView(CREATINE);
  assert.deepEqual(left, ["reload"], "GPC");

  configureGoogleTag(config); left.length = 0; browser.navigator.globalPrivacyControl = false;
  setGoogleConsent(granted); trackGooglePageView(CREATINE);
  at("/account/orders/1"); trackGooglePageView("/account/orders/1");
  assert.deepEqual(left, ["reload"], "router.push/back into an excluded page reloads it without Google");
  assert.equal(events().length, 1);
});

test("pending (not yet executed) script: withdrawal still leaves before queued hits can run", () => {
  // The script element is appended but gtag.js has not executed; the queue holds
  // the earlier grant and events. Leaving the document discards both.
  setGoogleConsent(granted); trackGooglePageView(CREATINE);
  assert.equal(scripts.length, 1);
  setGoogleConsent(null);
  assert.deepEqual(left, ["reload"]);
});

test("click guard turns links to ineligible pages into full navigations once Google may run", () => {
  assert.deepEqual(click("/account"), {prevented: false, stopped: false}, "inactive before the script is added");
  setGoogleConsent(granted);
  assert.deepEqual(click(COLLAGEN), {prevented: false, stopped: false}, "advertised products stay client-side");
  assert.deepEqual(click("https://example.com/"), {prevented: false, stopped: false}, "external links already unload");
  assert.deepEqual(click("/account", {metaKey: true}), {prevented: false, stopped: false}, "new-tab clicks keep this page");
  assert.deepEqual(left, []);
  assert.deepEqual(click("/products/glp-1-support"), {prevented: true, stopped: true});
  assert.deepEqual(left, [`${ORIGIN}/products/glp-1-support`]);
  assert.deepEqual(consents().at(-1), ["consent", "update", DENIED]);
  assert.deepEqual(click("/account"), {prevented: false, stopped: false}, "only once");
});

test("add_to_cart only for a clean successful addition of an advertised product", () => {
  setGoogleConsent(granted);
  trackGoogleCartAddition(cart([]), variant, 1);
  trackGoogleCartAddition(cart([line({amount: undefined})]), variant, 1);
  trackGoogleCartAddition(cart([line({currency: "EUR"})]), variant, 1);
  trackGoogleCartAddition(cart([line({variantId: "gid://shopify/Product/1"})]), "gid://shopify/Product/1", 1);
  trackGoogleCartAddition(cart([line({id: "glp-1-support"})]), variant, 1);
  trackGoogleCartAddition(cart([line({id: "collagen-peptides-chocolate"})]), variant, 1);
  // Stock cap: Shopify returns 200 with a warning and may have added nothing.
  trackGoogleCartAddition(cart([line()], "Only 2 items were added to your cart due to availability."), variant, 3);
  // Cart already held 2; this request for 1 was capped to 0, but the line still reads 2.
  trackGoogleCartAddition(cart([line()], "Not enough items available. Only 2 could be added."), variant, 1);
  trackGoogleCartAddition(cart([line({quantity: 1, amount: 35})]), variant, 2);
  for (const quantity of [0, -1, 1.5, NaN]) trackGoogleCartAddition(cart([line()]), variant, quantity);
  assert.equal(events("add_to_cart").length, 0);
  trackGoogleCartAddition(cart([line({quantity: 3, amount: 105})]), variant, 1);
  const plan = "gid://shopify/SellingPlan/456";
  trackGoogleCartAddition(cart([line(), line({sellingPlanId: plan, amount: 50})]), variant, 2, plan);
  assert.deepEqual(events("add_to_cart").map(call => {
    const {value, items, send_to} = call[2] as {value: number; items: unknown[]; send_to: string[]};
    return {value, items, send_to};
  }), [
    {send_to: ["G-ABC123DEF4", "AW-123456789/AbC-dEf_123"], value: 35, items: [{item_id: "52086268985639", price: 35, quantity: 1}]},
    {send_to: ["G-ABC123DEF4", "AW-123456789/AbC-dEf_123"], value: 50, items: [{item_id: "52086268985639", price: 25, quantity: 2}]},
  ]);
  // Only the allowlisted path identifies the page; no names, customer, cart or checkout data.
  assert.doesNotMatch(JSON.stringify(events().map(call => ({...call[2] as object, page_location: undefined}))), /creatine|name|email|cart|checkout/i);
});

test("a broken or blocked tag never throws into cart or checkout code", () => {
  setGoogleConsent(granted);
  browser.dataLayer = {push() { throw new Error("blocked"); }} as unknown as ArrayLike<unknown>[];
  assert.doesNotThrow(() => trackGoogleCartAddition(cart([line()]), variant, 1));
  assert.doesNotThrow(() => trackGooglePageView(COLLAGEN));
  assert.doesNotThrow(() => click("/account"));
  configureGoogleTag(config);
  browser.document.head.appendChild = () => { throw new Error("CSP"); };
  assert.doesNotThrow(() => setGoogleConsent(granted));
  browser.document.head.appendChild = node => { scripts.push(node.src); };
  browser.document.referrer = "not a url";
  configureGoogleTag(config);
  assert.doesNotThrow(() => setGoogleConsent(granted));
});

test("only page_view and add_to_cart are ever queued; never Purchase or checkout", () => {
  assert.deepEqual([...GOOGLE_EVENTS], ["page_view", "add_to_cart"]);
  setGoogleConsent(granted); trackGooglePageView(CREATINE); trackGoogleCartAddition(cart([line()]), variant, 1);
  assert.deepEqual(events().map(call => call[1]), ["page_view", "add_to_cart"]);
});
