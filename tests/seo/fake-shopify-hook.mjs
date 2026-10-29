// Loaded into `next start` with NODE_OPTIONS=--import for the SEO route matrix ONLY.
// Answers Storefront catalog queries with synthetic products (FAKE_SHOPIFY=live), a successful
// response with no products (FAKE_SHOPIFY=empty) or a store outage (FAKE_SHOPIFY=down), and refuses
// every other external request. Policy JSON is synthetic unless FAKE_POLICIES=published explicitly
// enables read-only HTTPS integration with the five fixed published policy endpoints.
// Cart reads, creates, adds, updates and removes use an in-memory synthetic cart whose
// checkoutUrl is never fetched (browser tests abort it): this proves the storefront handoff, not Shopify checkout.
// Bundle tiers are emulated like the Shopify automatic discounts: any mix of eligible units, best tier only,
// reported as line discount allocations with the discount title. The Daily Travel Kit is not eligible.
// The NMN title is a deliberate XSS fixture and the cdn.shopify.com test images do not resolve: screenshots of this catalog are not production imagery.
const money = amount => ({amount, currencyCode: "USD"});
const variant = (id, price, available = true) => ({id: `gid://shopify/ProductVariant/${id}`, title: "Default Title", availableForSale: available, price: money(price)});
const ELIGIBLE = new Set(["creatine-monohydrate", "liver-support", "nmn"]);
const TIERS = [{min: 3, rate: 25, title: "Bundle: Buy 3, save 25%"}, {min: 2, rate: 10, title: "Bundle: Buy 2, save 10%"}];
const product = (handle, title, tag, v, extra = {}) => ({handle, title, description: `${title} synthetic test description.`, productType: "", tags: [tag],
  availableForSale: v.availableForSale, requiresSellingPlan: false, images: {nodes: [{url: `https://cdn.shopify.com/test/${handle}.jpg`, altText: `${title} packaging`}]},
  variants: {pageInfo: {hasNextPage: false}, nodes: [v]}, ...extra});
const catalog = [
  // One time purchases only; both are bundle eligible.
  product("creatine-monohydrate", "Creatine Monohydrate", "iqon-supplements", variant(1, "39.00"), {productType: "Powder"}),
  product("liver-support", "Liver Support", "iqon-supplements", variant(4, "45.00"), {productType: "Capsules"}),
  // Sold out: never linked from guides as a next purchase step.
  product("nmn", "NMN </script><script>alert(1)</script>", "iqon-supplements", variant(2, "59.50", false), {productType: "Capsules"}),
  product("anti-aging-cleanser-with-peptides", "Anti-Aging Cleanser", "iqon-skincare", variant(3, "48.00")),
  // A tagged Shopify product with no editorial productContent: rendered by the generic PDP. Not bundle eligible.
  product("daily-travel-kit", "Daily Travel Kit", "iqon-supplements", variant(8, "25.00")),
  // Handles that next.config permanently redirects: never sitemap entries.
  product("gentle-cleanser", "Gentle Cleanser", "iqon-skincare", variant(5, "30.00")),
  product("peptide-serum", "Peptide Serum", "iqon-skincare", variant(6, "60.00")),
  product("barrier-cream", "Barrier Cream", "iqon-skincare", variant(7, "55.00")),
];
// Opt-in realistic monetary widths for purchase-clarity checks; default SEO/layout fixtures stay unchanged.
if (process.env.FAKE_CATALOG === "purchase-clarity") {
  catalog[0].variants.nodes[0].price = money("48.97");
  for (const [handle,title,id,price] of [
    ["hydrolyzed-collagen-peptides","Hydrolyzed Collagen Peptides",11,"65.64"],
    ["colostrum-powder","Colostrum Powder",12,"42.17"],
    ["collagen-peptides-chocolate","Grass-Fed Collagen Peptides",13,"70.84"],
    ["colon-gentle-cleanse","Colon Gentle Cleanse",14,"66.84"],
  ]) {
    catalog.push(product(handle,title,"iqon-supplements",variant(id,price),{productType:"Powder"}));
    ELIGIBLE.add(handle);
  }
}
const carts = new Map();
const variantProduct = id => catalog.find(p => p.variants.nodes.some(v => v.id === id));
function cartShape(id, lines) {
  const units = lines.filter(line => ELIGIBLE.has(variantProduct(line.merchandiseId).handle)).reduce((n, line) => n + line.quantity, 0);
  const tier = TIERS.find(t => units >= t.min);
  const nodes = lines.map((line, i) => {
    const p = variantProduct(line.merchandiseId); const v = p.variants.nodes.find(x => x.id === line.merchandiseId);
    const gross = Math.round(Number(v.price.amount) * 100) * line.quantity;
    const saved = tier && ELIGIBLE.has(p.handle) ? Math.floor(Math.round(Number(v.price.amount) * 100) * tier.rate / 100) * line.quantity : 0;
    return {id: `gid://shopify/CartLine/${i + 1}`, quantity: line.quantity, cost: {subtotalAmount: money((gross / 100).toFixed(2)), totalAmount: money(((gross - saved) / 100).toFixed(2))},
      discountAllocations: saved ? [{discountedAmount: money((saved / 100).toFixed(2)), title: tier.title}] : [], sellingPlanAllocation: null,
      merchandise: {id: v.id, title: v.title, image: p.images.nodes[0], product: {handle: p.handle, title: p.title, tags: p.tags}}};
  });
  const subtotal = money(nodes.reduce((sum, l) => sum + Number(l.cost.totalAmount.amount), 0).toFixed(2));
  return {id, checkoutUrl: `https://iqon-test.myshopify.com/cart/c/${encodeURIComponent(id.split("/").pop())}?key=synthetic`, totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    discountCodes: [], discountAllocations: [], cost: {subtotalAmount: subtotal, totalAmount: subtotal}, lines: {pageInfo: {hasNextPage: false}, nodes}};
}
function cartResponse(operation, variables) {
  const payload = id => ({cart: cartShape(id, carts.get(id)), userErrors: [], warnings: []});
  if (operation === "Read") return {cart: carts.has(variables.id) ? cartShape(variables.id, carts.get(variables.id)) : null};
  if (operation === "Create") {const id = `gid://shopify/Cart/synthetic-${carts.size + 1}`; carts.set(id, variables.input.lines.map(l => ({...l}))); return {cartCreate: payload(id)};}
  if (operation === "Add") {
    const lines = carts.get(variables.cartId);
    for (const l of variables.lines) {const same = lines.find(x => x.merchandiseId === l.merchandiseId); if (same) same.quantity += l.quantity; else lines.push({...l});}
    return {cartLinesAdd: payload(variables.cartId)};
  }
  if (operation === "Update") {
    const lines = carts.get(variables.cartId);
    for (const u of variables.lines) lines[Number(u.id.split("/").pop()) - 1].quantity = u.quantity;
    return {cartLinesUpdate: payload(variables.cartId)};
  }
  carts.set(variables.cartId, carts.get(variables.cartId).filter((_, i) => !variables.lineIds.includes(`gid://shopify/CartLine/${i + 1}`)));
  return {cartLinesRemove: payload(variables.cartId)};
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  const policySlug = url.match(/^https:\/\/nr9zd0-t5\.myshopify\.com\/policies\/(shipping-policy|refund-policy|subscription-policy|terms-of-service|contact-information)\.json$/)?.[1];
  if (policySlug) {
    if (process.env.FAKE_POLICIES === "published") return realFetch(input, init);
    if (process.env.FAKE_SHOPIFY === "down" || process.env.FAKE_POLICIES === "down") return new Response("unavailable", {status: 503});
    const title = {"shipping-policy": "Shipping policy", "refund-policy": "Refund policy", "subscription-policy": "Cancellation policy", "terms-of-service": "Terms of service", "contact-information": "Contact information"}[policySlug];
    return Response.json({policy: {handle: policySlug, title, body: `<p>Published synthetic ${policySlug} content.</p><h2>Details &amp; care</h2><p>Contact <a href="mailto:info@example.com">support</a>.</p><script>alert(1)</script><img src=x onerror=alert(1)>`}});
  }
  if (/^https:\/\/[a-z0-9-]+\.myshopify\.com\/api\//.test(url)) {
    if (process.env.FAKE_SHOPIFY === "down") return new Response("unavailable", {status: 503});
    const {query} = JSON.parse(String(init?.body || "{}"));
    const {variables = {}} = JSON.parse(String(init?.body || "{}"));
    const cartOperation = query?.match(/IQONCart(Read|Create|Add|Update|Remove)\b/)?.[1];
    if (cartOperation) return Response.json({data: cartResponse(cartOperation, variables)});
    if (query?.includes("IQONCatalog")) return Response.json({data: {products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: process.env.FAKE_SHOPIFY === "empty" ? [] : catalog}}});
    return Response.json({errors: [{message: "MOCK: unsupported operation"}]});
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return realFetch(input, init);
  throw new Error(`blocked external request in SEO route matrix: ${new URL(url).host}`);
};
