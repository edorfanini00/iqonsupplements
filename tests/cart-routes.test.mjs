import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Exercise the real route handlers, Shopify transport and mapping against a
// deterministic Shopify fixture. No credentials, orders or stock writes are used.
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
});
const bindingsUrl = dataUrl(`
  export const jar = new Map();
  export const cookieOptions = new Map();
  export const cookies = async () => ({
    get: key => jar.has(key) ? {value: jar.get(key)} : undefined,
    set: (key, value, options) => {jar.set(key, value); cookieOptions.set(key, options);}
  });
  export const headers = async () => new Headers();
`);
const { jar, cookieOptions } = await import(bindingsUrl);
const imports = {
  react: dataUrl("export const cache = fn => fn;"),
  "next/headers": bindingsUrl,
  "./catalog": dataUrl("export const products = [];"),
  "./merchandise": dataUrl(compile("../lib/merchandise.ts")),
  "./shopify-operations": dataUrl(compile("../lib/shopify-operations.ts")),
  "./shopify": dataUrl(compile("../lib/shopify.ts")),
};
const serverSource = compile("../lib/shopify.server.ts").replace(/from "([^"]+)"/g,
  (match, name) => imports[name] ? `from "${imports[name]}"` : match);
const routes = await import(dataUrl(serverSource));
const origin = "https://iqon.example";
const request = (body, path = "cart") => new Request(`${origin}/api/${path}`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const money = amount => ({amount: amount.toFixed(2), currencyCode: "USD"});
const fixtureProducts = [
  {handle: "creatine-monohydrate", category: "supplements", price: 29, variantId: "gid://shopify/ProductVariant/1"},
  {handle: "hydrolyzed-collagen-peptides", category: "supplements", price: 68, variantId: "gid://shopify/ProductVariant/2"},
  {handle: "hydra-c-ferulic-serum", category: "skincare", price: 89, variantId: "gid://shopify/ProductVariant/3"},
];

function fixture(t) {
  jar.clear(); cookieOptions.clear();
  const previous = {...process.env};
  process.env.SHOPIFY_STORE_DOMAIN = "iqon-test.myshopify.com";
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = "test-only-token";
  process.env.SHOPIFY_API_VERSION = "2026-07";
  t.after(() => {
    for (const key of ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "SHOPIFY_API_VERSION"])
      previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  });
  const state = {cart: null, serial: 0, available: true, operations: [], partialError: false};
  const recalculate = () => {
    const discount = state.cart.discountCodes.some(code => code.code === "SAVE10");
    let total = 0;
    for (const line of state.cart.lines.nodes) {
      const item = fixtureProducts.find(p => p.variantId === line.merchandise.id);
      const amount = item.price * line.quantity * (discount ? .9 : 1);
      line.cost = {totalAmount: money(amount)}; total += amount;
    }
    state.cart.totalQuantity = state.cart.lines.nodes.reduce((sum, line) => sum + line.quantity, 0);
    state.cart.cost = {subtotalAmount: money(total), totalAmount: money(total)};
  };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const {query, variables} = JSON.parse(options.body);
    const operation = query.match(/(?:query|mutation) (\w+)/)[1];
    state.operations.push(operation);
    if (operation === "IQONCatalog") return Response.json({data: {products: {
      pageInfo: {hasNextPage: false, endCursor: null}, nodes: fixtureProducts.map(p => ({
        handle: p.handle, title: p.handle, description: "Fixture", productType: "Fixture", tags: [`iqon-${p.category}`],
        availableForSale: state.available, requiresSellingPlan: false, images: {nodes: []},
        variants: {pageInfo: {hasNextPage: false}, nodes: [{id: p.variantId, title: "Default Title", availableForSale: state.available, price: money(p.price)}]},
      })),
    }}});
    if (operation === "IQONCartRead") return Response.json({data: {cart: state.cart?.id === variables.id ? state.cart : null}});
    let mutation;
    if (operation === "IQONCartCreate") {
      state.cart = {id: `gid://shopify/Cart/test-${++state.serial}?key=test-only-secret`, checkoutUrl: "https://iqon-test.myshopify.com/checkouts/test-only", discountCodes: [], lines: {pageInfo: {hasNextPage: false}, nodes: []}};
      mutation = "cartCreate";
    }
    if (operation === "IQONCartCreate" || operation === "IQONCartAdd") {
      mutation ||= "cartLinesAdd";
      for (const input of variables.input?.lines || variables.lines) {
        const existing = state.cart.lines.nodes.find(line => line.merchandise.id === input.merchandiseId);
        const item = fixtureProducts.find(p => p.variantId === input.merchandiseId);
        if (existing) existing.quantity += input.quantity;
        else state.cart.lines.nodes.push({id: `line-${item.handle}`, quantity: input.quantity,
          merchandise: {id: item.variantId, title: "Default Title", product: {handle: item.handle, title: item.handle}}});
      }
    } else if (operation === "IQONCartUpdate") {
      mutation = "cartLinesUpdate";
      for (const input of variables.lines) state.cart.lines.nodes.find(line => line.id === input.id).quantity = state.partialError ? 1 : input.quantity;
    } else if (operation === "IQONCartRemove") {
      mutation = "cartLinesRemove";
      state.cart.lines.nodes = state.cart.lines.nodes.filter(line => !variables.lineIds.includes(line.id));
    } else if (operation === "IQONCartDiscounts") {
      mutation = "cartDiscountCodesUpdate";
      state.cart.discountCodes = variables.discountCodes.map(code => ({code, applicable: code === "SAVE10"}));
    }
    assert.ok(mutation, `Unhandled fixture operation: ${operation}`);
    recalculate();
    return Response.json({data: {[mutation]: {cart: state.cart, warnings: [], userErrors: state.partialError ? [{message: "Only one is available."}] : []}}});
  });
  return state;
}
const add = item => routes.mutateCartResponse(request({action: "add", id: item.handle, variantId: item.variantId, quantity: 1}));

test("a supplement bag persists, updates, discounts and reaches hosted checkout", async t => {
  fixture(t);
  assert.equal((await routes.getCartResponse()).status, 200);
  assert.equal((await add(fixtureProducts[0])).status, 200);
  const cookie = cookieOptions.get("iqon_shopify_cart");
  assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, "lax");
  assert.equal((await add(fixtureProducts[1])).status, 200);
  let bag = await (await routes.getCartResponse()).json();
  assert.equal(bag.count, 2); assert.equal(bag.subtotal, 97);
  assert.ok(!JSON.stringify(bag).includes("test-only-secret"));
  assert.ok(!("checkoutUrl" in bag));
  const lineId = bag.items.find(item => item.id === "creatine-monohydrate").lineId;
  bag = await (await routes.mutateCartResponse(request({action: "update", lineId, quantity: 2}))).json();
  assert.equal(bag.subtotal, 126); assert.equal(bag.count, 3);
  bag = await (await routes.mutateCartResponse(request({action: "discount", discountCodes: [" save10 "]}))).json();
  assert.equal(bag.subtotal, 113.4); assert.deepEqual(bag.discountCodes, [{code: "SAVE10", applicable: true}]);
  const checkout = await routes.checkoutResponse(request({}, "checkout"));
  assert.equal(checkout.status, 200);
  assert.equal((await checkout.json()).checkoutUrl, "https://iqon-test.myshopify.com/checkouts/test-only");
  bag = await (await routes.mutateCartResponse(request({action: "discount", discountCodes: []}))).json();
  assert.equal(bag.subtotal, 126);
  bag = await (await routes.mutateCartResponse(request({action: "update", lineId, quantity: 0}))).json();
  assert.equal(bag.count, 1); assert.equal(bag.items[0].id, "hydrolyzed-collagen-peptides");
});

test("expired carts clear the buyer's stale selection and a later add creates a fresh cart", async t => {
  const state = fixture(t); await add(fixtureProducts[0]);
  const oldCookie = jar.get("iqon_shopify_cart"); state.cart = null;
  const response = await routes.checkoutResponse(request({}, "checkout"));
  assert.equal(response.status, 422); assert.deepEqual((await response.json()).cart.items, []);
  const update = await routes.mutateCartResponse(request({action: "update", lineId: "expired-line", quantity: 2}));
  assert.equal(update.status, 409); assert.deepEqual((await update.json()).cart.items, []);
  assert.equal((await add(fixtureProducts[1])).status, 200);
  assert.notEqual(jar.get("iqon_shopify_cart"), oldCookie);
});

test("unavailable inventory and mismatched variants cannot be purchased", async t => {
  const state = fixture(t); state.available = false;
  assert.equal((await add(fixtureProducts[0])).status, 422);
  assert.ok(!state.operations.includes("IQONCartCreate"));
  state.available = true;
  const response = await routes.mutateCartResponse(request({action: "add", id: fixtureProducts[0].handle, variantId: fixtureProducts[1].variantId, quantity: 1}));
  assert.equal(response.status, 422); assert.equal(state.cart, null);
});

test("Shopify quantity errors include the corrected public bag, never its checkout secret", async t => {
  const state = fixture(t); await add(fixtureProducts[0]); state.partialError = true;
  const response = await routes.mutateCartResponse(request({action: "update", lineId: state.cart.lines.nodes[0].id, quantity: 3}));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.cart.count, 1); assert.equal(body.error, "Only one is available.");
  assert.ok(!JSON.stringify(body).includes("test-only-secret"));
});

test("invalid discount codes remain removable and never fabricate savings", async t => {
  fixture(t); await add(fixtureProducts[1]);
  let response = await routes.mutateCartResponse(request({action: "discount", discountCodes: ["INVALID"]}));
  let bag = await response.json();
  assert.equal(response.status, 200); assert.equal(bag.subtotal, 68); assert.equal(bag.discountCodes[0].applicable, false);
  response = await routes.mutateCartResponse(request({action: "discount", discountCodes: "INVALID"}));
  assert.equal(response.status, 400);
  bag = await (await routes.mutateCartResponse(request({action: "discount", discountCodes: []}))).json();
  assert.deepEqual(bag.discountCodes, []);
});

test("cart and checkout reject cross-origin writes and unsafe checkout links", async t => {
  const state = fixture(t);
  const foreign = new Request(`${origin}/api/cart`, {method: "POST", headers: {Origin: "https://other.example", "Content-Type": "application/json"}, body: "{}"});
  assert.equal((await routes.mutateCartResponse(foreign)).status, 403);
  assert.equal((await routes.mutateCartResponse(request([]))).status, 400);
  await add(fixtureProducts[0]); state.cart.checkoutUrl = "http://iqon-test.myshopify.com/checkouts/test-only";
  assert.equal((await routes.checkoutResponse(request({}, "checkout"))).status, 502);
});


test("skincare remains coming soon even when Shopify has stock", async t => {
  const state = fixture(t);
  const catalog = await routes.getStoreCatalog();
  const skin = catalog.products.find(p => p.id === fixtureProducts[2].handle);
  assert.equal(skin.comingSoon, true);
  assert.equal(skin.available, false);
  assert.equal(catalog.products[0].available, true);
  const response = await add(fixtureProducts[2]);
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /coming soon/i);
  assert.ok(!state.operations.includes("IQONCartCreate"));
});

test("saved skincare lines cannot be increased or checked out but can be removed", async t => {
  const state = fixture(t);
  await add(fixtureProducts[0]);
  const line = state.cart.lines.nodes[0];
  const skin = fixtureProducts[2];
  line.merchandise = {id: skin.variantId, title: "Default Title", product: {handle: skin.handle, title: skin.handle}};
  const update = await routes.mutateCartResponse(request({action: "update", lineId: line.id, quantity: 2}));
  assert.equal(update.status, 422);
  assert.ok(!state.operations.includes("IQONCartUpdate"));
  const checkout = await routes.checkoutResponse(request({}, "checkout"));
  assert.equal(checkout.status, 422);
  const body = await checkout.json();
  assert.match(body.error, /coming soon/i);
  assert.ok(!body.checkoutUrl);
  const removed = await routes.mutateCartResponse(request({action: "update", lineId: line.id, quantity: 0}));
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).count, 0);
  await add(fixtureProducts[0]);
  assert.equal((await routes.checkoutResponse(request({}, "checkout"))).status, 200);
});
