// Loaded into `next start` with NODE_OPTIONS=--import for the S8939 launch browser QA ONLY,
// against a QA build whose launch identity was replaced by the SYNTHETIC fixture below
// (store iqon-test.myshopify.com, ids 99xxxxxxxxxxxx). Answers Storefront catalog, skincare
// qualification and cart operations from memory; every other external request is refused
// and recorded. The synthetic checkoutUrl is never fetched (the browser aborts it).
import fs from "node:fs";
const BLOCK_LOG = process.env.S8939_BLOCK_LOG || "/tmp/s8939-daily-blocked.log";
const money = amount => ({amount, currencyCode: "USD"});
const SUPPLEMENTS = [
  ["creatine-monohydrate", "Creatine Monohydrate", "48.97", "Powder"], ["hydrolyzed-collagen-peptides", "Hydrolyzed Collagen Peptides", "65.64", "Powder"],
  ["collagen-peptides-chocolate", "Grass-Fed Collagen Peptides", "70.84", "Powder"], ["colostrum-powder", "Colostrum Powder", "42.17", "Powder"],
  ["gut-health", "Gut Health", "29.99", "Capsules"], ["keto-5", "Keto-5", "39.00", "Capsules"], ["glp-1-support", "GLP-1 Support", "45.00", "Capsules"],
  ["liver-support", "Liver Support", "45.00", "Capsules"], ["nmn", "NMN", "59.50", "Capsules"], ["resveratrol", "Resveratrol", "42.00", "Capsules"],
  ["hair-skin-nails-gummies", "Hair, Skin & Nails Gummies", "35.00", "Gummies"],
];
const catalog = SUPPLEMENTS.map(([handle, title, price, type], i) => ({handle, title, description: `${title} synthetic test description.`, productType: type, tags: ["iqon-supplements"],
  availableForSale: true, requiresSellingPlan: false, images: {nodes: []}, variants: {pageInfo: {hasNextPage: false}, nodes: [{id: `gid://shopify/ProductVariant/${i + 1}`, title: "Default Title", availableForSale: true, price: money(price)}]}}));
const ACTIVE = ["enzyme-gel-cleanser","exfoliating-pads","hyaluronic-serum","retinol-rx","hydra-c-ferulic-serum","peptide-anti-wrinkle-day-cream","copper-peptide-restore-cream","firming-peptide-eye-gel"];
const PRICES = ["55.00","80.00","90.00","98.34","90.00","100.00","68.00","76.67"];
const NAMES = ["Enzyme Gel Cleanser","Exfoliating Pads","Hyaluronic Serum","Retinol Rx","Hydra C + Ferulic Serum","Peptide Anti-Wrinkle Day Cream","Copper Peptide Restore Cream","Firming Peptide Eye Gel"];
const pid = i => `gid://shopify/Product/99000000000${100 + i}`, vid = i => `gid://shopify/ProductVariant/99000000000${200 + i}`;
// FAKE_SKINCARE=qualified (default) | held-retinol (Retinol price drift) | down (qualification outage)
const stock = Object.fromEntries(ACTIVE.map(h => [h, Number(process.env.S8939_STOCK || 28)]));
const skincareNode = i => {
  const mode = process.env.FAKE_SKINCARE || "qualified";
  return {id: vid(i), title: "Default Title", availableForSale: true, currentlyNotInStock: false, quantityAvailable: stock[ACTIVE[i]],
    price: money(mode === "held-retinol" && ACTIVE[i] === "retinol-rx" ? "99.00" : PRICES[i]),
    product: {id: pid(i), handle: ACTIVE[i], tags: ["iqon-skincare"], availableForSale: true, requiresSellingPlan: false}};
};
const BUNDLE = new Set(SUPPLEMENTS.map(s => s[0]));
const TIERS = [{min: 3, rate: 25, title: "Bundle: Buy 3, save 25%"}, {min: 2, rate: 10, title: "Bundle: Buy 2, save 10%"}];
const carts = new Map();
const variantInfo = id => {
  const s = catalog.find(p => p.variants.nodes[0].id === id);
  if (s) return {handle: s.handle, title: s.title, tags: s.tags, price: s.variants.nodes[0].price.amount};
  const i = ACTIVE.findIndex((_, j) => vid(j) === id);
  return i >= 0 ? {handle: ACTIVE[i], title: NAMES[i], tags: ["iqon-skincare"], price: skincareNode(i).price.amount} : null;
};
function cartShape(id) {
  const {lines, codes} = carts.get(id);
  const units = lines.filter(l => BUNDLE.has(variantInfo(l.merchandiseId).handle)).reduce((n, l) => n + l.quantity, 0);
  const tier = TIERS.find(t => units >= t.min);
  const nodes = lines.map((l, i) => {
    const v = variantInfo(l.merchandiseId), unit = Math.round(Number(v.price) * 100), gross = unit * l.quantity;
    const saved = tier && BUNDLE.has(v.handle) ? Math.floor(unit * tier.rate / 100) * l.quantity : 0;
    return {id: `gid://shopify/CartLine/${i + 1}`, quantity: l.quantity, cost: {subtotalAmount: money((gross / 100).toFixed(2)), totalAmount: money(((gross - saved) / 100).toFixed(2))},
      discountAllocations: saved ? [{discountedAmount: money((saved / 100).toFixed(2)), title: tier.title}] : [], sellingPlanAllocation: null,
      merchandise: {id: l.merchandiseId, title: "Default Title", image: null, product: {handle: v.handle, title: v.title, tags: v.tags}}};
  });
  const afterBundles = nodes.reduce((s, l) => s + Math.round(Number(l.cost.totalAmount.amount) * 100), 0);
  // The approved affiliate code: 10% order discount on the whole bag, applied after bundle savings.
  const code = codes.find(c => c === "IQON10");
  const orderSaved = code ? Math.round(afterBundles * 10 / 100) : 0;
  const total = money(((afterBundles - orderSaved) / 100).toFixed(2));
  return {id, checkoutUrl: `https://iqon-test.myshopify.com/cart/c/${encodeURIComponent(id.split("/").pop())}?key=synthetic`, totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    discountCodes: codes.map(c => ({code: c, applicable: c === "IQON10"})), discountAllocations: orderSaved ? [{discountedAmount: money((orderSaved / 100).toFixed(2)), code: "IQON10"}] : [],
    cost: {subtotalAmount: money((afterBundles / 100).toFixed(2)), totalAmount: total}, lines: {pageInfo: {hasNextPage: false}, nodes}};
}
function cartResponse(op, v) {
  const payload = id => ({cart: cartShape(id), userErrors: [], warnings: []});
  if (op === "Read") return {cart: carts.has(v.id) ? cartShape(v.id) : null};
  if (op === "Create") { const id = `gid://shopify/Cart/s8939-${carts.size + 1}`; carts.set(id, {lines: v.input.lines.map(l => ({...l})), codes: []}); return {cartCreate: payload(id)}; }
  const cart = carts.get(v.cartId);
  if (op === "Add") { for (const l of v.lines) { const same = cart.lines.find(x => x.merchandiseId === l.merchandiseId); if (same) same.quantity += l.quantity; else cart.lines.push({...l}); } return {cartLinesAdd: payload(v.cartId)}; }
  if (op === "Update") { for (const u of v.lines) cart.lines[Number(u.id.split("/").pop()) - 1].quantity = u.quantity; return {cartLinesUpdate: payload(v.cartId)}; }
  if (op === "Discounts") { cart.codes = v.discountCodes; return {cartDiscountCodesUpdate: payload(v.cartId)}; }
  cart.lines = cart.lines.filter((_, i) => !v.lineIds.includes(`gid://shopify/CartLine/${i + 1}`));
  return {cartLinesRemove: payload(v.cartId)};
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const host = new URL(url).hostname;
  if (host === "127.0.0.1" || host === "localhost") return realFetch(input, init);
  if (url === "https://iqon-test.myshopify.com/api/2026-07/graphql.json") {
    const {query, variables} = JSON.parse(init.body);
    if (query.includes("IQONSkincareQualification")) {
      if (process.env.FAKE_SKINCARE === "down") return new Response("synthetic outage", {status: 503});
      return Response.json({data: {nodes: variables.ids.map(id => { const i = ACTIVE.findIndex((_, j) => vid(j) === id); return i >= 0 ? skincareNode(i) : null; })}});
    }
    if (query.includes("IQONCatalog")) return Response.json({data: {products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: catalog}}});
    const op = query.match(/IQONCart(Read|Create|Add|Update|Remove|Discounts)\b/)?.[1] || (query.includes("IQONCheckoutConsent") ? "Read" : null);
    if (op) return Response.json({data: cartResponse(op, variables)});
    return Response.json({errors: [{message: "MOCK: unsupported operation"}]});
  }
  fs.appendFileSync(BLOCK_LOG, `${new Date().toISOString()} ${init?.method || "GET"} ${host}\n`);
  throw new Error(`blocked external request in S8939 QA: ${host}`);
};
export const S8939_FIXTURE_IDENTITY = {store: "iqon-test.myshopify.com", currency: "USD", products: ACTIVE.map((handle, i) => ({handle, supplierSku: `SYNTH${i}`, approvedPriceUsd: PRICES[i], productId: pid(i), variantId: vid(i)}))};
