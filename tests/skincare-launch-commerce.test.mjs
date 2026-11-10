import {sourceModuleUrl} from './helpers/source-module.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// S8939 conditional launch through the REAL route handlers, Shopify transport, mapping and
// qualification, against a deterministic synthetic Storefront. The launch identity below is a
// clearly-labeled SYNTHETIC fixture (ids 99xxxxxxxxxxxx on store s8939-fixture.myshopify.com);
// the committed identity is never modified. Every non-fixture host fails the test.
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022});
const STORE = "s8939-fixture.myshopify.com";
const ACTIVE = ["enzyme-gel-cleanser","exfoliating-pads","hyaluronic-serum","retinol-rx","hydra-c-ferulic-serum","peptide-anti-wrinkle-day-cream","copper-peptide-restore-cream","firming-peptide-eye-gel"];
const PRICES = {"enzyme-gel-cleanser":"55.00","exfoliating-pads":"80.00","hyaluronic-serum":"90.00","retinol-rx":"99.00","hydra-c-ferulic-serum":"90.00","peptide-anti-wrinkle-day-cream":"100.00","copper-peptide-restore-cream":"68.00","firming-peptide-eye-gel":"77.00"};
const LEGACY = ["anti-aging-cleanser-with-peptides","hydrating-tonic"];
const pid = i => `gid://shopify/Product/99000000000${100+i}`, vid = i => `gid://shopify/ProductVariant/99000000000${200+i}`;
const fixtureIdentity = {store: STORE, currency: "USD", products: ACTIVE.map((handle, i) => ({handle, supplierSku: `SYNTH${i}`, approvedPriceUsd: PRICES[handle], productId: pid(i), variantId: vid(i)}))};
const committed = JSON.parse(fs.readFileSync(new URL("../lib/skincare-launch-identity.json", import.meta.url), "utf8"));

const bindingsUrl = dataUrl(`
  export const jar = new Map();
  export const cookies = async () => ({get: key => jar.has(key) ? {value: jar.get(key)} : undefined, set: (key, value) => {jar.set(key, value);}});
  export const headers = async () => new Headers();
`);
const {jar} = await import(bindingsUrl);
const policyUrl = sourceModuleUrl("lib/commerce-policy.ts");
const identityUrl = sourceModuleUrl("lib/skincare-identity.ts");
const redirectsUrl = dataUrl(compile("../lib/legacy-redirects.ts"));
const withPolicy = file => dataUrl(compile(file).replace('"./commerce-policy"', JSON.stringify(policyUrl)).replace('"./skincare-identity"', JSON.stringify(identityUrl)).replace('"./legacy-redirects"', JSON.stringify(redirectsUrl)));
const launchUrl = dataUrl(compile("../lib/skincare-launch.ts")
  .replace('"./skincare-launch-identity.json"', JSON.stringify(dataUrl(`export default ${JSON.stringify(fixtureIdentity)};`)))
  .replace('"./skincare-identity"', JSON.stringify(identityUrl)));
const newSkincareUrl = sourceModuleUrl("lib/new-skincare.ts");
const imports = {
  "./shopify-consent": dataUrl(compile("../lib/shopify-consent.ts")),
  "./commerce-policy": policyUrl, "./skincare-identity": identityUrl, "./new-skincare": newSkincareUrl,
  react: dataUrl("export const cache = fn => fn;"), "next/headers": bindingsUrl,
  "./catalog": dataUrl("export const products = [];"),
  "./merchandise": withPolicy("../lib/merchandise.ts"),
  "./shopify-operations": dataUrl(compile("../lib/shopify-operations.ts")),
  "./shopify": withPolicy("../lib/shopify.ts"), "./legacy-redirects": redirectsUrl, "./skincare-launch": launchUrl,
};
const routes = await import(dataUrl(compile("../lib/shopify.server.ts").replace(/from "([^"]+)"/g, (m, name) => imports[name] ? `from "${imports[name]}"` : m)));
const launch = await import(launchUrl);
const {isComingSoon, isOrderable} = await import(policyUrl);
const {publicCart} = await import(imports["./shopify"]);
const {productJsonLd, isListedProduct} = await import(sourceModuleUrl("lib/seo.ts"));
const {isBundleEligible, bundleFamily, BUNDLE_ELIGIBLE_HANDLES, SKINCARE_BUNDLE_ELIGIBLE_HANDLES} = await import(sourceModuleUrl("lib/bundle-offer.ts"));
const {activeSkincareProducts} = await import(newSkincareUrl);

const origin = "https://iqon.example";
const request = (body, path = "cart") => new Request(`${origin}/api/${path}`, {method: "POST", headers: {Origin: origin, "Content-Type": "application/json"}, body: JSON.stringify(body)});
const money = amount => ({amount: String(amount), currencyCode: "USD"});
const supplement = {handle: "creatine-monohydrate", title: "Creatine", description: "Synthetic", productType: "Powder", tags: ["iqon-supplements"], availableForSale: true, requiresSellingPlan: false, images: {nodes: []}, variants: {pageInfo: {hasNextPage: false}, nodes: [{id: "gid://shopify/ProductVariant/1", title: "Default Title", availableForSale: true, price: money("45.00")}]}};
const consent = {analytics: false, marketing: false, preferences: false, saleOfData: false};

/** Synthetic Storefront. `variant(i)` returns a qualifying node; `tweak` mutates per handle. */
function storefront(t, {domain = STORE, qualification = "ok", tweak = () => {}, seed = []} = {}) {
  jar.clear();
  const keys = ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "SHOPIFY_API_VERSION"], before = keys.map(k => process.env[k]);
  Object.assign(process.env, {SHOPIFY_STORE_DOMAIN: domain, SHOPIFY_STOREFRONT_PRIVATE_TOKEN: domain ? "fixture-only" : "", SHOPIFY_API_VERSION: "2026-07"});
  t.after(() => keys.forEach((k, i) => before[i] === undefined ? delete process.env[k] : process.env[k] = before[i]));
  const state = {ops: [], writes: [], cart: null, stock: Object.fromEntries(ACTIVE.map(h => [h, 28])), price: {...PRICES}};
  const node = handle => {
    const i = ACTIVE.indexOf(handle);
    const n = {id: vid(i), title: "Default Title", availableForSale: true, currentlyNotInStock: false, quantityAvailable: state.stock[handle], price: money(state.price[handle]),
      product: {id: pid(i), handle, tags: ["iqon-skincare"], availableForSale: true, requiresSellingPlan: false}};
    const changed = tweak(handle, n);
    return changed === undefined ? n : changed;
  };
  const lineFor = (merchandiseId, quantity, extra = {}) => {
    const i = [...Array(8).keys()].find(i => vid(i) === merchandiseId);
    const handle = i === undefined ? supplement.handle : ACTIVE[i];
    const price = i === undefined ? 45 : Number(state.price[handle]);
    return {id: `line-${handle}`, quantity, cost: {subtotalAmount: money(price * quantity), totalAmount: money(price * quantity)}, merchandise: {id: merchandiseId, title: "Default Title", product: {handle, title: handle, tags: i === undefined ? ["iqon-supplements"] : ["iqon-skincare"]}}, ...extra};
  };
  const recalc = () => { state.cart.totalQuantity = state.cart.lines.nodes.reduce((n, l) => n + l.quantity, 0); state.cart.cost = {subtotalAmount: money(1), totalAmount: money(1)}; };
  const create = nodes => { state.cart = {id: "gid://shopify/Cart/s8939-fixture", checkoutUrl: `https://${STORE}/checkouts/synthetic-only`, discountCodes: [], lines: {pageInfo: {hasNextPage: false}, nodes}}; recalc(); };
  if (seed.length) { create(seed.map(([id, q, extra]) => lineFor(id, q, extra))); jar.set("iqon_shopify_cart", state.cart.id); }
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), `https://${domain}/api/2026-07/graphql.json`, "no external fetch is permitted");
    assert.equal(domain, STORE, "only the synthetic fixture store is reachable");
    const {query, variables} = JSON.parse(options.body), op = query.match(/(?:query|mutation) (\w+)/)[1];
    state.ops.push(op);
    if (op === "IQONSkincareQualification") {
      if (qualification === "down") return new Response("synthetic outage", {status: 503});
      if (qualification === "errors") return Response.json({errors: [{message: "Access denied for quantityAvailable"}]});
      return Response.json({data: {nodes: variables.ids.map(id => { const i = [...Array(8).keys()].find(i => vid(i) === id); return i === undefined ? null : node(ACTIVE[i]); })}});
    }
    if (op === "IQONCatalog") return Response.json({data: {products: {nodes: [supplement], pageInfo: {hasNextPage: false, endCursor: null}}}});
    if (op === "IQONCartRead" || op === "IQONCheckoutConsent") return Response.json({data: {cart: state.cart}});
    state.writes.push({op, variables});
    const names = {IQONCartCreate: "cartCreate", IQONCartAdd: "cartLinesAdd", IQONCartUpdate: "cartLinesUpdate", IQONCartRemove: "cartLinesRemove", IQONCartDiscounts: "cartDiscountCodesUpdate"};
    if (op === "IQONCartRemove") state.cart.lines.nodes = state.cart.lines.nodes.filter(l => !variables.lineIds.includes(l.id));
    else if (op === "IQONCartCreate" || op === "IQONCartAdd") {
      const lines = variables.input?.lines || variables.lines;
      if (!state.cart) create([]);
      for (const v of lines) { const existing = state.cart.lines.nodes.find(l => l.merchandise.id === v.merchandiseId); if (existing) existing.quantity += v.quantity; else state.cart.lines.nodes.push(lineFor(v.merchandiseId, v.quantity)); }
    } else if (op === "IQONCartUpdate") for (const v of variables.lines) state.cart.lines.nodes.find(l => l.id === v.id).quantity = v.quantity;
    else state.cart.discountCodes = variables.discountCodes.map(code => ({code, applicable: true}));
    recalc();
    return Response.json({data: {[names[op]]: {cart: state.cart, userErrors: [], warnings: []}}});
  });
  return state;
}
const add = (handle, variantId, quantity = 1) => routes.mutateCartResponse(request({action: "add", id: handle, variantId, quantity}));
const update = (lineId, quantity) => routes.mutateCartResponse(request({action: "update", lineId, quantity}));
const checkout = () => routes.checkoutResponse(request({visitorConsent: consent}, "checkout"));

// Exact eight bindings from the final DRAFT provisioning manifest (sha256 fdac7afb…de7). The five
// pre-existing ids are unchanged from the reviewed activation; enzyme-gel-cleanser, hyaluronic-serum and
// peptide-anti-wrinkle-day-cream (previously null) were bound from it.
const EXPECTED_IDENTITY = [
  ["enzyme-gel-cleanser", "81310702C", "55.00", "gid://shopify/Product/10554590560551", "gid://shopify/ProductVariant/52574511104295"],
  ["exfoliating-pads", "12410503C", "80.00", "gid://shopify/Product/10393655345447", "gid://shopify/ProductVariant/52052013744423"],
  ["hyaluronic-serum", "33230103C", "90.00", "gid://shopify/Product/10554590789927", "gid://shopify/ProductVariant/52574511366439"],
  ["retinol-rx", "82730103C", "99.00", "gid://shopify/Product/10393656656167", "gid://shopify/ProductVariant/52052015710503"],
  ["hydra-c-ferulic-serum", "40730103C", "90.00", "gid://shopify/Product/10393656066343", "gid://shopify/ProductVariant/52052014727463"],
  ["peptide-anti-wrinkle-day-cream", "61730172C", "100.00", "gid://shopify/Product/10554590855463", "gid://shopify/ProductVariant/52574511431975"],
  ["copper-peptide-restore-cream", "11530173C", "68.00", "gid://shopify/Product/10393657737511", "gid://shopify/ProductVariant/52052017971495"],
  ["firming-peptide-eye-gel", "11330052C", "77.00", "gid://shopify/Product/10393657245991", "gid://shopify/ProductVariant/52052016955687"],
];
test("D-MAP-1: committed identity binds exactly the eight manifest ids for the exact store", () => {
  assert.equal(committed.store, "nr9zd0-t5.myshopify.com");
  assert.equal(committed.currency, "USD");
  assert.deepEqual(Object.keys(committed).sort(), ["_comment", "currency", "products", "store"]);
  assert.deepEqual(committed.products.map(p => [p.handle, p.supplierSku, p.approvedPriceUsd, p.productId, p.variantId]), EXPECTED_IDENTITY);
  assert.deepEqual(committed.products.map(p => Object.keys(p).sort()), committed.products.map(() => ["approvedPriceUsd", "handle", "productId", "supplierSku", "variantId"]));
  assert.deepEqual(committed.products.map(p => p.handle), ACTIVE);
  assert.deepEqual(Object.fromEntries(committed.products.map(p => [p.handle, p.approvedPriceUsd])), PRICES);
  for (const column of [0, 1, 3, 4]) assert.equal(new Set(EXPECTED_IDENTITY.map(r => r[column])).size, 8, `unique column ${column}`);
  assert.ok(!committed.products.some(p => LEGACY.includes(p.handle)));
  assert.ok(!JSON.stringify(committed).includes("99000000000"), "no synthetic id leaks into the committed identity");
  // Provenance names the exact manifest snapshot and its held (not activated) semantics.
  assert.match(committed._comment, /sha256 fdac7afbb14275166fbae98c413096b102985c8a7d1175b4d151a6e722275de7/);
  assert.match(committed._comment, /DRAFT_PROVISIONING_COMPLETE_COORDINATED_RELEASE_NOT_EXECUTED/);
  assert.match(committed._comment, /A configured id is not activation/);
  // All eight complete bindings, only for its own store.
  assert.deepEqual(launch.launchBindings("nr9zd0-t5.myshopify.com", committed),
    EXPECTED_IDENTITY.map(([handle, , price, productId, variantId]) => ({handle, productId, variantId, priceCents: Math.round(Number(price) * 100)})));
  assert.equal(launch.launchBindings("other.myshopify.com", committed).length, 0);
  assert.equal(launch.launchBindings("NR9ZD0-T5.myshopify.com", committed).length, 0);
  assert.equal(launch.launchBindings(undefined, committed).length, 0);
});

test("D-MAP-2: all eight ids configured is not activation — DRAFT/unpublished/unstocked provider answers hold every product", () => {
  const bindings = launch.launchBindings("nr9zd0-t5.myshopify.com", committed);
  assert.equal(bindings.length, 8);
  // Storefront nodes() returns null for DRAFT or unpublished products (the manifest state of all eight).
  const draft = launch.qualifySkincare(bindings, bindings.map(() => null));
  assert.equal(draft.status, "ok"); assert.equal(draft.qualified.size, 0);
  const node = (b, over = {}, product = {}) => ({id: b.variantId, title: "Default Title", availableForSale: true, currentlyNotInStock: false, quantityAvailable: 28,
    price: money((b.priceCents / 100).toFixed(2)), ...over, product: {id: b.productId, handle: b.handle, tags: ["iqon-skincare"], availableForSale: true, requiresSellingPlan: false, ...product}});
  // Published but at the manifest's opening balances: three new products 0, five existing still need the gated stock write.
  const zero = launch.qualifySkincare(bindings, bindings.map(b => node(b, {quantityAvailable: 0, availableForSale: false, currentlyNotInStock: true}, {availableForSale: false})));
  assert.equal(zero.qualified.size, 0);
  const noInventoryScope = launch.qualifySkincare(bindings, bindings.map(b => node(b, {quantityAvailable: null})));
  assert.equal(noInventoryScope.qualified.size, 0);
  // Only a complete qualifying answer for an exact id qualifies that one product; the others stay held.
  const one = launch.qualifySkincare(bindings, bindings.map((b, i) => i === 3 ? node(b) : null));
  assert.deepEqual([...one.qualified.keys()], ["retinol-rx"]);
  assert.equal(one.qualified.get("retinol-rx").variantId, "gid://shopify/ProductVariant/52052015710503");
  // An answer for a different (e.g. pre-binding) id never qualifies a bound handle.
  assert.equal(launch.qualifySkincare(bindings, bindings.map(b => node(b, {id: "gid://shopify/ProductVariant/1"}))).qualified.size, 0);
  assert.equal(launch.qualifySkincare(bindings, bindings.slice(1).map(b => node(b))).status, "unavailable", "short answer is unavailable, not partial");
});

test("D-PRICE-1: whole-dollar approved prices qualify; the superseded and any other price holds (owner decision 10 Nov 2026)", () => {
  const bindings = launch.launchBindings("nr9zd0-t5.myshopify.com", committed);
  assert.deepEqual(Object.fromEntries(bindings.map(b => [b.handle, b.priceCents])), {"enzyme-gel-cleanser": 5500, "exfoliating-pads": 8000, "hyaluronic-serum": 9000,
    "retinol-rx": 9900, "hydra-c-ferulic-serum": 9000, "peptide-anti-wrinkle-day-cream": 10000, "copper-peptide-restore-cream": 6800, "firming-peptide-eye-gel": 7700});
  const node = (b, amount) => ({id: b.variantId, title: "Default Title", availableForSale: true, currentlyNotInStock: false, quantityAvailable: 28,
    price: money(amount ?? (b.priceCents / 100).toFixed(2)), product: {id: b.productId, handle: b.handle, tags: ["iqon-skincare"], availableForSale: true, requiresSellingPlan: false}});
  const qualifiedWith = (handle, amount) => launch.qualifySkincare(bindings, bindings.map(b => node(b, b.handle === handle ? amount : undefined))).qualified;
  const all = qualifiedWith();
  assert.equal(all.size, 8);
  assert.equal(all.get("retinol-rx").price, 99); assert.equal(all.get("firming-peptide-eye-gel").price, 77);
  for (const [handle, accepted] of [["retinol-rx", ["99.00", "99.0", "99"]], ["firming-peptide-eye-gel", ["77.00", "77.0", "77"]]])
    for (const amount of accepted) assert.equal(qualifiedWith(handle, amount).get(handle)?.price, Number(amount), `${handle} at ${amount}`);
  for (const [handle, rejected] of [["retinol-rx", ["98.34", "98.99", "99.01", "100.00", "0.99", "9900"]], ["firming-peptide-eye-gel", ["76.67", "76.99", "77.01", "78.00", "7700"]]])
    for (const amount of rejected) {
      const q = qualifiedWith(handle, amount);
      assert.equal(q.has(handle), false, `${handle} at ${amount} must hold`);
      assert.equal(q.size, 7, "only the drifted product holds");
    }
  // Unchanged prices stay exact.
  for (const [handle, amount] of [["enzyme-gel-cleanser", "55.01"], ["exfoliating-pads", "79.99"], ["hyaluronic-serum", "90.01"], ["hydra-c-ferulic-serum", "89.00"],
    ["peptide-anti-wrinkle-day-cream", "99.00"], ["copper-peptide-restore-cream", "68.34"]]) assert.equal(qualifiedWith(handle, amount).has(handle), false, `${handle} at ${amount}`);
  // A committed identity still carrying a superseded price would hold against a 99.00 Storefront answer.
  const stale = structuredClone(committed); stale.products.find(p => p.handle === "retinol-rx").approvedPriceUsd = "98.34";
  const staleBindings = launch.launchBindings("nr9zd0-t5.myshopify.com", stale);
  assert.equal(launch.qualifySkincare(staleBindings, staleBindings.map(b => node(b, b.handle === "retinol-rx" ? "99.00" : undefined))).qualified.has("retinol-rx"), false);
});

test("D-HOLD-3: identity collisions disqualify every entry that shares an id", () => {
  const dup = structuredClone(fixtureIdentity); dup.products[1].variantId = dup.products[0].variantId;
  assert.deepEqual(launch.launchBindings(STORE, dup).map(b => b.handle), ACTIVE.slice(2));
  const legacyInjected = structuredClone(fixtureIdentity); legacyInjected.products[0].handle = "anti-aging-cleanser-with-peptides";
  assert.ok(!launch.launchBindings(STORE, legacyInjected).some(b => LEGACY.includes(b.handle)));
  const numeric = structuredClone(fixtureIdentity); numeric.products[0].variantId = "99000000000200";
  assert.equal(launch.launchBindings(STORE, numeric).length, 7);
});

test("D-HOLD-1/D-HOLD-4: all eight qualify with live approved prices and approved content; legacy never appears", async t => {
  storefront(t);
  const c = await routes.getStoreCatalog();
  assert.equal(c.mode, "live");
  const skin = c.products.filter(p => p.category === "skincare");
  assert.deepEqual(skin.map(p => p.id), activeSkincareProducts.map(p => p.id));
  for (const p of skin) {
    const approved = activeSkincareProducts.find(a => a.id === p.id);
    assert.equal(p.launchQualified, true, p.id); assert.equal(isComingSoon(p), false); assert.equal(isOrderable(p, "live"), true);
    assert.equal(p.price, Number(PRICES[p.id])); assert.equal(p.stockLimit, 28);
    assert.deepEqual([p.name, p.size, p.description, p.image, p.images], [approved.name, approved.size, approved.description, approved.image, approved.images]);
    assert.equal(p.variants.length, 1); assert.equal(p.variants[0].id, vid(ACTIVE.indexOf(p.id)));
    const ld = productJsonLd(p, isComingSoon(p) || !!p.pricePending);
    assert.equal(ld.offers.price, Number(PRICES[p.id]).toFixed(2)); assert.equal(ld.offers.availability, "https://schema.org/InStock");
    assert.equal(isListedProduct(c, p), true);
    assert.equal(isBundleEligible(p.id), false, "skincare never joins the supplement bundle");
    assert.equal(isBundleEligible(p.id, "skincare"), true, "qualified skincare joins its own skincare bundle"); assert.equal(bundleFamily(p.id), "skincare");
  }
  assert.ok(!c.products.some(p => LEGACY.includes(p.id)));
  assert.equal(c.products.find(p => p.id === supplement.handle).available, true);
  assert.equal(BUNDLE_ELIGIBLE_HANDLES.length, 11);
  assert.deepEqual([...SKINCARE_BUNDLE_ELIGIBLE_HANDLES].sort(), [...ACTIVE].sort());
});

const {productVisuals} = await import(sourceModuleUrl("lib/product-visuals.ts"));
const {productPresentation} = await import(sourceModuleUrl("lib/product-presentation.ts"));
const {skincareVisualContent} = await import(sourceModuleUrl("lib/skincare-visual-content.ts"));
const {pageMetadata} = await import(sourceModuleUrl("lib/seo.ts"));
const {comingSoonSkincareProduct} = await import(newSkincareUrl);
const RETINOL_DESCRIPTION = "A 0.75% encapsulated retinol serum with niacinamide and squalane. An evening treatment for the appearance of fine lines and uneven texture.";
const RETINOL_ATTRIBUTION = "Retinol strength as stated by the formulating laboratory.";
const COMMERCE_FIELDS = ["available", "pricePending", "price", "currency", "launchQualified", "stockLimit", "variants", "requiresSellingPlan"];
const withoutCommerce = p => Object.fromEntries(Object.entries(p).filter(([k]) => !COMMERCE_FIELDS.includes(k)));

test("D-CONT-2: qualified activation keeps every approved content field, incl. Retinol 0.75% strength, attribution and metadata", async t => {
  storefront(t);
  const c = await routes.getStoreCatalog();
  const held = {mode: "unavailable", products: []};
  for (const id of ACTIVE) {
    const launched = c.products.find(p => p.id === id);
    assert.equal(launched.launchQualified, true, id);
    assert.equal(comingSoonSkincareProduct(c, id), undefined, `${id}: qualified page is not informational`);
    // Only commerce facts differ from the informational page record; all copy/imagery is identical.
    assert.deepEqual(withoutCommerce(launched), withoutCommerce(comingSoonSkincareProduct(held, id)), id);
    if (id !== "retinol-rx") assert.doesNotMatch(JSON.stringify(launched), /0\.75%|Retinol strength as stated/, id);
  }
  const retinol = c.products.find(p => p.id === "retinol-rx");
  assert.equal(retinol.price, 99); assert.equal(retinol.variants[0].price, 99);
  assert.equal(retinol.description, RETINOL_DESCRIPTION);
  assert.equal(retinol.ingredients, "0.75% encapsulated retinol, niacinamide and squalane");
  assert.doesNotMatch(retinol.inci, /0\.75%/, "approved INCI is not rewritten");
  // Id-keyed visible copy used by the PDP (summary lead, key fact, ingredient explorer).
  assert.match(productVisuals[retinol.id].lead, /^0\.75% encapsulated retinol /);
  assert.equal(productVisuals[retinol.id].lead.split(RETINOL_ATTRIBUTION).length - 1, 1);
  assert.deepEqual([productPresentation[retinol.id].fact, productPresentation[retinol.id].factLabel], ["0.75%", "encapsulated retinol"]);
  assert.match(skincareVisualContent[retinol.id].ingredients[0].summary, /^0\.75% encapsulated retinol/);
  // The PDP metadata is built from the qualified record's description (app/products/[slug]/page.tsx).
  const meta = pageMetadata({path: `/products/${retinol.id}`, title: `${retinol.name} | IQON`, description: retinol.description, image: retinol.image, indexable: true});
  assert.deepEqual([meta.description, meta.openGraph.description, meta.twitter.description], [RETINOL_DESCRIPTION, RETINOL_DESCRIPTION, RETINOL_DESCRIPTION]);
  const ld = productJsonLd(retinol, isComingSoon(retinol) || !!retinol.pricePending);
  assert.equal(ld.name, retinol.name); assert.equal(ld.offers.price, "99.00");
});

const holdCases = [
  ["unconfigured store", {domain: ""}, false],
  ["wrong store (identity is for another shop)", {domain: "other-shop.myshopify.com"}, false],
  ["qualification outage", {qualification: "down"}, true],
  ["GraphQL error (e.g. missing inventory scope)", {qualification: "errors"}, true],
  ["missing/unpublished variant (null node)", {tweak: () => null}, true],
  ["variant on another product (numeric/id collision)", {tweak: (h, n) => ({...n, product: {...n.product, id: "gid://shopify/Product/1"}})}, true],
  ["handle mismatch", {tweak: (h, n) => ({...n, product: {...n.product, handle: h + "-x"}})}, true],
  ["missing skincare tag", {tweak: (h, n) => ({...n, product: {...n.product, tags: []}})}, true],
  ["also tagged supplements", {tweak: (h, n) => ({...n, product: {...n.product, tags: ["iqon-skincare", "iqon-supplements"]}})}, true],
  ["price drift", {tweak: (h, n) => ({...n, price: money((Number(n.price.amount) + 1).toFixed(2))})}, true],
  ["non-USD", {tweak: (h, n) => ({...n, price: {...n.price, currencyCode: "CAD"}})}, true],
  ["no stock metadata", {tweak: (h, n) => ({...n, quantityAvailable: null})}, true],
  ["zero stock", {tweak: (h, n) => ({...n, quantityAvailable: 0})}, true],
  ["not in stock", {tweak: (h, n) => ({...n, currentlyNotInStock: true})}, true],
  ["unavailable for sale", {tweak: (h, n) => ({...n, availableForSale: false})}, true],
  ["requires selling plan", {tweak: (h, n) => ({...n, product: {...n.product, requiresSellingPlan: true}})}, true],
];
for (const [name, options, live] of holdCases) test(`D-HOLD-3: ${name} keeps all eight on hold (no Offer, no add)`, async t => {
  const state = storefront(t, options);
  const c = await routes.getStoreCatalog();
  if (live) assert.equal(c.mode, "live"); else assert.notEqual(c.mode, "live");
  const skin = c.products.filter(p => p.category === "skincare");
  // Preview mode serves the static catalog, stubbed empty in this harness; live/outage keep all eight informational cards.
  if (c.mode !== "preview") assert.equal(skin.length, 8);
  for (const p of skin) {
    assert.equal(p.launchQualified, undefined); assert.equal(isComingSoon(p), true); assert.equal(p.pricePending, true);
    assert.equal(productJsonLd(p, isComingSoon(p) || !!p.pricePending), null);
  }
  if (live) assert.equal(c.products.find(p => p.id === supplement.handle).available, true, "supplements unaffected");
  const r = await add(ACTIVE[0], vid(0));
  assert.equal(r.status, ["unconfigured store"].includes(name) ? 422 : 422);
  assert.ok(!state.writes.length, "no cart write");
});

test("D-HOLD-2: legacy handles are rejected before any commerce call even with a full fixture", async t => {
  const state = storefront(t);
  for (const h of LEGACY) for (const v of [vid(0), undefined, "gid://shopify/ProductVariant/52052012237095"]) {
    const r = await add(h, v); assert.equal(r.status, 422);
  }
  assert.deepEqual(state.ops, []);
});

test("D-CART-1/D-CART-2: qualified add, wrong variant, missing variant and oversell", async t => {
  const state = storefront(t);
  assert.equal((await add(ACTIVE[1], vid(2))).status, 422, "variant of a different handle");
  assert.equal((await add(ACTIVE[1])).status, 422, "variant omitted");
  assert.equal((await add(ACTIVE[1], vid(1), 29)).status, 400, "above max quantity guard");
  state.stock[ACTIVE[1]] = 3;
  const over = await add(ACTIVE[1], vid(1), 4);
  assert.equal(over.status, 422); assert.match((await over.json()).error, /Only 3 available/);
  const ok = await add(ACTIVE[1], vid(1), 2);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.deepEqual(body.items.map(i => [i.id, i.quantity, i.purchase]), [[ACTIVE[1], 2, "once"]]);
  const again = await add(ACTIVE[1], vid(1), 2);
  assert.equal(again.status, 422, "existing + new exceeds fresh stock");
  assert.equal(state.writes.filter(w => w.op === "IQONCartCreate" || w.op === "IQONCartAdd").length, 1);
  const lineId = state.cart.lines.nodes[0].id;
  assert.equal((await update(lineId, 4)).status, 422, "update above fresh stock");
  assert.equal((await update(lineId, 3)).status, 200);
  const sub = await routes.mutateCartResponse(request({action: "add", id: ACTIVE[0], variantId: vid(0), quantity: 1, purchase: "subscription"}));
  assert.equal(sub.status, 422, "no skincare subscription");
});

test("D-CART-3: mixed supplement + skincare cart checks out; 10% code applies to the bag", async t => {
  const state = storefront(t, {seed: [["gid://shopify/ProductVariant/1", 2], [vid(3), 1]]});
  const code = await routes.mutateCartResponse(request({action: "discount", discountCodes: ["iqon10"]}));
  assert.equal(code.status, 200);
  assert.deepEqual((await code.json()).discountCodes, [{code: "IQON10", applicable: true}]);
  const r = await checkout();
  assert.equal(r.status, 200);
  assert.equal((await r.json()).checkoutUrl, `https://${STORE}/checkouts/synthetic-only`);
  assert.ok(!state.writes.some(w => w.op === "IQONCartRemove"));
});

for (const [name, drift] of [
  // The superseded 98.34 Retinol Rx price is now drift from the approved whole-dollar 99.00.
  ["price drift", s => { s.price[ACTIVE[3]] = "98.34"; }],
  ["stock reaches zero", s => { s.stock[ACTIVE[3]] = 0; }],
]) test(`D-CART-1: a previously qualified line is removed after ${name} and checkout returns no URL`, async t => {
  const state = storefront(t, {seed: [["gid://shopify/ProductVariant/1", 1], [vid(3), 1]]});
  drift(state);
  const r = await checkout();
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.ok(!body.checkoutUrl);
  assert.ok(!(body.cart?.items || []).some(i => i.id === ACTIVE[3]));
  assert.deepEqual(state.writes.map(w => w.op), ["IQONCartRemove"]);
  assert.deepEqual(state.cart.lines.nodes.map(l => l.merchandise.product.handle), [supplement.handle]);
});

test("D-CART-1: stock lower than the line quantity blocks checkout without changing the bag", async t => {
  const state = storefront(t, {seed: [[vid(5), 3]]});
  state.stock[ACTIVE[5]] = 2;
  const r = await checkout();
  assert.equal(r.status, 422); assert.match((await r.json()).error, /Only 2/);
  assert.deepEqual(state.writes, []);
});

test("D-CART-1: qualification outage with skincare in the bag fails closed — no removal, no checkout URL", async t => {
  const state = storefront(t, {qualification: "down", seed: [[vid(2), 1]]});
  const g = await routes.getCartResponse();
  assert.equal(g.status, 503);
  const c = await checkout();
  assert.equal(c.status, 503); assert.ok(!(await c.json()).checkoutUrl);
  assert.deepEqual(state.writes, []);
});

test("D-CART-1: a skincare line carrying a selling plan or the wrong variant is never allowed", async t => {
  const state = storefront(t, {seed: [[vid(4), 1, {sellingPlanAllocation: {sellingPlan: {id: "gid://shopify/SellingPlan/1", name: "Monthly", options: []}}}]]});
  const r = await checkout();
  assert.equal(r.status, 422);
  assert.deepEqual(state.writes.map(w => w.op), ["IQONCartRemove"]);
  // Pure serializer default: held lines are never serialized without an explicit fresh allowance.
  assert.throws(() => publicCart({id: "c", checkoutUrl: "https://x", totalQuantity: 1, cost: {subtotalAmount: money(1), totalAmount: money(1)}, lines: {pageInfo: {hasNextPage: false}, nodes: [{id: "l", quantity: 1, cost: {totalAmount: money(1)}, merchandise: {id: vid(0), title: "t", product: {handle: ACTIVE[0], title: "t"}}}]}}));
});
