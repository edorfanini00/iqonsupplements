// Loaded into `next start` with NODE_OPTIONS=--import for the SEO route matrix ONLY.
// Answers Storefront catalog queries with synthetic products (FAKE_SHOPIFY=live), a successful
// response with no products (FAKE_SHOPIFY=empty) or a store outage (FAKE_SHOPIFY=down), and refuses
// every other external request. The NMN title is a deliberate XSS fixture and the cdn.shopify.com
// test images do not resolve: screenshots of this catalog are not production imagery.
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
  product("creatine-monohydrate", "Creatine Monohydrate", "iqon-supplements", variant(1, "39.00", true, [monthly("33.15", "39.00")])),
  product("liver-support", "Liver Support", "iqon-supplements", variant(4, "45.00", true, [monthly("38.25", "45.00")]), {requiresSellingPlan: true}),
  product("nmn", "NMN </script><script>alert(1)</script>", "iqon-supplements", variant(2, "59.50", false)),
  product("anti-aging-cleanser-with-peptides", "Anti-Aging Cleanser", "iqon-skincare", variant(3, "48.00")),
  // Handles that next.config permanently redirects: never sitemap entries.
  product("gentle-cleanser", "Gentle Cleanser", "iqon-skincare", variant(5, "30.00")),
  product("peptide-serum", "Peptide Serum", "iqon-skincare", variant(6, "60.00")),
  product("barrier-cream", "Barrier Cream", "iqon-skincare", variant(7, "55.00")),
];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (/^https:\/\/[a-z0-9-]+\.myshopify\.com\/api\//.test(url)) {
    if (process.env.FAKE_SHOPIFY === "down") return new Response("unavailable", {status: 503});
    const {query} = JSON.parse(String(init?.body || "{}"));
    if (query?.includes("IQONCatalog")) return Response.json({data: {products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: process.env.FAKE_SHOPIFY === "empty" ? [] : catalog}}});
    return Response.json({errors: [{message: "MOCK: unsupported operation"}]});
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return realFetch(input, init);
  throw new Error(`blocked external request in SEO route matrix: ${new URL(url).host}`);
};
