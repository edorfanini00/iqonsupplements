import {sourceModuleUrl} from './helpers/source-module.mjs';
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
const policyUrl = sourceModuleUrl("lib/commerce-policy.ts");
const identityUrl = sourceModuleUrl("lib/skincare-identity.ts");
const redirectsUrl = dataUrl(compile("../lib/legacy-redirects.ts"));
const withPolicy = file => dataUrl(compile(file).replace('"./commerce-policy"', JSON.stringify(policyUrl)).replace('"./skincare-identity"', JSON.stringify(identityUrl)).replace('"./legacy-redirects"', JSON.stringify(redirectsUrl)));
const imports = {
  "./shopify-consent": dataUrl(compile("../lib/shopify-consent.ts")),
  "./commerce-policy": policyUrl,
  "./skincare-identity": identityUrl,
  "./new-skincare": sourceModuleUrl("lib/new-skincare.ts"),
  react: dataUrl("export const cache = fn => fn;"),
  "next/headers": bindingsUrl,
  "./catalog": dataUrl("export const products = [];"),
  "./merchandise": withPolicy("../lib/merchandise.ts"),
  "./shopify-operations": dataUrl(compile("../lib/shopify-operations.ts")),
  "./shopify": withPolicy("../lib/shopify.ts"),
  "./legacy-redirects": redirectsUrl,
  // S8939: committed launch identity (its store differs from this fixture's store, so nothing qualifies here).
  "./skincare-launch": sourceModuleUrl("lib/skincare-launch.ts"),
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
  {handle: "gut-health", category: "supplements", price: 60, variantId: "gid://shopify/ProductVariant/4"},
  // Retired and replaced by Gut Health, but still published in Shopify.
  {handle: "colon-gentle-cleanse", category: "supplements", price: 66.84, variantId: "gid://shopify/ProductVariant/5"},
];

// Synthetic amounts only, not verification of live Shopify configuration.
const ELIGIBLE = new Set(["creatine-monohydrate", "nmn", "gut-health"]);
const TIERS = [{min: 3, rate: .25, title: "Bundle: Buy 3, save 25%"}, {min: 2, rate: .10, title: "Bundle: Buy 2, save 10%"}];
const plan = {id: "gid://shopify/SellingPlan/10", name: "Deliver every month"};
function fixture(t, {plannedPolicy = false} = {}) {
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
  // Default: arbitrary allocations for transport/mapping coverage, deliberately permitting
  // order/product stacking and a worse SAVE10 replacement. This is NOT bundle policy.
  // Separate plannedPolicy mode models best single tier versus a noncombining creator code.
  // CREATOR10's 10% is a test-only example, not a real or proposed creator code/rate.
  const recalculate = () => {
    const eligible = line => ELIGIBLE.has(line.merchandise.product.handle) && !line.sellingPlanAllocation;
    const units = state.cart.lines.nodes.filter(eligible).reduce((n, line) => n + line.quantity, 0);
    let code = state.cart.discountCodes.some(code => code.code === (plannedPolicy ? "CREATOR10" : "SAVE10"));
    let tier = state.bundles && (plannedPolicy || !code) ? TIERS.find(t => units >= t.min) : undefined;
    if (plannedPolicy) {
      const savings = (rate, qualifies) => state.cart.lines.nodes.reduce((sum,line) => {
        const item = fixtureProducts.find(p => p.variantId === line.merchandise.id);
        return sum + (qualifies(line) ? Math.floor(Math.round(item.price * 100) * (rate * 100) / 100) * line.quantity : 0);
      }, 0);
      // On ties this fixture chooses the code; only the single best saving is allocated.
      code = code && savings(.1, () => true) >= savings(tier?.rate || 0, eligible);
      if (code) tier = undefined;
      for (const entry of state.cart.discountCodes) entry.applicable = code && entry.code === "CREATOR10";
    }
    let total = 0;
    for (const line of state.cart.lines.nodes) {
      const item = fixtureProducts.find(p => p.variantId === line.merchandise.id);
      const gross = Math.round(item.price * line.quantity * 100);
      const rate = code ? .1 : tier && eligible(line) ? tier.rate : 0;
      const saved = plannedPolicy ? Math.floor(Math.round(item.price * 100) * (rate * 100) / 100) * line.quantity : Math.round(gross * rate);
      line.cost = {subtotalAmount: money(gross / 100), totalAmount: money((gross - saved) / 100)};
      line.discountAllocations = saved ? [{discountedAmount: money(saved / 100), ...(code ? {code: plannedPolicy ? "CREATOR10" : "SAVE10"} : {title: tier.title})}] : [];
      total += gross - saved;
    }
    const order = !plannedPolicy && state.cart.discountCodes.some(code => code.code === "ORDER5") && total >= 500 ? 500 : 0;
    state.cart.discountAllocations = order ? [{discountedAmount: money(order / 100), code: "ORDER5"}] : [];
    state.cart.totalQuantity = state.cart.lines.nodes.reduce((sum, line) => sum + line.quantity, 0);
    state.cart.cost = {subtotalAmount: money(total / 100), totalAmount: money((total - order) / 100)};
  };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const {query, variables} = JSON.parse(options.body);
    const operation = query.match(/(?:query|mutation) (\w+)/)[1];
    state.operations.push(operation);
    if(operation === "IQONCheckoutConsent")state.consent=variables.visitorConsent;
    if (operation === "IQONCatalog") return Response.json({data: {products: {
      pageInfo: {hasNextPage: false, endCursor: null}, nodes: fixtureProducts.map(p => ({
        handle: p.handle, title: p.handle, description: "Fixture", productType: "Fixture", tags: [`iqon-${p.category}`],
        availableForSale: state.available, requiresSellingPlan: state.requiresSellingPlan, images: {nodes: []},
        variants: {pageInfo: {hasNextPage: false}, nodes: [{id: p.variantId, title: "Default Title", availableForSale: state.available, price: money(p.price)}]},
      })),
    }}});
    if (operation === "IQONCartRead" || operation === "IQONCheckoutConsent") return Response.json({data: {cart: state.cart?.id === variables.id ? state.cart : null}});
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

test("arbitrary synthetic allocations map product and order savings and reconcile to cart cost (not bundle policy)", async t => {
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
  // Deliberately arbitrary: a worse product code replaces the bundle allocation.
  bag=await (await routes.mutateCartResponse(request({action:"discount",discountCodes:["save10"]}))).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"SAVE10",amount:12.6}]);assert.equal(bag.subtotal,113.4);
  // Deliberately arbitrary: an order code stacks, reducing total but not subtotal.
  bag=await (await routes.mutateCartResponse(request({action:"discount",discountCodes:["ORDER5"]}))).json();
  assert.deepEqual(bag.orderDiscounts,[{title:"ORDER5",amount:5}]);assert.equal(bag.subtotal,94.5);assert.equal(bag.total,89.5);
});

test("planned synthetic policy selects the best single tier or noncombining creator code below and above thresholds", async t => {
  const state=fixture(t,{plannedPolicy:true});state.bundles=true;
  let bag=await (await add(fixtureProducts[0])).json();
  const lineId=bag.items[0].lineId;
  assert.deepEqual(bag.lineDiscounts,[]);
  bag=await (await routes.mutateCartResponse(request({action:"discount",discountCodes:["CREATOR10"]}))).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"CREATOR10",amount:2.9}]);
  for(const [quantity,title,amount,subtotal,applicable] of [
    [2,"CREATOR10",5.8,52.2,true],
    [3,"Bundle: Buy 3, save 25%",21.75,65.25,false],
    [4,"Bundle: Buy 3, save 25%",29,87,false],
    [1,"CREATOR10",2.9,26.1,true],
  ]){
    bag=await (await routes.mutateCartResponse(request({action:"update",lineId,quantity}))).json();
    assert.deepEqual(bag.lineDiscounts,[{title,amount}]);
    assert.deepEqual(bag.orderDiscounts,[]);assert.equal(bag.subtotal,subtotal);assert.equal(bag.total,subtotal);
    assert.deepEqual(bag.discountCodes,[{code:"CREATOR10",applicable}]);
  }
});

test("planned synthetic bundle qualification includes Gut Health and uses only the highest eligible tier", async t => {
  const state=fixture(t,{plannedPolicy:true});state.bundles=true;
  let bag=await (await add(fixtureProducts[3])).json();
  bag=await (await routes.mutateCartResponse(request({action:"update",lineId:bag.items[0].lineId,quantity:3}))).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:45}]);assert.equal(bag.subtotal,135);
  bag=await (await add(fixtureProducts[0])).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:52.25}]);assert.equal(bag.subtotal,156.75);
  bag=await (await add(fixtureProducts[1])).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:69.25}]);
  assert.equal(bag.subtotal,207.75);
  bag=await (await add(fixtureProducts[0])).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:76.5}]);
  assert.equal(bag.subtotal,229.5);assert.equal(bag.items.find(i=>i.id==="gut-health").amount,135);
  // Eligible Gut Health also keeps the stronger bundle instead of stacking a code.
  bag=await (await routes.mutateCartResponse(request({action:"update",lineId:bag.items[0].lineId,quantity:4}))).json();
  bag=await (await routes.mutateCartResponse(request({action:"discount",discountCodes:["CREATOR10"]}))).json();
  assert.deepEqual(bag.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:91.5}]);
  assert.deepEqual(bag.discountCodes,[{code:"CREATOR10",applicable:false}]);
  assert.deepEqual(bag.orderDiscounts,[]);assert.equal(bag.subtotal,274.5);assert.equal(bag.total,274.5);
});

function insertOldSkincare(state) {
  const p=fixtureProducts[2];
  state.cart.lines.nodes.push({id:"old-skincare-line",quantity:1,cost:{subtotalAmount:money(p.price),totalAmount:money(p.price)},merchandise:{id:p.variantId,title:"Default Title",product:{handle:p.handle,title:p.handle,tags:["iqon-skincare"]}}});
  state.cart.totalQuantity++;
}

test("retired Colon Gentle Cleanse stays out of the catalog and cannot be added while still published in Shopify", async t => {
  const state=fixture(t);
  const catalog=await routes.getStoreCatalog();
  assert.equal(catalog.mode,"live");
  assert.ok(catalog.products.some(p=>p.id==="gut-health"));
  assert.equal(catalog.products.some(p=>p.id==="colon-gentle-cleanse"),false);
  const response=await add(fixtureProducts[4]);
  assert.equal(response.status,422);
  assert.equal(state.addedLines.length,0);
});

function insertOldColon(state) {
  const p=fixtureProducts[4];
  state.cart.lines.nodes.push({id:"old-colon-line",quantity:1,cost:{subtotalAmount:money(p.price),totalAmount:money(p.price)},merchandise:{id:p.variantId,title:"Default Title",product:{handle:p.handle,title:"Colon Gentle Cleanse",tags:["iqon-supplements"]}}});
  state.cart.totalQuantity++;
}
const retiredNotice=/^Colon Gentle Cleanse has been discontinued and was removed from your bag\. Gut Health replaces it\.$/;

test("loading an old bag removes retired Colon Gentle Cleanse with a notice and preserves other supplements", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldColon(state);
  const bag=await (await routes.getCartResponse()).json();
  assert.deepEqual(bag.items.map(i=>i.id),[fixtureProducts[0].handle]);assert.equal(bag.subtotal,29);
  assert.match(bag.notice,retiredNotice);assert.doesNotMatch(bag.notice,/[\u2013\u2014]| - /);
  assert.ok(state.operations.includes("IQONCartRemove"));
  assert.equal(state.cart.lines.nodes.some(l=>l.merchandise.product.handle==="colon-gentle-cleanse"),false);
  const again=await (await routes.getCartResponse()).json();
  assert.equal(again.notice,undefined);
});

test("a retired Colon line cannot have its quantity changed", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldColon(state);
  const response=await routes.mutateCartResponse(request({action:"update",lineId:"old-colon-line",quantity:3}));
  assert.equal(response.status,422);
  const data=await response.json();
  assert.match(data.error,retiredNotice);assert.deepEqual(data.cart.items.map(i=>i.id),[fixtureProducts[0].handle]);
  assert.equal(state.operations.includes("IQONCartUpdate"),false);
  assert.equal(state.cart.lines.nodes.some(l=>l.id==="old-colon-line"),false);
});

test("checkout removes a retired Colon line and requires review before handing off to Shopify", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldColon(state);
  const response=await routes.checkoutResponse(request({},"checkout"));
  assert.equal(response.status,422);
  const data=await response.json();
  assert.match(data.error,/^Colon Gentle Cleanse has been discontinued/);assert.ok(!data.checkoutUrl);
  assert.deepEqual(data.cart.items.map(i=>i.id),[fixtureProducts[0].handle]);
  assert.equal((await routes.checkoutResponse(request({},"checkout"))).status,200);
});

test("a bag holding only a retired Colon line is emptied and cannot check out", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);
  state.cart.lines.nodes=[];state.cart.totalQuantity=0;insertOldColon(state);
  const first=await routes.checkoutResponse(request({},"checkout"));
  assert.equal(first.status,422);assert.equal((await first.json()).cart.items.length,0);
  const second=await routes.checkoutResponse(request({},"checkout"));
  assert.equal(second.status,422);assert.match((await second.json()).error,/empty/i);
});

test("an old bag with skincare and Colon removes both and shows both notices", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldSkincare(state);insertOldColon(state);
  const bag=await (await routes.getCartResponse()).json();
  assert.deepEqual(bag.items.map(i=>i.id),[fixtureProducts[0].handle]);
  assert.match(bag.notice,/skincare items are not available to order/i);assert.match(bag.notice,/Colon Gentle Cleanse has been discontinued/);
});

test("skincare cannot be added, even when Shopify reports available stock", async t => {
  fixture(t);
  const response=await add(fixtureProducts[2]);
  assert.equal(response.status,422);assert.match((await response.json()).error,/isn’t available to order right now/);
});

test("loading an old bag removes skincare and preserves supplements", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldSkincare(state);
  const bag=await (await routes.getCartResponse()).json();
  assert.equal(bag.items.length,1);assert.equal(bag.items[0].id,fixtureProducts[0].handle);assert.equal(bag.subtotal,29);
  assert.match(bag.notice,/skincare items are not available to order/i);assert.ok(state.operations.includes("IQONCartRemove"));
});

test("checkout removes old skincare and requires review before handing off to Shopify", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertOldSkincare(state);
  const response=await routes.checkoutResponse(request({},"checkout"));
  assert.equal(response.status,422);
  const data=await response.json();assert.equal(data.cart.items.length,1);assert.ok(!data.checkoutUrl);
  assert.equal((await routes.checkoutResponse(request({},"checkout"))).status,200);
});


test("checkout passes fresh purpose consent to Shopify, never click IDs or customer data",async t=>{
  const state=fixture(t);await add(fixtureProducts[0]);
  const granted={analytics:false,marketing:true,preferences:true,saleOfData:true};
  state.cart.checkoutUrl+="?_cs=shopify-encoded&key=preserved";
  const first=await routes.checkoutResponse(request({visitorConsent:granted,gclid:"must-not-forward",email:"test@example.invalid"},"checkout"));
  assert.equal(first.status,200);assert.deepEqual(state.consent,granted);
  assert.equal((await first.json()).checkoutUrl,state.cart.checkoutUrl);
  const refused={analytics:false,marketing:false,preferences:false,saleOfData:false};
  assert.equal((await routes.checkoutResponse(request({visitorConsent:refused},"checkout"))).status,200);
  assert.deepEqual(state.consent,refused);
  const gpc=request({visitorConsent:granted},"checkout");gpc.headers.set("Sec-GPC","1");
  assert.equal((await routes.checkoutResponse(gpc)).status,200);
  assert.deepEqual(state.consent,{...granted,marketing:false,saleOfData:false});
  for(const visitorConsent of [null,[],{marketing:true},{...granted,marketing:"true"},{...granted,email:"bad"}])
    assert.equal((await routes.checkoutResponse(request({visitorConsent},"checkout"))).status,400);
});

function insertLegacy(state, handle = "anti-aging-cleanser-with-peptides", id = "old-legacy-line") {
  state.cart.lines.nodes.push({id,quantity:1,cost:{subtotalAmount:money(40),totalAmount:money(40)},merchandise:{id:`gid://shopify/ProductVariant/7${id.length}`,title:"Default Title",product:{handle,title:handle,tags:["iqon-skincare"]}}});
  state.cart.totalQuantity++;
}
test("a legacy formula in an old bag is removed with the earlier formula notice, never a 'right now' notice", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertLegacy(state);
  const bag=await (await routes.getCartResponse()).json();
  assert.deepEqual(bag.items.map(i=>i.id),[fixtureProducts[0].handle]);
  assert.equal(bag.notice,"This earlier formula is not available to order. It has been removed from your bag.");
  assert.doesNotMatch(bag.notice,/right now/);
});
test("two legacy formulas get the plural notice; legacy plus held skincare gets both notices", async t => {
  const state=fixture(t);await add(fixtureProducts[0]);insertLegacy(state);insertLegacy(state,"hydrating-tonic","old-legacy-line-2");
  assert.equal((await (await routes.getCartResponse()).json()).notice,"These earlier formulas are not available to order. They have been removed from your bag.");
  const mixed=fixture(t);await add(fixtureProducts[0]);insertLegacy(mixed);insertOldSkincare(mixed);
  const bag=await (await routes.getCartResponse()).json();
  assert.deepEqual(bag.items.map(i=>i.id),[fixtureProducts[0].handle]);
  assert.equal(bag.notice,"These skincare items are not available to order right now and have been removed from your bag. This earlier formula is not available to order. It has been removed from your bag.");
});
