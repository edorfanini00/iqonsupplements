import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { GOOGLE_EVENTS, configureGoogleTag, readGoogleConfig, setGoogleConsent, trackGoogleCartAddition, trackGooglePageView, type GoogleConfig } from "../lib/google-tag";
import type { CartItem } from "../lib/catalog";

type Browser = {
  navigator: {globalPrivacyControl?: boolean};
  location: {hostname: string; origin: string; pathname: string; search: string};
  document: {title: string; head: {appendChild: (node: {src: string}) => void}; createElement: (tag: string) => {src: string; async: boolean}};
  dataLayer?: ArrayLike<unknown>[];
  gtag?: (...args: unknown[]) => void;
};
const scripts: string[] = [];
const browser: Browser = {
  navigator: {globalPrivacyControl: false},
  location: {hostname: "www.iqonbody.com", origin: "https://www.iqonbody.com", pathname: "/", search: ""},
  document: {title: "IQON", head: {appendChild: node => { scripts.push(node.src); }}, createElement: () => ({src: "", async: false})},
};
Object.defineProperty(globalThis, "window", {value: browser, configurable: true});
Object.defineProperty(globalThis, "document", {value: browser.document, configurable: true});

const config: GoogleConfig = {adsId: "AW-123456789", ga4Id: "G-ABC123DEF4", adsAddToCartLabel: "AbC-dEf_123", hostnames: ["www.iqonbody.com"]};
const env = {
  NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: "true",
  NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-123456789",
  NEXT_PUBLIC_GOOGLE_GA4_ID: "G-ABC123DEF4",
  NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: "AbC-dEf_123",
  NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: "www.iqonbody.com, iqonbody.com",
};
const granted = {analytics: true, advertising: true};
const variant = "gid://shopify/ProductVariant/52086268985639";

const calls = () => (browser.dataLayer || []).map(entry => Array.from(entry));
const events = (name?: string) => calls().filter(call => call[0] === "event" && (!name || call[1] === name));
const consents = () => calls().filter(call => call[0] === "consent");
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {id: "creatine", variantId: variant, quantity: 2, amount: 70, name: "Creatine", currency: "USD", purchase: "once", frequency: "once", ...overrides};
}

beforeEach(() => {
  configureGoogleTag(config);
  scripts.length = 0;
  browser.navigator.globalPrivacyControl = false;
  browser.location.hostname = "www.iqonbody.com";
  browser.location.pathname = "/";
  browser.location.search = "";
});

test("absent or invalid configuration disables the tag", () => {
  assert.deepEqual(readGoogleConfig(env), {...config, hostnames: ["www.iqonbody.com", "iqonbody.com"]});
  assert.equal(readGoogleConfig({}), null);
  for (const invalid of [
    {NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: undefined}, {NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: "1"}, {NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED: "false"},
    {NEXT_PUBLIC_GOOGLE_ADS_ID: "616-667-2235"}, {NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-abc"}, {NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-123\"><script>"},
    {NEXT_PUBLIC_GOOGLE_GA4_ID: "UA-1234-1"}, {NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: "bad label"},
    {NEXT_PUBLIC_GOOGLE_ADS_ID: "", NEXT_PUBLIC_GOOGLE_GA4_ID: ""}, {NEXT_PUBLIC_GOOGLE_ADS_ID: ""},
    {NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: ""}, {NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: "*.vercel.app"}, {NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES: "https://www.iqonbody.com"},
  ]) assert.equal(readGoogleConfig({...env, ...invalid}), null, JSON.stringify(invalid));
  assert.equal(readGoogleConfig({...env, NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL: ""})?.adsAddToCartLabel, undefined);
  assert.equal(readGoogleConfig({...env, NEXT_PUBLIC_GOOGLE_GA4_ID: ""})?.ga4Id, undefined);

  configureGoogleTag(null);
  setGoogleConsent(granted); trackGooglePageView("/");
  trackGoogleCartAddition([line()], variant, 1);
  assert.equal(scripts.length, 0);
  assert.equal(browser.dataLayer, undefined);
});

test("unknown and denied consent load no script and queue nothing", () => {
  trackGooglePageView("/");
  setGoogleConsent(null); trackGooglePageView("/collections/all");
  setGoogleConsent({analytics: false, advertising: false}); trackGooglePageView("/products/creatine");
  trackGoogleCartAddition([line()], variant, 1);
  assert.equal(scripts.length, 0);
  assert.equal(browser.dataLayer, undefined);
});

test("denied defaults precede the script, js and every config", () => {
  setGoogleConsent(granted);
  const all = calls();
  assert.deepEqual(all[0], ["consent", "default", {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"}]);
  const firstConfig = all.findIndex(call => call[0] === "config");
  const update = all.findIndex(call => call[0] === "consent" && call[1] === "update");
  assert.ok(update > 0 && update < firstConfig, "consent update must precede config");
  assert.ok(all.findIndex(call => call[0] === "js") < firstConfig);
  assert.deepEqual(all[update], ["consent", "update", {ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "denied"}]);
  assert.deepEqual(scripts, ["https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4"]);
  for (const call of all.filter(call => call[0] === "config")) {
    assert.deepEqual(call[2], {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
  }
  assert.deepEqual(calls().filter(call => call[0] === "set"), [["set", "ads_data_redaction", true], ["set", "url_passthrough", false]]);
  setGoogleConsent(granted);
  assert.equal(scripts.length, 1, "script loads once");
  assert.equal(calls().filter(call => call[0] === "config").length, 2, "each destination configured once");
});

test("basic mode configures only consented destinations", () => {
  setGoogleConsent({analytics: true, advertising: false});
  assert.deepEqual(calls().filter(call => call[0] === "config").map(call => call[1]), ["G-ABC123DEF4"]);
  trackGoogleCartAddition([line()], variant, 1);
  assert.deepEqual(events("add_to_cart")[0]?.[2], {send_to: ["G-ABC123DEF4"], currency: "USD", value: 35, items: [{item_id: "52086268985639", price: 35, quantity: 1}]});

  configureGoogleTag(config); scripts.length = 0;
  setGoogleConsent({analytics: false, advertising: true});
  assert.deepEqual(calls().filter(call => call[0] === "config").map(call => call[1]), ["AW-123456789"]);
  assert.deepEqual(scripts, ["https://www.googletagmanager.com/gtag/js?id=AW-123456789"]);
  trackGooglePageView("/");
  assert.equal(events("page_view").length, 0, "page_view is analytics-only");
  trackGoogleCartAddition([line()], variant, 1);
  assert.deepEqual(events("add_to_cart")[0]?.[2], {send_to: ["AW-123456789/AbC-dEf_123"], currency: "USD", value: 35, items: [{item_id: "52086268985639", price: 35, quantity: 1}]});

  configureGoogleTag({...config, adsAddToCartLabel: undefined, ga4Id: undefined});
  setGoogleConsent(granted);
  trackGoogleCartAddition([line()], variant, 1);
  assert.equal(events().length, 0, "no unlabeled (remarketing-style) Ads events");
});

test("withdrawal denies storage and stops events without replay after regrant", () => {
  setGoogleConsent(granted); trackGooglePageView("/");
  setGoogleConsent({analytics: false, advertising: false});
  assert.deepEqual(consents().at(-1), ["consent", "update", {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"}]);
  trackGooglePageView("/collections/all"); trackGooglePageView("/products/creatine");
  trackGoogleCartAddition([line()], variant, 1);
  assert.equal(events().length, 1);
  setGoogleConsent(null);
  assert.equal(consents().at(-1)?.[2] && Object.values(consents().at(-1)?.[2] as object).every(value => value === "denied"), true);
  setGoogleConsent(granted);
  // Only the page the visitor is on now; nothing from the withdrawn period.
  assert.deepEqual(events("page_view").map(call => (call[2] as {page_location: string}).page_location), ["https://www.iqonbody.com/", "https://www.iqonbody.com/products/creatine"]);
  assert.equal(events("add_to_cart").length, 0);
});

test("after withdrawal, returning to the last tagged page counts again once regranted", () => {
  setGoogleConsent(granted); trackGooglePageView("/");
  setGoogleConsent({analytics: false, advertising: false});
  trackGooglePageView("/collections/all"); trackGooglePageView("/");
  setGoogleConsent(granted);
  assert.equal(events("page_view").length, 2);
});

test("GPC, unlisted hostnames and sensitive routes are never tagged", () => {
  browser.navigator.globalPrivacyControl = true;
  setGoogleConsent(granted); trackGooglePageView("/");
  browser.navigator.globalPrivacyControl = false;
  browser.location.hostname = "iqon-preview.vercel.app";
  setGoogleConsent(granted); trackGooglePageView("/");
  assert.equal(scripts.length, 0);
  assert.equal(browser.dataLayer, undefined);

  browser.location.hostname = "www.iqonbody.com";
  setGoogleConsent(granted); trackGooglePageView("/");
  for (const pathname of ["/account", "/account/privacy", "/affiliates", "/affiliates/admin", "/api/cart"]) {
    browser.location.pathname = pathname;
    trackGooglePageView(pathname); trackGoogleCartAddition([line()], variant, 1);
  }
  assert.equal(events().length, 1);
  assert.deepEqual(consents().at(-1)?.[2], {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"});
  browser.location.pathname = "/collections/all";
  trackGooglePageView("/collections/all");
  assert.equal(events("page_view").length, 2, "storefront resumes after leaving the portal");
});

test("page_location keeps only campaign parameters and click IDs under advertising consent", () => {
  setGoogleConsent({analytics: true, advertising: false});
  trackGooglePageView("/products/creatine?email=a%40b.com&utm_source=google&gclid=abc&discount=SAVE&utm_campaign=launch");
  setGoogleConsent(granted);
  trackGooglePageView("/?gclid=abc&token=secret&wbraid=w");
  assert.deepEqual(events("page_view").map(call => call[2]), [
    {send_to: ["G-ABC123DEF4"], page_location: "https://www.iqonbody.com/products/creatine?utm_source=google&utm_campaign=launch"},
    {send_to: ["G-ABC123DEF4"], page_location: "https://www.iqonbody.com/?gclid=abc&wbraid=w"},
  ]);
});

test("one page_view per SPA route despite effect replay; route changes and back navigation count", () => {
  setGoogleConsent(granted);
  for (const route of ["/", "/", "/collections/all", "/collections/all", "/collections/all?utm_source=x", "/"]) trackGooglePageView(route);
  assert.equal(events("page_view").length, 4);
  setGoogleConsent(granted);
  assert.equal(events("page_view").length, 4, "repeated grant does not resend the current page");
});

test("add_to_cart only for a successful returned line, bounded quantity and selling plan", () => {
  setGoogleConsent(granted);
  trackGoogleCartAddition([], variant, 1);
  trackGoogleCartAddition([line({amount: undefined})], variant, 1);
  trackGoogleCartAddition([line({currency: "EUR"})], variant, 1);
  trackGoogleCartAddition([line({variantId: "gid://shopify/Product/1"})], "gid://shopify/Product/1", 1);
  for (const quantity of [0, -1, 1.5, NaN]) trackGoogleCartAddition([line()], variant, quantity);
  assert.equal(events("add_to_cart").length, 0);
  trackGoogleCartAddition([line({quantity: 1, amount: 39.99})], variant, 2);
  const plan = "gid://shopify/SellingPlan/456";
  trackGoogleCartAddition([line(), line({sellingPlanId: plan, amount: 50})], variant, 2, plan);
  assert.deepEqual(events("add_to_cart").map(call => (call[2] as {value: number; items: unknown[]})), [
    {send_to: ["G-ABC123DEF4", "AW-123456789/AbC-dEf_123"], currency: "USD", value: 39.99, items: [{item_id: "52086268985639", price: 39.99, quantity: 1}]},
    {send_to: ["G-ABC123DEF4", "AW-123456789/AbC-dEf_123"], currency: "USD", value: 50, items: [{item_id: "52086268985639", price: 25, quantity: 2}]},
  ]);
  // No names, customer, cart or checkout data leave the browser.
  assert.doesNotMatch(JSON.stringify(events().map(call => call[2])), /Creatine|email|cart|checkout/i);
});

test("a broken or blocked tag never throws into cart or checkout code", () => {
  setGoogleConsent(granted);
  browser.dataLayer = {push() { throw new Error("blocked"); }} as unknown as ArrayLike<unknown>[];
  assert.doesNotThrow(() => trackGoogleCartAddition([line()], variant, 1));
  assert.doesNotThrow(() => trackGooglePageView("/collections/all"));
  assert.doesNotThrow(() => setGoogleConsent({analytics: false, advertising: false}));
  browser.document.head.appendChild = () => { throw new Error("CSP"); };
  configureGoogleTag(config);
  assert.doesNotThrow(() => setGoogleConsent(granted));
  browser.document.head.appendChild = node => { scripts.push(node.src); };
});

test("only page_view and add_to_cart exist; Purchase and checkout are never emitted", () => {
  assert.deepEqual([...GOOGLE_EVENTS], ["page_view", "add_to_cart"]);
  setGoogleConsent(granted); trackGooglePageView("/checkout"); trackGoogleCartAddition([line()], variant, 1);
  for (const call of events()) assert.ok(GOOGLE_EVENTS.includes(call[1] as never), String(call[1]));
  const sources = ["lib/google-tag.ts", "app/google-tag.tsx", "app/store-shell.tsx", "app/checkout/page.tsx"].map(path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  for (const source of sources) assert.doesNotMatch(source, /["'](purchase|begin_checkout|add_payment_info|conversion)["']/);
  const shell = sources[2];
  const checkout = shell.slice(shell.indexOf("const checkout=async"), shell.indexOf("const value={"));
  assert.ok(checkout.includes("window.location.assign(data.checkoutUrl)"));
  assert.doesNotMatch(checkout, /google|gtag/i, "checkout redirect stays independent of Google");
  assert.doesNotMatch(sources[3], /google|gtag/i);
});
