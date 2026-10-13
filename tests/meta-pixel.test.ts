import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { initializePixel, isStorefrontPath, productPayload, resetProductView, trackCartAddition, trackPageView, trackViewContent } from "../lib/meta-pixel";
import type { CartItem } from "../lib/catalog";

const calls: unknown[][] = [];
const browser = {navigator: {globalPrivacyControl: false}, location: {pathname: "/", search: ""}, fbq: (...args: unknown[]) => calls.push(args)};
Object.defineProperty(globalThis, "window", {value: browser, configurable: true});
const product = {variantId: "gid://shopify/ProductVariant/52086268985639", name: "Creatine", price: 39.99, currency: "USD"};
beforeEach(() => {
  browser.location.pathname = "/account";
  trackPageView("/account");
  browser.location.pathname = "/";
  browser.navigator.globalPrivacyControl = false;
  calls.length = 0;
});
const events = (name: string) => calls.filter(call => call[0] === "track" && call[1] === name);

test("GPC blocks initialization, page, product and cart events", () => {
  browser.navigator.globalPrivacyControl = true;
  assert.equal(initializePixel(), false);
  trackPageView("/"); trackViewContent(product);
  trackCartAddition([], [line()], product.variantId);
  assert.equal(calls.filter(call => call[0] !== "consent").length, 0);
});
test("standard base initializes only once and suppresses automatic configuration", () => {
  initializePixel(); initializePixel();
  assert.equal(window.fbq?.disablePushState, true);
  assert.equal(calls.filter(call => call[0] === "init").length, 1);
  assert.deepEqual(calls[0], ["set", "autoConfig", false, "1006368245818889"]);
});
test("PageView deduplicates effect replay but tracks route/query changes and back navigation", () => {
  for (const route of ["/", "/", "/collections/all", "/collections/all?q=a", "/"]) trackPageView(route);
  assert.equal(events("PageView").length, 4);
});
test("account, affiliates and API routes are excluded, including nested routes", () => {
  for (const pathname of ["/account", "/account/privacy", "/affiliates", "/affiliates/admin", "/api/cart"]) {
    assert.equal(isStorefrontPath(pathname), false);
    browser.location.pathname = pathname;
    assert.equal(initializePixel(), false);
    trackPageView(pathname); trackViewContent(product); trackCartAddition([], [line()], product.variantId);
  }
  assert.equal(calls.filter(call => call[0] === "track").length, 0);
  for (const pathname of ["/", "/products/creatine", "/collections/all", "/checkout"]) assert.equal(isStorefrontPath(pathname), true);
});
test("product payload uses numeric catalog variant IDs, USD and total value", () => {
  assert.deepEqual(productPayload({...product, quantity: 2}), {
    content_ids: ["52086268985639"], content_type: "product", content_name: "Creatine", value: 79.98,
    currency: "USD", contents: [{id: "52086268985639", quantity: 2, item_price: 39.99}],
  });
  for (const invalid of [{variantId: "gid://shopify/Product/123"}, {price: NaN}, {price: -1}, {quantity: 0}, {quantity: 1.5}, {currency: "EUR"}]) {
    assert.equal(productPayload({...product, ...invalid}), null);
  }
});
test("ViewContent deduplicates repeated effects, tracks changed variants and later visits", () => {
  browser.location.pathname = "/products/creatine";
  trackViewContent(product); trackViewContent(product);
  trackViewContent({...product, variantId: "123"});
  resetProductView(); trackViewContent(product);
  assert.equal(events("ViewContent").length, 3);
});
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {id: "creatine", variantId: product.variantId, quantity: 2, amount: 70, name: "Creatine", currency: "USD", purchase: "once", frequency: "once", ...overrides};
}
test("AddToCart tracks confirmed quantity delta and returned price, not the full existing line", () => {
  trackCartAddition([line({quantity: 1})], [line()], product.variantId);
  assert.deepEqual(events("AddToCart")[0]?.[2], {...productPayload({...product, price: 35}), value: 35});
});
test("no AddToCart for no increase, removed/missing line, or missing amount", () => {
  trackCartAddition([line()], [line()], product.variantId);
  trackCartAddition([line()], [], product.variantId);
  trackCartAddition([], [line({amount: undefined})], product.variantId);
  assert.equal(events("AddToCart").length, 0);
});
test("subscription additions match their selling plan and use its actual price", () => {
  const plan = "gid://shopify/SellingPlan/456";
  trackCartAddition([line()], [line(), line({sellingPlanId: plan, amount: 50})], product.variantId, plan);
  const payload = events("AddToCart")[0]?.[2];
  assert.deepEqual(payload, productPayload({...product, price: 25, quantity: 2}));
});
