// Loaded into `next start` with NODE_OPTIONS=--import for the SEO route matrix ONLY.
// Answers Storefront catalog queries with synthetic products (FAKE_SHOPIFY=live) or a
// store outage (FAKE_SHOPIFY=down), and refuses every other external request.
const variant = (id, price, available = true) => ({id: `gid://shopify/ProductVariant/${id}`, title: "Default Title", availableForSale: available,
  price: {amount: price, currencyCode: "USD"}, sellingPlanAllocations: {pageInfo: {hasNextPage: false}, nodes: []}});
const product = (handle, title, tag, v, extra = {}) => ({handle, title, description: `${title} synthetic test description.`, productType: "", tags: [tag],
  availableForSale: v.availableForSale, requiresSellingPlan: false, images: {nodes: [{url: `https://cdn.shopify.com/test/${handle}.jpg`, altText: `${title} packaging`}]},
  variants: {pageInfo: {hasNextPage: false}, nodes: [v]}, ...extra});
const catalog = [
  product("creatine-monohydrate", "Creatine Monohydrate", "iqon-supplements", variant(1, "39.00")),
  product("nmn", "NMN </script><script>alert(1)</script>", "iqon-supplements", variant(2, "59.50", false)),
  product("anti-aging-cleanser-with-peptides", "Anti-Aging Cleanser", "iqon-skincare", variant(3, "48.00")),
];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (/^https:\/\/[a-z0-9-]+\.myshopify\.com\/api\//.test(url)) {
    if (process.env.FAKE_SHOPIFY === "down") return new Response("unavailable", {status: 503});
    const {query} = JSON.parse(String(init?.body || "{}"));
    if (query?.includes("IQONCatalog")) return Response.json({data: {products: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: catalog}}});
    return Response.json({errors: [{message: "MOCK: unsupported operation"}]});
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return realFetch(input, init);
  throw new Error(`blocked external request in SEO route matrix: ${new URL(url).host}`);
};
