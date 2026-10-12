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
const policyUrl = dataUrl(compile("../lib/commerce-policy.ts"));
const withPolicy = file => dataUrl(compile(file).replace('"./commerce-policy"', JSON.stringify(policyUrl)));
const imports = {
  "./commerce-policy": policyUrl,
  react: dataUrl("export const cache = fn => fn;"),
  "next/headers": bindingsUrl,
  "./catalog": dataUrl("export const products = [];"),
  "./merchandise": withPolicy("../lib/merchandise.ts"),
  "./shopify-operations": dataUrl(compile("../lib/shopify-operations.ts")),
  "./shopify": withPolicy("../lib/shopify.ts"),
  "./ad-privacy": dataUrl(compile("../lib/ad-privacy.ts")),
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
  jar.clear(); cookieOptions.clear();
  const previous = {...process.env};
  process.env.SHOPIFY_STORE_DOMAIN = "iqon-test.myshopify.com";
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = "test-only-token";
  process.env.SHOPIFY_API_VERSION = "2026-07";
  t.after(() => {
    for (const key of ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "SHOPIFY_API_VERSION"])
      previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  });
  const state = {cart: null, serial: 0, available: true, operations: [], partialError: false, requiresSellingPlan: false, contexts: [], failContext: 0, failAttributes: 0, contextCart: undefined};
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
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const {query, variables} = JSON.parse(options.body);
    const operation = query.match(/(?:query|mutation) (\w+)/)[1];
    state.operations.push(operation);
    if (operation === "IQONCatalog") return Response.json({data: {products: {
      pageInfo: {hasNextPage: false, endCursor: null}, nodes: fixtureProducts.map(p => ({
        handle: p.handle, title: p.handle, description: "Fixture", productType: "Fixture", tags: [`iqon-${p.category}`],
        availableForSale: state.available, requiresSellingPlan: state.requiresSellingPlan, images: {nodes: []},
        variants: {pageInfo: {hasNextPage: false}, nodes: [{id: p.variantId, title: "Default Title", availableForSale: state.available, price: money(p.price), sellingPlanAllocations:{pageInfo:{hasNextPage:false},nodes:p===fixtureProducts[0]?plans.map(planAllocation):[]}}]},
      })),
    }}});
    if (operation === "IQONCartRead") return Response.json({data: {cart: state.cart?.id === variables.id ? state.cart : null}});
    if (operation === "IQONCartCheckout") {
      // Synthetic stand-in for Shopify's opaque `_cs`: the fixture records the consent it was given.
      state.contexts.push(variables.consent);
      if (state.failContext > 0) { state.failContext--; return new Response("unavailable", {status: 503}); }
      if (state.contextCart !== undefined) return Response.json({data: {cart: state.contextCart}});
      const cart = state.cart?.id === variables.id ? {...state.cart, checkoutUrl: `${state.cart.checkoutUrl}?_cs=${encodeURIComponent(JSON.stringify(variables.consent))}`} : null;
      return Response.json({data: {cart}});
    }
    if (operation === "IQONCartAttributes") {
      if (state.failAttributes > 0) { state.failAttributes--; return new Response("unavailable", {status: 503}); }
      state.cart.attributes = variables.attributes;
      return Response.json({data: {cartAttributesUpdate: {cart: state.cart, warnings: [], userErrors: []}}});
    }
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

// ── Advertising privacy handoff (docs/ad-tracking.md) ────────────────────────────────────────
const CHOICE = {granted: "v1.g.AAAAAAAAAAAAAAAAAAAAAA", denied: "v1.d.BBBBBBBBBBBBBBBBBBBBBB"};
const checkoutRequest = ({cookie, gpc, body = {}} = {}) => new Request(`${origin}/api/checkout`, {
  method: "POST", body: JSON.stringify(body),
  headers: {Origin: origin, "Content-Type": "application/json", ...(cookie ? {Cookie: cookie} : {}), ...(gpc ? {"Sec-GPC": "1"} : {})},
});
const consentOf = url => { const value = new URL(url).searchParams.get("_cs"); return value === null ? null : JSON.parse(value); };
const restrictionOf = state => (state.cart.attributes || []).find(a => a.key === "_iqon_ad_restriction")?.value ?? null;
function controls(t, value = "on") {
  const previous = process.env.AD_PRIVACY_CONTROLS;
  if (value === "unset") delete process.env.AD_PRIVACY_CONTROLS; else process.env.AD_PRIVACY_CONTROLS = value;
  t.after(() => previous === undefined ? delete process.env.AD_PRIVACY_CONTROLS : process.env.AD_PRIVACY_CONTROLS = previous);
}
async function checkoutWith(t, options) {
  const response = await routes.checkoutResponse(checkoutRequest(options));
  return {status: response.status, data: await response.json(), setCookie: response.headers.get("set-cookie")};
}

test("ad controls off: checkout is unchanged, GPC and body signals are not used, no extra Shopify calls", async t => {
  controls(t, "unset");
  const state = fixture(t); await add(fixtureProducts[0]); state.operations.length = 0;
  for (const options of [{}, {gpc: true}, {body: {gpc: true, restrict: true}}]) {
    const {status, data} = await checkoutWith(t, options);
    assert.equal(status, 200);
    assert.deepEqual(data, {checkoutUrl: "https://iqon-test.myshopify.com/checkouts/test-only", choice: "none"});
  }
  assert.deepEqual(state.operations, ["IQONCartRead", "IQONCartRead", "IQONCartRead"]);
  assert.equal(restrictionOf(state), null);
});

test("ad controls off still honour an opt-out already stored in this browser", async t => {
  controls(t, "unset");
  const state = fixture(t); await add(fixtureProducts[0]);
  const {status, data} = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.denied}`});
  assert.equal(status, 200);
  assert.deepEqual(consentOf(data.checkoutUrl), {marketing: false, saleOfData: false});
  assert.equal(restrictionOf(state), "denied");
  assert.equal(data.choice, "BBBBBBBBBBBBBBBBBBBBBB");
});

test("no choice and no GPC: the exact plain checkout path (Shopify regional defaults apply at checkout)", async t => {
  controls(t);
  const state = fixture(t); await add(fixtureProducts[0]); state.operations.length = 0;
  const {data} = await checkoutWith(t, {cookie: "other=1; iqon_ad_choice=garbage"});
  assert.deepEqual(data, {checkoutUrl: "https://iqon-test.myshopify.com/checkouts/test-only", choice: "none"});
  assert.deepEqual(state.operations, ["IQONCartRead"]);
});

test("GPC (header or page) restricts the cart and sends only saleOfData:false", async t => {
  controls(t);
  for (const options of [{gpc: true}, {body: {gpc: true}}]) {
    const state = fixture(t); await add(fixtureProducts[0]);
    const {data} = await checkoutWith(t, options);
    assert.deepEqual(consentOf(data.checkoutUrl), {saleOfData: false});
    assert.equal(restrictionOf(state), "gpc");
    assert.equal(data.consentHandoff, "sent");
  }
});

test("opt-out restricts the cart, keeps other attributes, sends a full denial, and is never cleared by a later grant", async t => {
  controls(t);
  const state = fixture(t); await add(fixtureProducts[0]);
  state.cart.attributes = [{key: "gift_note", value: "hello"}, {key: "_iqon_ad_restriction", value: ""}];
  let result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.denied}`});
  assert.deepEqual(consentOf(result.data.checkoutUrl), {marketing: false, saleOfData: false});
  assert.deepEqual(state.cart.attributes, [{key: "gift_note", value: "hello"}, {key: "_iqon_ad_restriction", value: "denied"}]);
  state.operations.length = 0;
  await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.denied}`});
  assert.ok(!state.operations.includes("IQONCartAttributes"), "an existing restriction is not rewritten");
  result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}`});
  assert.deepEqual(consentOf(result.data.checkoutUrl), {marketing: true, saleOfData: true});
  assert.equal(restrictionOf(state), "denied", "a re-grant applies to the next cart, never by clearing this one");
  assert.equal(result.setCookie, null, "checkout never writes the choice cookie");
});

test("allow passes the visitor's grant (sale of data still off under GPC); nothing in a body can grant", async t => {
  controls(t);
  let state = fixture(t); await add(fixtureProducts[0]);
  let {data} = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}`});
  assert.deepEqual(consentOf(data.checkoutUrl), {marketing: true, saleOfData: true});
  assert.equal(restrictionOf(state), null);
  assert.equal(data.choice, "AAAAAAAAAAAAAAAAAAAAAA");
  ({data} = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}`, gpc: true}));
  assert.deepEqual(consentOf(data.checkoutUrl), {marketing: true, saleOfData: false});
  assert.equal(restrictionOf(state), "gpc");
  state = fixture(t); await add(fixtureProducts[0]);
  ({data} = await checkoutWith(t, {body: {marketing: true, saleOfData: true, grant: true, choice: CHOICE.granted}}));
  assert.equal(consentOf(data.checkoutUrl), null);
  ({data} = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}`, body: {restrict: true}}));
  assert.deepEqual(consentOf(data.checkoutUrl), {marketing: false, saleOfData: false}, "an in-memory opt-out overrides a stored grant");
  assert.equal(restrictionOf(state), "denied");
});

test("duplicate choice cookies resolve restrictively; malformed values are no choice", async t => {
  controls(t);
  const state = fixture(t); await add(fixtureProducts[0]);
  const {data} = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}; iqon_ad_choice=${CHOICE.denied}`});
  assert.deepEqual(consentOf(data.checkoutUrl), {marketing: false, saleOfData: false});
  for (const bad of ["v1.g.short", "v2.g.AAAAAAAAAAAAAAAAAAAAAA", "v1.x.AAAAAAAAAAAAAAAAAAAAAA", "v1.g.AAAAAAAAAAAAAAAAAAAAAA.extra", "", "off"]) {
    const fresh = fixture(t); await add(fixtureProducts[0]);
    const result = await checkoutWith(t, {cookie: `iqon_ad_choice=${bad}`});
    assert.equal(consentOf(result.data.checkoutUrl), null, bad);
    assert.equal(restrictionOf(fresh), null, bad);
  }
  void state;
});

test("context failures: grants fall back to Shopify defaults; opt-outs stay restricted or checkout waits", async t => {
  controls(t);
  // Grant: one retry, then the plain URL (Shopify's regional default; never broader than the visitor chose).
  let state = fixture(t); await add(fixtureProducts[0]); state.failContext = 2;
  let result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}`});
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, {checkoutUrl: "https://iqon-test.myshopify.com/checkouts/test-only", choice: "AAAAAAAAAAAAAAAAAAAAAA", consentHandoff: "unavailable"});
  assert.equal(state.contexts.length, 2, "bounded: one retry");
  // Opt-out with the cart restricted: plain URL is safe because the pixel refuses restricted carts.
  state = fixture(t); await add(fixtureProducts[0]); state.failContext = 2;
  result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.denied}`});
  assert.equal(result.status, 200); assert.equal(result.data.consentHandoff, "unavailable");
  assert.equal(restrictionOf(state), "denied");
  // Opt-out, both channels failing: no unrestricted checkout URL is returned.
  state = fixture(t); await add(fixtureProducts[0]); state.failContext = 2; state.failAttributes = 1;
  result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.denied}`});
  assert.equal(result.status, 503); assert.ok(!result.data.checkoutUrl);
  assert.match(result.data.error, /temporarily unavailable/);
  // Opt-out, attribute failing but context succeeding: the denial still reaches checkout.
  state = fixture(t); await add(fixtureProducts[0]); state.failAttributes = 1;
  result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.denied}`});
  assert.equal(result.status, 200); assert.deepEqual(consentOf(result.data.checkoutUrl), {marketing: false, saleOfData: false});
  // A transient first failure is retried and the context still sent.
  state = fixture(t); await add(fixtureProducts[0]); state.failContext = 1;
  result = await checkoutWith(t, {gpc: true});
  assert.deepEqual(consentOf(result.data.checkoutUrl), {saleOfData: false}); assert.equal(state.contexts.length, 2);
  // A context answer for another (or no) cart is not used.
  for (const contextCart of [null, {id: "gid://shopify/Cart/other", checkoutUrl: "https://iqon-test.myshopify.com/checkouts/other"}]) {
    state = fixture(t); await add(fixtureProducts[0]); state.contextCart = contextCart;
    result = await checkoutWith(t, {cookie: `iqon_ad_choice=${CHOICE.granted}`});
    assert.equal(result.data.checkoutUrl, "https://iqon-test.myshopify.com/checkouts/test-only");
    assert.equal(result.data.consentHandoff, "unavailable");
  }
});

test("checkout signal bodies are bounded and validated", async t => {
  controls(t);
  fixture(t); await add(fixtureProducts[0]);
  const raw = body => routes.checkoutResponse(new Request(`${origin}/api/checkout`, {method: "POST", body, headers: {Origin: origin, "Content-Type": "application/json"}}));
  assert.equal((await raw("x".repeat(2000))).status, 413);
  assert.equal((await raw("{not json")).status, 400);
  assert.equal((await raw("")).status, 200);
  assert.equal((await raw("[1,2]")).status, 200);
});

test("/api/ad-choice restricts the current cart only, never grants, and is off without the flag", async t => {
  controls(t, "unset");
  let state = fixture(t);
  const choiceRequest = (headers = {}) => new Request(`${origin}/api/ad-choice`, {method: "POST", body: "{}", headers: {Origin: origin, "Content-Type": "application/json", ...headers}});
  assert.equal((await routes.restrictCartResponse(choiceRequest())).status, 404);
  controls(t);
  assert.deepEqual(await (await routes.restrictCartResponse(choiceRequest())).json(), {restricted: false});
  await add(fixtureProducts[0]);
  assert.equal((await routes.restrictCartResponse(choiceRequest({Origin: "https://evil.example"}))).status, 403);
  assert.equal(restrictionOf(state), null);
  const response = await routes.restrictCartResponse(choiceRequest({Cookie: `iqon_ad_choice=${CHOICE.granted}`}));
  assert.deepEqual(await response.json(), {restricted: true});
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(restrictionOf(state), "denied");
  state.failAttributes = 1;
  state.cart.attributes = [];
  assert.equal((await routes.restrictCartResponse(choiceRequest())).status, 502);
});
