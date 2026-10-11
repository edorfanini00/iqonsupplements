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
  export const requestHeaders = new Headers({host: "iqon.example"});
  export const headers = async () => requestHeaders;
`);
const { jar, cookieOptions, requestHeaders } = await import(bindingsUrl);
const policyUrl = dataUrl(compile("../lib/commerce-policy.ts"));
const withPolicy = file => dataUrl(compile(file).replace('"./commerce-policy"', JSON.stringify(policyUrl)));
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const imports = {
  "./commerce-policy": policyUrl,
  "./privacy": privacyUrl,
  "./privacy.server": dataUrl(compile("../lib/privacy.server.ts").replace('"next/headers"', JSON.stringify(bindingsUrl)).replace('"./privacy"', JSON.stringify(privacyUrl))),
  react: dataUrl("export const cache = fn => fn;"),
  "next/headers": bindingsUrl,
  "./catalog": dataUrl("export const products = [];"),
  "./merchandise": withPolicy("../lib/merchandise.ts"),
  "./shopify-operations": dataUrl(compile("../lib/shopify-operations.ts")),
  "./shopify": withPolicy("../lib/shopify.ts"),
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
  {handle: "nmn", category: "supplements", price: 68, variantId: "gid://shopify/ProductVariant/2"},
  {handle: "hydra-c-ferulic-serum", category: "skincare", price: 68, variantId: "gid://shopify/ProductVariant/3"},
];

const plans = [{id:"gid://shopify/SellingPlan/10",name:"Deliver every month",price:26.10}, {id:"gid://shopify/SellingPlan/20",name:"Deliver every 2 months",price:27.55}];
const planAllocation = plan => ({sellingPlan:{id:plan.id,name:plan.name,recurringDeliveries:true,options:[{name:"Delivery",value:plan.name}],priceAdjustments:[{orderCount:null}]},priceAdjustments:[{price:money(plan.price),compareAtPrice:money(29),perDeliveryPrice:money(plan.price)}]});
function fixture(t) {
  jar.clear(); cookieOptions.clear(); requestHeaders.delete("sec-gpc");
  const previous = {...process.env};
  process.env.SHOPIFY_STORE_DOMAIN = "iqon-test.myshopify.com";
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = "test-only-token";
  process.env.SHOPIFY_API_VERSION = "2026-07";
  t.after(() => {
    for (const key of ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "SHOPIFY_API_VERSION"])
      previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  });
  const state = {cart: null, serial: 0, available: true, operations: [], partialError: false, requiresSellingPlan: false, consents: [], urls: [], checkoutError: false};
  const recalculate = () => {
    const discount = state.cart.discountCodes.some(code => code.code === "SAVE10");
    let total = 0;
    for (const line of state.cart.lines.nodes) {
      const item = fixtureProducts.find(p => p.variantId === line.merchandise.id);
      const selectedPlan = plans.find(p => p.id === line.sellingPlanAllocation?.sellingPlan.id);
      const amount = (selectedPlan?.price ?? item.price) * line.quantity * (discount ? .9 : 1);
      line.cost = {totalAmount: money(amount)}; total += amount;
    }
    state.cart.totalQuantity = state.cart.lines.nodes.reduce((sum, line) => sum + line.quantity, 0);
    state.cart.cost = {subtotalAmount: money(total), totalAmount: money(total)};
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const {query, variables} = JSON.parse(options.body);
    const operation = query.match(/(?:query|mutation) (\w+)/)[1];
    state.operations.push(operation); state.urls.push(url);
    if (operation === "IQONCheckoutCart") {
      // Stand in for Shopify: encode the contextual consent into the returned checkout URL.
      assert.match(query, /@inContext\(visitorConsent: \$visitorConsent\)/);
      if (state.checkoutError) return Response.json({errors: [{message: "fixture failure"}]});
      state.consents.push(variables.visitorConsent);
      const cart = state.cart?.id === variables.id ? state.cart : null;
      return Response.json({data: {cart: cart && {...cart, checkoutUrl: consentUrl(cart.checkoutUrl, variables.visitorConsent)}}});
    }
    if (operation === "IQONCatalog") return Response.json({data: {products: {
      pageInfo: {hasNextPage: false, endCursor: null}, nodes: fixtureProducts.map(p => ({
        handle: p.handle, title: p.handle, description: "Fixture", productType: "Fixture", tags: [`iqon-${p.category}`],
        availableForSale: state.available, requiresSellingPlan: state.requiresSellingPlan, images: {nodes: []},
        variants: {pageInfo: {hasNextPage: false}, nodes: [{id: p.variantId, title: "Default Title", availableForSale: state.available, price: money(p.price), sellingPlanAllocations:{pageInfo:{hasNextPage:false},nodes:p===fixtureProducts[0]?plans.map(planAllocation):[]}}]},
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
        const existing = state.cart.lines.nodes.find(line => line.merchandise.id === input.merchandiseId && line.sellingPlanAllocation?.sellingPlan.id === input.sellingPlanId);
        const item = fixtureProducts.find(p => p.variantId === input.merchandiseId);
        if (existing) existing.quantity += input.quantity;
        else state.cart.lines.nodes.push({id: `line-${item.handle}-${input.sellingPlanId?.split("/").at(-1)||"once"}`, quantity: input.quantity,
          sellingPlanAllocation:input.sellingPlanId ? planAllocation(plans.find(p=>p.id===input.sellingPlanId)) : null,
          merchandise: {id: item.variantId, title: "Default Title", product: {handle: item.handle, title: item.handle,tags:[`iqon-${item.category}`]}}});
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
const consentUrl = (base, consent) => consent ? `${base}?_cs=${Buffer.from(JSON.stringify(consent)).toString("base64url")}.sig%2Fx` : base;
const readConsent = url => {const value = new URL(url).searchParams.get("_cs"); return value ? JSON.parse(Buffer.from(value.split(".")[0], "base64url")) : null;};
const COOKIE = "__Host-iqon_privacy";
// Writes a saved decision the way the privacy route does; returns its version string.
let clock = Date.now() - 60_000;
const decide = (choices, revision = 1) => {
  const at = ++clock;
  jar.set(COOKIE, `v2.${["analytics", "marketing", "preferences", "saleOfData"].map(p => choices[p] === true ? "1" : choices[p] === false ? "0" : "n").join("")}.${revision}.${at}.${at - 1}`);
  for (const p of ["analytics", "marketing", "preferences", "saleOfData"]) choices[p] === false ? jar.set(`${COOKIE}_w_${p}`, `v1.${at}`) : jar.delete(`${COOKIE}_w_${p}`);
  return `${revision}.${at}.${["analytics", "marketing", "preferences", "saleOfData"].some(p => choices[p] === false) ? at : 0}`;
};
const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
const checkout = (body = {}, extra = {}) => routes.checkoutResponse(new Request(`${origin}/api/checkout`, {
  method: "POST", headers: {Origin: origin, "Content-Type": "application/json", ...extra}, body: typeof body === "string" ? body : JSON.stringify(body),
}));
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
  assert.equal(bag.count, 1); assert.equal(bag.items[0].id, "nmn");
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

test("one-time and subscription lines remain distinct and use exact Shopify prices", async t => {
  fixture(t);
  await add(fixtureProducts[0]);
  const subscribe=()=>routes.mutateCartResponse(request({action:"add",id:fixtureProducts[0].handle,variantId:fixtureProducts[0].variantId,quantity:1,purchase:"subscription",sellingPlanId:plans[0].id}));
  let response=await subscribe();assert.equal(response.status,200);
  let bag=await response.json();assert.equal(bag.items.length,2);assert.equal(bag.subtotal,55.1);
  const line=bag.items.find(i=>i.purchase==="subscription");
  assert.equal(line.sellingPlanId,plans[0].id);assert.equal(line.sellingPlanName,plans[0].name);assert.equal(line.amount,26.1);
  bag=await (await subscribe()).json();assert.equal(bag.items.length,2);assert.equal(bag.subtotal,81.2);
  bag=await (await routes.mutateCartResponse(request({action:"update",lineId:line.lineId,quantity:3}))).json();
  assert.equal(bag.items.find(i=>i.lineId===line.lineId).sellingPlanId,plans[0].id);assert.equal(bag.subtotal,107.3);
  assert.equal((await routes.checkoutResponse(request({},"checkout"))).status,200);
});

test("unavailable, cross-product and missing subscription plans are rejected", async t => {
  const state=fixture(t);
  const input={action:"add",id:fixtureProducts[0].handle,variantId:fixtureProducts[0].variantId,quantity:1,purchase:"subscription"};
  assert.equal((await routes.mutateCartResponse(request(input))).status,422);
  assert.equal((await routes.mutateCartResponse(request({...input,sellingPlanId:"invalid"}))).status,400);
  assert.equal((await routes.mutateCartResponse(request({...input,sellingPlanId:"gid://shopify/SellingPlan/999"}))).status,422);
  assert.equal((await routes.mutateCartResponse(request({...input,id:fixtureProducts[1].handle,variantId:fixtureProducts[1].variantId,sellingPlanId:plans[0].id}))).status,422);
  state.requiresSellingPlan=true;
  assert.equal((await add(fixtureProducts[0])).status,422);
  assert.equal(state.cart,null);
});

function insertOldSkincare(state) {
  const p=fixtureProducts[2];
  state.cart.lines.nodes.push({id:"old-skincare-line",quantity:1,cost:{totalAmount:money(p.price)},merchandise:{id:p.variantId,title:"Default Title",product:{handle:p.handle,title:p.handle,tags:["iqon-skincare"]}}});
  state.cart.totalQuantity++;
}

test("skincare cannot be added, even when Shopify reports available stock", async t => {
  fixture(t);
  const response=await add(fixtureProducts[2]);
  assert.equal(response.status,422);assert.match((await response.json()).error,/coming soon/i);
});

test("loading an old bag removes skincare and preserves supplements", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldSkincare(state);
  const bag=await (await routes.getCartResponse()).json();
  assert.equal(bag.items.length,1);assert.equal(bag.items[0].id,fixtureProducts[0].handle);assert.equal(bag.subtotal,29);
  assert.match(bag.notice,/coming soon/i);assert.ok(state.operations.includes("IQONCartRemove"));
});

test("checkout removes old skincare and requires review before handing off to Shopify", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldSkincare(state);
  const response=await routes.checkoutResponse(request({},"checkout"));
  assert.equal(response.status,422);
  const data=await response.json();assert.equal(data.cart.items.length,1);assert.ok(!data.checkoutUrl);
  assert.equal((await routes.checkoutResponse(request({},"checkout"))).status,200);
});

test("checkout sends the visitor's saved decision with a fresh contextual read: unknown, granted, denied", async t => {
  const state = fixture(t); await add(fixtureProducts[0]);
  let response = await checkout();
  assert.equal(response.status, 200);
  let data = await response.json();
  // No choice: nothing is invented, so Shopify receives no expressed preference.
  assert.equal(state.consents.at(-1), null); assert.equal(readConsent(data.checkoutUrl), null);
  assert.equal(data.privacyVersion, "0.0.0");
  const granted = decide(all(true), 3);
  data = await (await checkout()).json();
  assert.deepEqual(state.consents.at(-1), all(true)); assert.deepEqual(readConsent(data.checkoutUrl), all(true));
  assert.equal(data.privacyVersion, granted);
  decide({...all(true), marketing: false, saleOfData: false}, 4);
  const withdrawn = await (await checkout()).json();
  assert.deepEqual(readConsent(withdrawn.checkoutUrl), {analytics: true, preferences: true, marketing: false, saleOfData: false});
  assert.notEqual(withdrawn.checkoutUrl, data.checkoutUrl);
  // Every handoff performs its own contextual query; nothing is cached between them.
  assert.equal(state.operations.filter(op => op === "IQONCheckoutCart").length, 3);
  assert.ok(!state.operations.includes("IQONCartRead"));
});

test("checkout returns Shopify's URL byte for byte, including the signed _cs value", async t => {
  fixture(t); await add(fixtureProducts[0]); decide(all(false));
  const data = await (await checkout()).json();
  assert.match(data.checkoutUrl, /\?_cs=[A-Za-z0-9_-]+\.sig%2Fx$/);
  assert.equal(data.checkoutUrl, consentUrl("https://iqon-test.myshopify.com/checkouts/test-only", all(false)));
});

test("GPC from the header or the browser overrides a stored grant at checkout", async t => {
  const state = fixture(t); await add(fixtureProducts[0]); decide(all(true));
  const expected = {analytics: true, preferences: true, marketing: false, saleOfData: false};
  await checkout({}, {"Sec-GPC": "1"});
  assert.deepEqual(state.consents.at(-1), expected);
  await checkout({privacy: {gpc: true}});
  assert.deepEqual(state.consents.at(-1), expected);
  // A page cannot switch a GPC header off.
  await checkout({privacy: {gpc: false}}, {"Sec-GPC": "1"});
  assert.deepEqual(state.consents.at(-1), expected);
  decide(all(null));
  await checkout({}, {"Sec-GPC": "1"});
  assert.deepEqual(state.consents.at(-1), {marketing: false, saleOfData: false});
});

test("an unsaved withdrawal from the page applies at checkout, and the page can never add a grant", async t => {
  const state = fixture(t); await add(fixtureProducts[0]); decide(all(true));
  await checkout({privacy: {restrict: {marketing: false, saleOfData: false}}});
  assert.deepEqual(state.consents.at(-1), {analytics: true, preferences: true, marketing: false, saleOfData: false});
  decide(all(null));
  const before = state.consents.length;
  for (const body of [{privacy: {restrict: {marketing: true}}}, {privacy: {restrict: {marketing: null}}}, {privacy: {restrict: {ads: false}}},
    {privacy: {grant: {marketing: true}}}, {privacy: {gpc: "1"}}, {privacy: []}, {privacy: null}, {consent: all(true)}, [], "not json", "x".repeat(2000)]) {
    const response = await checkout(body);
    assert.ok([400, 413].includes(response.status), JSON.stringify(body).slice(0, 40));
    assert.ok(!("checkoutUrl" in await response.json()));
  }
  assert.equal(state.consents.length, before);
  // A forged unprefixed cookie cannot stand in for the host only decision cookie.
  jar.set("iqon_privacy", `v2.1111.9.${Date.now()}.0`);
  await checkout();
  assert.equal(state.consents.at(-1), null);
});

test("checkout fails closed on Shopify errors, keeps the bag, and never logs the checkout link", async t => {
  const state = fixture(t); await add(fixtureProducts[0]); decide(all(true));
  const logged = [];
  for (const method of ["log", "info", "warn", "error", "debug"]) t.mock.method(console, method, (...args) => logged.push(args.join(" ")));
  state.checkoutError = true;
  const failed = await checkout();
  assert.equal(failed.status, 502);
  const body = await failed.json();
  assert.ok(!("checkoutUrl" in body)); assert.match(body.error, /try again/i);
  // Shopping continues: the bag still reads and updates.
  const bag = await (await routes.getCartResponse()).json();
  assert.equal(bag.count, 1);
  assert.equal((await add(fixtureProducts[1])).status, 200);
  state.checkoutError = false;
  const ok = await (await checkout()).json();
  assert.ok(ok.checkoutUrl.includes("_cs="));
  assert.ok(!logged.some(line => /_cs=|checkouts\/|test-only-secret/.test(line)), "checkout links must not be logged");
});

test("the consent read uses Storefront API 2025-10 or later even if an older version is configured", async t => {
  const state = fixture(t); process.env.SHOPIFY_API_VERSION = "2025-04";
  await add(fixtureProducts[0]); decide(all(false));
  await checkout();
  const index = state.operations.lastIndexOf("IQONCheckoutCart");
  assert.equal(state.urls[index], "https://iqon-test.myshopify.com/api/2025-10/graphql.json");
  assert.equal(state.urls[state.operations.indexOf("IQONCartCreate")], "https://iqon-test.myshopify.com/api/2025-04/graphql.json");
  process.env.SHOPIFY_API_VERSION = "2026-07";
  await checkout();
  assert.equal(state.urls.at(-1), "https://iqon-test.myshopify.com/api/2026-07/graphql.json");
});

test("checkout after returning from Shopify uses the withdrawn decision, not the earlier grant", async t => {
  const state = fixture(t); await add(fixtureProducts[0]); const first_ = decide(all(true), 1);
  const first = await (await checkout()).json();
  // Visitor returns from hosted checkout and withdraws on the storefront.
  const withdrawn = decide({...all(true), marketing: false}, 2);
  const second = await (await checkout()).json();
  assert.notEqual(second.checkoutUrl, first.checkoutUrl);
  assert.equal(readConsent(second.checkoutUrl).marketing, false);
  assert.equal(second.privacyVersion, withdrawn); assert.notEqual(second.privacyVersion, first_);
  // Concurrent handoffs each read the decision current at their own request.
  const [a, b] = await Promise.all([checkout(), checkout({privacy: {restrict: {analytics: false}}})]);
  assert.equal(readConsent((await a.json()).checkoutUrl).analytics, true);
  assert.equal(readConsent((await b.json()).checkoutUrl).analytics, false);
  assert.equal(state.consents.length, 4);
});

test("checkout refuses a link when the page shows a different decision than the one saved", async t => {
  const state = fixture(t); await add(fixtureProducts[0]);
  const shown = decide(all(true), 1);
  decide(all(false), 2); // saved in another tab after this page last read it
  const before = state.consents.length;
  const response = await checkout({privacy: {version: shown}});
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.privacyChanged, true); assert.ok(!("checkoutUrl" in body));
  assert.equal(state.consents.length, before, "no contextual read happens for a stale page");
  for (const version of [5, "x".repeat(65), null]) assert.equal((await checkout({privacy: {version}})).status, 400);
});

test("a withdrawal cookie outranks a grant that had not seen it at checkout", async t => {
  const state = fixture(t); await add(fixtureProducts[0]);
  const at = Date.now() - 1000;
  jar.set(COOKIE, `v2.1111.3.${at}.${at - 500}`);
  jar.set(`${COOKIE}_w_marketing`, `v1.${at - 100}`);
  await checkout();
  assert.deepEqual(state.consents.at(-1), {...all(true), marketing: false});
});
