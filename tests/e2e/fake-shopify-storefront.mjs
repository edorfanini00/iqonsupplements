// MOCK Shopify Storefront API for the advertising-privacy browser tests. Loaded into `next start`
// by tests/e2e/ad-privacy-server-hook.mjs. State lives in a JSON file so the test process can
// inspect carts and toggle failures. `_cs` here is a SYNTHETIC JSON stand-in for Shopify's opaque
// value; nothing in these tests proves Shopify's own behaviour.
import fs from "node:fs";

export const STORE = "iqon-e2e.myshopify.com";
export const VARIANTS = {creatine: "52086268985639", glp1: "52086119760167"};
const PRODUCTS = [
  {handle: "creatine-monohydrate", title: "Creatine Monohydrate", variant: VARIANTS.creatine, price: "29.00"},
  {handle: "glp-1-support", title: "GLP-1 Support", variant: VARIANTS.glp1, price: "39.00"},
];
const money = amount => ({amount: Number(amount).toFixed(2), currencyCode: "USD"});

export function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {carts: {}, serial: 0, contexts: [], attributeWrites: 0, failContext: 0, failAttributes: 0}; }
}
export const writeState = (file, state) => fs.writeFileSync(file, JSON.stringify(state));

function recalculate(cart) {
  let total = 0;
  for (const line of cart.lines.nodes) {
    const product = PRODUCTS.find(p => `gid://shopify/ProductVariant/${p.variant}` === line.merchandise.id);
    const amount = Number(product.price) * line.quantity; total += amount;
    line.cost = {totalAmount: money(amount)};
  }
  cart.totalQuantity = cart.lines.nodes.reduce((sum, line) => sum + line.quantity, 0);
  cart.cost = {subtotalAmount: money(total), totalAmount: money(total)};
}

export function handleStorefront(file, body) {
  const {query, variables} = JSON.parse(body);
  const operation = query.match(/(?:query|mutation) (\w+)/)[1];
  const state = readState(file);
  const respond = data => { writeState(file, state); return Response.json({data}); };
  if (operation === "IQONCatalog") return respond({products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: PRODUCTS.map(p => ({
    handle: p.handle, title: p.title, description: "MOCK product", productType: "Powder", tags: ["iqon-supplements"], availableForSale: true, requiresSellingPlan: false,
    images: {nodes: []}, variants: {pageInfo: {hasNextPage: false}, nodes: [{id: `gid://shopify/ProductVariant/${p.variant}`, title: "Default Title", availableForSale: true, price: money(p.price), sellingPlanAllocations: {pageInfo: {hasNextPage: false}, nodes: []}}]},
  }))}});
  const cartFor = id => state.carts[id] || null;
  if (operation === "IQONCartRead") return respond({cart: cartFor(variables.id)});
  if (operation === "IQONCartCheckout") {
    state.contexts.push({cart: variables.id, consent: variables.consent});
    if (state.failContext > 0) { state.failContext--; writeState(file, state); return new Response("unavailable", {status: 503}); }
    const cart = cartFor(variables.id);
    return respond({cart: cart && {...cart, checkoutUrl: `${cart.checkoutUrl}?_cs=${encodeURIComponent(JSON.stringify(variables.consent))}`}});
  }
  if (operation === "IQONCartAttributes") {
    if (state.failAttributes > 0) { state.failAttributes--; writeState(file, state); return new Response("unavailable", {status: 503}); }
    const cart = cartFor(variables.cartId);
    cart.attributes = variables.attributes; state.attributeWrites++;
    return respond({cartAttributesUpdate: {cart, userErrors: [], warnings: []}});
  }
  let cart, field;
  if (operation === "IQONCartCreate") {
    const id = `gid://shopify/Cart/e2e-${++state.serial}`;
    cart = state.carts[id] = {id, checkoutUrl: `https://${STORE}/checkouts/cn/e2e-${state.serial}`, attributes: [], discountCodes: [], lines: {pageInfo: {hasNextPage: false}, nodes: []}};
    field = "cartCreate";
  } else cart = cartFor(variables.cartId);
  if (operation === "IQONCartCreate" || operation === "IQONCartAdd") {
    field ||= "cartLinesAdd";
    for (const input of variables.input?.lines || variables.lines) {
      const existing = cart.lines.nodes.find(line => line.merchandise.id === input.merchandiseId);
      const product = PRODUCTS.find(p => `gid://shopify/ProductVariant/${p.variant}` === input.merchandiseId);
      if (existing) existing.quantity += input.quantity;
      else cart.lines.nodes.push({id: `gid://shopify/CartLine/${product.variant}`, quantity: input.quantity, sellingPlanAllocation: null,
        merchandise: {id: input.merchandiseId, title: "Default Title", image: null, product: {handle: product.handle, title: product.title, tags: ["iqon-supplements"]}}});
    }
  } else if (operation === "IQONCartUpdate") {
    field = "cartLinesUpdate";
    for (const input of variables.lines) cart.lines.nodes.find(line => line.id === input.id).quantity = input.quantity;
  } else if (operation === "IQONCartRemove") {
    field = "cartLinesRemove";
    cart.lines.nodes = cart.lines.nodes.filter(line => !variables.lineIds.includes(line.id));
  } else if (operation === "IQONCartDiscounts") {
    field = "cartDiscountCodesUpdate";
    cart.discountCodes = [];
  }
  if (!field) return new Response(`MOCK: unhandled ${operation}`, {status: 400});
  recalculate(cart);
  return respond({[field]: {cart, userErrors: [], warnings: []}});
}
