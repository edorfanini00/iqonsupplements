// Loaded into `next start` with NODE_OPTIONS=--import for the SEO route matrix ONLY.
// Answers Storefront catalog queries with synthetic products (FAKE_SHOPIFY=live), a successful
// response with no products (FAKE_SHOPIFY=empty) or a store outage (FAKE_SHOPIFY=down), and refuses
// every other external request. Cart reads, creates, adds and removes use an in-memory synthetic cart whose
// checkoutUrl is never fetched (browser tests abort it): this proves the storefront handoff, not Shopify checkout.
// The NMN title is a deliberate XSS fixture and the cdn.shopify.com test images do not resolve: screenshots of this catalog are not production imagery.
const money = amount => ({amount, currencyCode: "USD"});
const monthly = (price, compareAt) => ({sellingPlan: {id: "gid://shopify/SellingPlan/1", name: "Delivered monthly", recurringDeliveries: true,
  billingPolicy: {interval: "MONTH", intervalCount: 1}, deliveryPolicy: {interval: "MONTH", intervalCount: 1}, options: [{name: "Delivery", value: "Monthly"}], priceAdjustments: [{orderCount: null}]},
  priceAdjustments: [{price: money(price), compareAtPrice: money(compareAt), perDeliveryPrice: money(price)}]});
const variant = (id, price, available = true, plans = []) => ({id: `gid://shopify/ProductVariant/${id}`, title: "Default Title", availableForSale: available,
  price: money(price), sellingPlanAllocations: {pageInfo: {hasNextPage: false}, nodes: plans}});
const product = (handle, title, tag, v, extra = {}) => ({handle, title, description: `${title} synthetic test description.`, productType: "", tags: [tag],
  availableForSale: v.availableForSale, requiresSellingPlan: false, images: {nodes: [{url: `https://cdn.shopify.com/test/${handle}.jpg`, altText: `${title} packaging`}]},
  variants: {pageInfo: {hasNextPage: false}, nodes: [v]}, ...extra});
const catalog = [
  // Subscription is the default selection on the page; the one-time price is the offer.
  product("creatine-monohydrate", "Creatine Monohydrate", "iqon-supplements", variant(1, "39.00", true, [monthly("33.15", "39.00")]), {productType: "Powder"}),
  product("liver-support", "Liver Support", "iqon-supplements", variant(4, "45.00", true, [monthly("38.25", "45.00")]), {requiresSellingPlan: true, productType: "Capsules"}),
  // Sold out: never linked from guides as a next purchase step.
  product("nmn", "NMN </script><script>alert(1)</script>", "iqon-supplements", variant(2, "59.50", false), {productType: "Capsules"}),
  product("anti-aging-cleanser-with-peptides", "Anti-Aging Cleanser", "iqon-skincare", variant(3, "48.00")),
  // A tagged Shopify product with no editorial productContent: rendered by the generic PDP.
  product("daily-travel-kit", "Daily Travel Kit", "iqon-supplements", variant(8, "25.00")),
  // Handles that next.config permanently redirects: never sitemap entries.
  product("gentle-cleanser", "Gentle Cleanser", "iqon-skincare", variant(5, "30.00")),
  product("peptide-serum", "Peptide Serum", "iqon-skincare", variant(6, "60.00")),
  product("barrier-cream", "Barrier Cream", "iqon-skincare", variant(7, "55.00")),
];
const carts = new Map();
const variantProduct = id => catalog.find(p => p.variants.nodes.some(v => v.id === id));
function cartShape(id, lines) {
  const nodes = lines.map((line, i) => {
    const p = variantProduct(line.merchandiseId); const v = p.variants.nodes.find(x => x.id === line.merchandiseId);
    const plan = line.sellingPlanId && v.sellingPlanAllocations.nodes.find(a => a.sellingPlan.id === line.sellingPlanId);
    const unit = plan ? plan.priceAdjustments[0].price.amount : v.price.amount;
    return {id: `gid://shopify/CartLine/${i + 1}`, quantity: line.quantity, cost: {totalAmount: money((Number(unit) * line.quantity).toFixed(2))},
      sellingPlanAllocation: plan ? {sellingPlan: {id: plan.sellingPlan.id, name: plan.sellingPlan.name, options: plan.sellingPlan.options}} : null,
      merchandise: {id: v.id, title: v.title, image: p.images.nodes[0], product: {handle: p.handle, title: p.title, tags: p.tags}}};
  });
  const subtotal = money(nodes.reduce((sum, l) => sum + Number(l.cost.totalAmount.amount), 0).toFixed(2));
  return {id, checkoutUrl: `https://iqon-test.myshopify.com/cart/c/${encodeURIComponent(id.split("/").pop())}?key=synthetic`, totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    discountCodes: [], cost: {subtotalAmount: subtotal, totalAmount: subtotal}, lines: {pageInfo: {hasNextPage: false}, nodes}};
}
function cartResponse(operation, variables) {
  const payload = id => ({cart: cartShape(id, carts.get(id)), userErrors: [], warnings: []});
  if (operation === "Read") return {cart: carts.has(variables.id) ? cartShape(variables.id, carts.get(variables.id)) : null};
  if (operation === "Create") {const id = `gid://shopify/Cart/synthetic-${carts.size + 1}`; carts.set(id, variables.input.lines.map(l => ({...l}))); return {cartCreate: payload(id)};}
  if (operation === "Add") {carts.get(variables.cartId).push(...variables.lines.map(l => ({...l}))); return {cartLinesAdd: payload(variables.cartId)};}
  carts.set(variables.cartId, carts.get(variables.cartId).filter((_, i) => !variables.lineIds.includes(`gid://shopify/CartLine/${i + 1}`)));
  return {cartLinesRemove: payload(variables.cartId)};
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (/^https:\/\/[a-z0-9-]+\.myshopify\.com\/api\//.test(url)) {
    if (process.env.FAKE_SHOPIFY === "down") return new Response("unavailable", {status: 503});
    const {query} = JSON.parse(String(init?.body || "{}"));
    const {variables = {}} = JSON.parse(String(init?.body || "{}"));
    const cartOperation = query?.match(/IQONCart(Read|Create|Add|Remove)\b/)?.[1];
    if (cartOperation) return Response.json({data: cartResponse(cartOperation, variables)});
    if (query?.includes("IQONCatalog")) return Response.json({data: {products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: process.env.FAKE_SHOPIFY === "empty" ? [] : catalog}}});
    return Response.json({errors: [{message: "MOCK: unsupported operation"}]});
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return realFetch(input, init);
  throw new Error(`blocked external request in SEO route matrix: ${new URL(url).host}`);
};
