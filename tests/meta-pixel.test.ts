import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { initializePixel, isStorefrontPath, productPayload, resetProductView, syncPixelConsent, trackCartAddition, trackPageView, trackViewContent } from "../lib/meta-pixel";
import type { CartItem } from "../lib/catalog";

const calls: unknown[][] = [];
const consent={marketing:true,sale:true,status:'loaded'};
const native={get consentStatus(){return consent.status},marketingAllowed:()=>consent.marketing,saleOfDataAllowed:()=>consent.sale,analyticsProcessingAllowed:()=>false,preferencesProcessingAllowed:()=>true};
const browser = {Shopify:{customerPrivacy:native},navigator: {globalPrivacyControl: false}, location: {pathname: "/", search: ""}, fbq: (...args: unknown[]) => calls.push(args)};
Object.defineProperty(globalThis, "window", {value: browser, configurable: true});
Object.defineProperty(globalThis,"navigator",{value:browser.navigator,configurable:true});
const product = {variantId: "gid://shopify/ProductVariant/52086268985639", name: "Creatine", price: 39.99, currency: "USD"};
beforeEach(() => {
  consent.marketing=true;consent.sale=true;consent.status="loaded";
  browser.location.pathname = "/account";
  trackPageView("/account");
  browser.location.pathname = "/";
  browser.navigator.globalPrivacyControl = false;
  calls.length = 0;
});
const events = (name: string) => calls.filter(call => call[0] === "trackSingle" && call[1] === "1006368245818889" && call[2] === name).map(call => ["track", ...call.slice(2)]);

test("GPC blocks initialization, page, product and cart events", () => {
  browser.navigator.globalPrivacyControl = true;
  assert.equal(initializePixel(), false);
  trackPageView("/"); trackViewContent(product);
  trackCartAddition([line()], product.variantId, 1);
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
    trackPageView(pathname); trackViewContent(product); trackCartAddition([line()], product.variantId, 1);
  }
  assert.equal(calls.filter(call => call[0] === "trackSingle").length, 0);
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
test("AddToCart tracks this successful request, not the full existing line", () => {
  trackCartAddition([line()], product.variantId, 1);
  assert.deepEqual(events("AddToCart")[0]?.[2], {...productPayload({...product, price: 35}), value: 35});
});
test("expired-cart replacement still tracks the successful addition", () => {
  // The tab could have cached quantity 2, but Shopify replaced its expired cart.
  trackCartAddition([line({quantity: 1, amount: 39.99})], product.variantId, 1);
  assert.deepEqual(events("AddToCart")[0]?.[2], productPayload(product));
});
test("another tab's addition is not counted again in this request", () => {
  // Cached quantity 1 -> other tab adds 1 -> this successful request adds 1.
  trackCartAddition([line({quantity: 3, amount: 119.97})], product.variantId, 1);
  assert.deepEqual(events("AddToCart")[0]?.[2], productPayload(product));
});
test("no AddToCart for absent line, missing price, or invalid request quantity", () => {
  trackCartAddition([], product.variantId, 1);
  trackCartAddition([line({amount: undefined})], product.variantId, 1);
  for (const quantity of [0, -1, 1.5, NaN]) trackCartAddition([line()], product.variantId, quantity);
  assert.equal(events("AddToCart").length, 0);
});
test("quantity cannot exceed the returned line if Shopify adjusts it", () => {
  trackCartAddition([line({quantity: 1, amount: 39.99})], product.variantId, 2);
  assert.deepEqual(events("AddToCart")[0]?.[2], productPayload(product));
});
test("subscription additions match their selling plan and use its actual price", () => {
  const plan = "gid://shopify/SellingPlan/456";
  trackCartAddition([line(), line({sellingPlanId: plan, amount: 50})], product.variantId, 2, plan);
  assert.deepEqual(events("AddToCart")[0]?.[2], productPayload({...product, price: 25, quantity: 2}));
});

for(const state of [{status:'loading',marketing:true,sale:true},{status:'loaded',marketing:false,sale:true},{status:'loaded',marketing:true,sale:false}])test(`native consent blocks every entrypoint: ${JSON.stringify(state)}`,()=>{
  Object.assign(consent,state);
  assert.equal(initializePixel(),false);trackPageView('/');trackViewContent(product);trackCartAddition([line()],product.variantId,1);
  assert.equal(calls.filter(call=>call[0]!=='consent').length,0);
});
test('withdrawal discards unsent events, revokes Meta and permits fresh consented events after resumption',()=>{
  trackPageView('/');trackViewContent(product);
  const queue=[['trackSingle','1006368245818889','AddToCart']];Object.assign(browser.fbq,{queue});
  consent.marketing=false;consent.sale=false;
  assert.equal(syncPixelConsent(),true);assert.equal(queue.length,0);assert.deepEqual(calls.at(-1),['consent','revoke']);
  calls.length=0;trackPageView('/');trackViewContent(product);trackCartAddition([line()],product.variantId,1);
  assert.equal(calls.filter(call=>call[0]==='trackSingle').length,0);
  consent.marketing=true;consent.sale=true;
  trackPageView('/');trackViewContent(product);trackCartAddition([line()],product.variantId,1);
  assert.equal(events('PageView').length,1);assert.equal(events('ViewContent').length,1);assert.equal(events('AddToCart').length,1);
});
