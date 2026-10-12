// Pure rules for storefront Meta events (lib/meta-storefront.ts). Run with `node --import tsx --test`.
import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../../lib/meta-storefront.ts";

const CREATINE = "gid://shopify/ProductVariant/52086268985639", GLP1 = "gid://shopify/ProductVariant/52086119760167";
const parse = url => { const u = new URL(url); return Object.fromEntries(u.searchParams); };

test("only home, supplement collections and reviewed product pages are trackable", () => {
  for (const path of ["/", "/collections/all", "/collections/supplements", "/products/creatine-monohydrate", "/products/hydrolyzed-collagen-peptides", "/products/colostrum-powder"]) assert.ok(m.trackablePath(path), path);
  for (const path of ["/products/glp-1-support", "/products/liver-support", "/products/keto-5", "/products/colon-gentle-cleanse", "/products/nmn", "/account", "/account/privacy", "/account/orders/1",
    "/help", "/journal", "/journal/x", "/affiliates", "/checkout", "/collections/skincare", "/skincare", "/approach", "/reviews", "/products/creatine-monohydrate/", "/products/Creatine-Monohydrate"]) assert.ok(!m.trackablePath(path), path);
});

test("event URL: fixed parameters only, page URL without query or fragment, no event on other routes", () => {
  const url = m.storefrontEventUrl("PageView", "0123456789abcdef", "https://www.iqonbody.com/collections/all?email=a%40b.c&utm_source=x#frag");
  assert.deepEqual(parse(url), {id: "1006368245818889", ev: "PageView", eid: "0123456789abcdef", dl: "https://www.iqonbody.com/collections/all", noscript: "1"});
  assert.ok(!url.includes("email") && !url.includes("frag"));
  assert.equal(m.storefrontEventUrl("PageView", "0123456789abcdef", "https://www.iqonbody.com/products/glp-1-support"), null);
  assert.equal(m.storefrontEventUrl("PageView", "short", "https://www.iqonbody.com/"), null);
  assert.equal(m.storefrontEventUrl("ViewContent", "0123456789abcdef", "https://www.iqonbody.com/"), null, "product events need a payload");
});

test("product payloads: reviewed variants only, numeric IDs, no names", () => {
  const url = m.storefrontEventUrl("AddToCart", "0123456789abcdef", "https://www.iqonbody.com/products/creatine-monohydrate", {value: 58, currency: "USD", contents: [{id: CREATINE, quantity: 2}]});
  assert.deepEqual(parse(url), {id: "1006368245818889", ev: "AddToCart", eid: "0123456789abcdef", dl: "https://www.iqonbody.com/products/creatine-monohydrate", noscript: "1",
    "cd[value]": "58", "cd[currency]": "USD", "cd[content_type]": "product", "cd[content_ids]": '["52086268985639"]', "cd[contents]": '[{"id":"52086268985639","quantity":2}]', "cd[num_items]": "2"});
  for (const payload of [{value: 1, currency: "USD", contents: [{id: GLP1, quantity: 1}]}, {value: 1, currency: "USD", contents: []}, {value: -1, currency: "USD", contents: [{id: CREATINE, quantity: 1}]},
    {value: 1, currency: "usd", contents: [{id: CREATINE, quantity: 1}]}, {value: 1, currency: "USD", contents: [{id: CREATINE, quantity: 0}]}]) {
    assert.equal(m.storefrontEventUrl("AddToCart", "0123456789abcdef", "https://www.iqonbody.com/", payload), null, JSON.stringify(payload));
  }
  assert.ok(m.cartEligible([CREATINE, "gid://shopify/ProductVariant/52086149480743"]));
  assert.ok(!m.cartEligible([CREATINE, GLP1]));
  assert.ok(!m.cartEligible([CREATINE, undefined]));
  assert.ok(!m.cartEligible([]));
});
