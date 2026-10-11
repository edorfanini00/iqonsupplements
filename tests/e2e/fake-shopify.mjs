// Preloaded into `next start` for browser tests only (NODE_OPTIONS=--import). It answers the
// Storefront API for SHOPIFY_STORE_DOMAIN in process and refuses every other outbound request,
// so no real store, cart, checkout, Meta or analytics endpoint can be reached.
import fs from "node:fs";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const ledger = process.env.FAKE_SHOPIFY_LEDGER;
const control = process.env.FAKE_SHOPIFY_CONTROL;
const realFetch = globalThis.fetch;
const money = amount => ({amount: amount.toFixed(2), currencyCode: "USD"});
const products = [
  {handle: "creatine-monohydrate", title: "Creatine Monohydrate", price: 29, variant: "gid://shopify/ProductVariant/9001"},
  {handle: "magnesium-glycinate", title: "Magnesium Glycinate", price: 32, variant: "gid://shopify/ProductVariant/9002"},
];
const carts = new Map(); let serial = 0;
const settings = () => {try {return JSON.parse(fs.readFileSync(control, "utf8"));} catch {return {};}};
const record = entry => fs.appendFileSync(ledger, JSON.stringify({at: Date.now(), ...entry}) + "\n");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cartView = cart => {
  const nodes = cart.lines.map(line => {const p = products.find(item => item.variant === line.variant); return {
    id: line.id, quantity: line.quantity, cost: {totalAmount: money(p.price * line.quantity)}, sellingPlanAllocation: null,
    merchandise: {id: p.variant, title: "Default Title", image: null, product: {handle: p.handle, title: p.title, tags: ["iqon-supplements"]}}};});
  const total = nodes.reduce((sum, line) => sum + Number(line.cost.totalAmount.amount), 0);
  return {id: cart.id, checkoutUrl: `https://${domain}/cart/c/e2e-${cart.serial}?key=e2e-fixture`, totalQuantity: cart.lines.reduce((s, l) => s + l.quantity, 0),
    discountCodes: [], cost: {subtotalAmount: money(total), totalAmount: money(total)}, lines: {pageInfo: {hasNextPage: false}, nodes}};
};
const addLines = (cart, lines) => {for (const input of lines) {
  const existing = cart.lines.find(line => line.variant === input.merchandiseId);
  if (existing) existing.quantity += input.quantity; else cart.lines.push({id: `gid://shopify/CartLine/${cart.serial}-${cart.lines.length + 1}`, variant: input.merchandiseId, quantity: input.quantity});
}};

globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return realFetch(input, init);
  if (!url.startsWith(`https://${domain}/api/`)) {record({blockedOutbound: new URL(url).host}); throw new TypeError("outbound request blocked in browser tests");}
  const {query, variables} = JSON.parse(init.body);
  const operation = query.match(/(?:query|mutation) (\w+)/)[1];
  const version = url.split("/api/")[1].split("/")[0];
  const control = settings();
  if (operation === "IQONCatalog") return Response.json({data: {products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: products.map(p => ({
    id: `gid://shopify/Product/${p.handle}`, handle: p.handle, title: p.title, description: "Browser test fixture", productType: "Powder", tags: ["iqon-supplements"],
    availableForSale: true, requiresSellingPlan: false, images: {nodes: []},
    variants: {pageInfo: {hasNextPage: false}, nodes: [{id: p.variant, title: "Default Title", availableForSale: true, price: money(p.price), sellingPlanAllocations: {pageInfo: {hasNextPage: false}, nodes: []}}]},
  }))}}});
  if (operation === "IQONCheckoutCart") {
    const consent = variables.visitorConsent ?? null;
    record({operation, version, consent, hasDirective: /@inContext\(visitorConsent: \$visitorConsent\)/.test(query)});
    if (control.checkoutDelayMs) await sleep(control.checkoutDelayMs);
    if (control.failCheckout) return Response.json({errors: [{message: "fixture failure"}]});
    const cart = carts.get(variables.id);
    const view = cart && cartView(cart);
    if (view && consent) view.checkoutUrl += `&_cs=${Buffer.from(JSON.stringify(consent)).toString("base64url")}`;
    return Response.json({data: {cart: view || null}});
  }
  record({operation, version});
  if (operation === "IQONCartRead") {const cart = carts.get(variables.id); return Response.json({data: {cart: cart ? cartView(cart) : null}});}
  let cart; let key;
  if (operation === "IQONCartCreate") {serial++; cart = {id: `gid://shopify/Cart/e2e-${serial}`, serial, lines: []}; carts.set(cart.id, cart); addLines(cart, variables.input.lines); key = "cartCreate";}
  else {
    cart = carts.get(variables.cartId);
    if (operation === "IQONCartAdd") {addLines(cart, variables.lines); key = "cartLinesAdd";}
    if (operation === "IQONCartUpdate") {for (const l of variables.lines) cart.lines.find(line => line.id === l.id).quantity = l.quantity; key = "cartLinesUpdate";}
    if (operation === "IQONCartRemove") {cart.lines = cart.lines.filter(line => !variables.lineIds.includes(line.id)); key = "cartLinesRemove";}
    if (operation === "IQONCartDiscounts") key = "cartDiscountCodesUpdate";
  }
  return Response.json({data: {[key]: {cart: cartView(cart), userErrors: [], warnings: []}}});
};
