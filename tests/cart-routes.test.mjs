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

// Mirrors the Shopify automatic bundle discounts: any mix of eligible units, best single tier.
const ELIGIBLE = new Set(["creatine-monohydrate", "nmn"]);
const TIERS = [{min: 3, rate: .25, title: "Bundle: Buy 3, save 25%"}, {min: 2, rate: .10, title: "Bundle: Buy 2, save 10%"}];
const plan = {id: "gid://shopify/SellingPlan/10", name: "Deliver every month"};
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
  const state = {cart: null, serial: 0, available: true, operations: [], addedLines: [], partialError: false, requiresSellingPlan: false, bundles: false};
  // SAVE10 is a product code; ORDER5 a $5 order (cart level) code. Codes do not combine with the bundle tiers.
  const recalculate = () => {
    const code = state.cart.discountCodes.some(code => code.code === "SAVE10");
    const units = state.cart.lines.nodes.filter(line => ELIGIBLE.has(line.merchandise.product.handle)).reduce((n, line) => n + line.quantity, 0);
    const tier = state.bundles && !code ? TIERS.find(t => units >= t.min) : undefined;
    let total = 0;
    for (const line of state.cart.lines.nodes) {
      const item = fixtureProducts.find(p => p.variantId === line.merchandise.id);
      const gross = Math.round(item.price * line.quantity * 100);
      const rate = code ? .1 : tier && ELIGIBLE.has(item.handle) ? tier.rate : 0;
      const saved = Math.round(gross * rate);
      line.cost = {subtotalAmount: money(gross / 100), totalAmount: money((gross - saved) / 100)};
      line.discountAllocations = saved ? [{discountedAmount: money(saved / 100), ...(code ? {code: "SAVE10"} : {title: tier.title})}] : [];
      total += gross - saved;
    }
    const order = state.cart.discountCodes.some(code => code.code === "ORDER5") && total >= 500 ? 500 : 0;
    state.cart.discountAllocations = order ? [{discountedAmount: money(order / 100), code: "ORDER5"}] : [];
    state.cart.totalQuantity = state.cart.lines.nodes.reduce((sum, line) => sum + line.quantity, 0);
    state.cart.cost = {subtotalAmount: money(total / 100), totalAmount: money((total - order) / 100)};
  };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const {query, variables} = JSON.parse(options.body);
    const operation = query.match(/(?:query|mutation) (\w+)/)[1];
    state.operations.push(operation);
    if (operation === "IQONCatalog") return Response.json({data: {products: {
      pageInfo: {hasNextPage: false, endCursor: null}, nodes: fixtureProducts.map(p => ({
        handle: p.handle, title: p.handle, description: "Fixture", productType: "Fixture", tags: [`iqon-${p.category}`],
        availableForSale: state.available, requiresSellingPlan: state.requiresSellingPlan, images: {nodes: []},
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
        state.addedLines.push(input);
        const existing = state.cart.lines.nodes.find(line => line.merchandise.id === input.merchandiseId && !line.sellingPlanAllocation && !input.sellingPlanId);
        const item = fixtureProducts.find(p => p.variantId === input.merchandiseId);
        if (existing) existing.quantity += input.quantity;
        else state.cart.lines.nodes.push({id: `line-${item.handle}-${input.sellingPlanId ? "plan" : "once"}`, quantity: input.quantity,
          sellingPlanAllocation: input.sellingPlanId ? {sellingPlan: {...plan, options: [{name: "Delivery", value: "Monthly"}]}} : null,
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
      state.cart.discountCodes = variables.discountCodes.map(code => ({code, applicable: code === "SAVE10" || code === "ORDER5"}));
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

test("new lines are one time only: no selling plan reaches Shopify, whatever the request says", async t => {
  const state=fixture(t);
  const base={action:"add",id:fixtureProducts[0].handle,variantId:fixtureProducts[0].variantId,quantity:1};
  for (const input of [{...base,purchase:"subscription"},{...base,sellingPlanId:plan.id},{...base,purchase:"once",sellingPlanId:plan.id},{...base,sellingPlanId:"invalid"},{...base,purchase:"monthly"}]) {
    const response=await routes.mutateCartResponse(request(input));
    assert.equal(response.status,422,JSON.stringify(input));assert.match((await response.json()).error,/no longer offered/);
  }
  assert.equal(state.cart,null);assert.deepEqual(state.addedLines,[]);
  assert.equal((await routes.mutateCartResponse(request({...base,purchase:"once"}))).status,200);
  assert.equal((await add(fixtureProducts[1])).status,200);
  assert.deepEqual(state.addedLines.map(line=>Object.keys(line).sort()),[["merchandiseId","quantity"],["merchandiseId","quantity"]]);
  state.requiresSellingPlan=true;
  assert.equal((await add(fixtureProducts[0])).status,422,"a subscription only product cannot be bought");
});

test("a subscription line from an older bag still shows as a subscription and can be changed or removed", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);
  state.cart.lines.nodes.push({id:"old-plan-line",quantity:1,sellingPlanAllocation:{sellingPlan:{...plan,options:[{name:"Delivery",value:"Monthly"}]}},
    merchandise:{id:fixtureProducts[1].variantId,title:"Default Title",product:{handle:"nmn",title:"nmn",tags:["iqon-supplements"]}}});
  let bag=await (await routes.mutateCartResponse(request({action:"update",lineId:"old-plan-line",quantity:2}))).json();
  const old=bag.items.find(item=>item.lineId==="old-plan-line");
  assert.equal(old.purchase,"subscription");assert.equal(old.sellingPlanId,plan.id);assert.equal(old.quantity,2);
  bag=await (await routes.mutateCartResponse(request({action:"update",lineId:"old-plan-line",quantity:0}))).json();
  assert.deepEqual(bag.items.map(item=>item.purchase),["once"]);
});

test("bundle savings come from Shopify's allocations, mix and match, and reconcile to its cart cost", async t => {
  const state=fixture(t);state.bundles=true;
  let bag=await (await add(fixtureProducts[0])).json();
  assert.equal(bag.subtotal,29);assert.deepEqual(bag.lineDiscounts,[]);assert.equal(bag.merchandise,29);
  bag=await (await routes.mutateCartResponse(request({action:"update",lineId:bag.items[0].lineId,quantity:2}))).json();
  assert.equal(bag.merchandise,58);assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 2, save 10%",amount:5.8}]);
  assert.equal(bag.subtotal,52.2);assert.equal(bag.items[0].amount,52.2);assert.equal(bag.items[0].compareAmount,58);
  bag=await (await add(fixtureProducts[1])).json();
  // 2 creatine + 1 NMN: the 25% tier applies once, across both products, never stacked with 10%.
  assert.equal(bag.merchandise,126);assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:31.5}]);
  assert.equal(bag.subtotal,94.5);assert.equal(bag.total,94.5);assert.deepEqual(bag.orderDiscounts,[]);
  assert.equal(Math.round(bag.merchandise*100)-Math.round(bag.lineDiscounts[0].amount*100),Math.round(bag.subtotal*100));
  // A product code replaces the bundle tier rather than stacking with it.
  bag=await (await routes.mutateCartResponse(request({action:"discount",discountCodes:["save10"]}))).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"SAVE10",amount:12.6}]);assert.equal(bag.subtotal,113.4);
  // An order level code reduces the cart total, not the subtotal.
  bag=await (await routes.mutateCartResponse(request({action:"discount",discountCodes:["ORDER5"]}))).json();
  assert.deepEqual(bag.orderDiscounts,[{title:"ORDER5",amount:5}]);assert.equal(bag.subtotal,94.5);assert.equal(bag.total,89.5);
});

function insertOldSkincare(state) {
  const p=fixtureProducts[2];
  state.cart.lines.nodes.push({id:"old-skincare-line",quantity:1,cost:{subtotalAmount:money(p.price),totalAmount:money(p.price)},merchandise:{id:p.variantId,title:"Default Title",product:{handle:p.handle,title:p.handle,tags:["iqon-skincare"]}}});
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
