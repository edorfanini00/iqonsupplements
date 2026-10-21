import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalProduction, isIndexable, isListedProduct, jsonLdScript, normalHost, pageMetadata, productJsonLd, robotsRules, sitemapPaths, articleJsonLd } from "../../lib/seo";
import { LEGACY_PRODUCT_REDIRECTS } from "../../lib/legacy-redirects";
import type { Product, StoreCatalog } from "../../lib/catalog";
import { journalArticles } from "../../lib/journal";

const listed: Product = {id: "creatine-monohydrate", name: "Creatine", category: "supplements", type: "Powder", number: "01", price: 39, size: "", descriptor: "", description: "d",
  image: "https://cdn.shopify.com/a.jpg", campaign: "", tone: "", ritual: "", currency: "USD", available: true,
  variants: [{id: "v1", title: "Default Title", price: 39, currency: "USD", available: true}], images: [{src: "https://cdn.shopify.com/a.jpg", alt: "a"}]};
const placeholder: Product = {...listed, id: "keto-5", variants: []};
const live: StoreCatalog = {mode: "live", currency: "USD", products: [listed, placeholder]};
// A successful Shopify response with no products: the merged catalog holds only editorial placeholders.
const emptyLive: StoreCatalog = {mode: "live", currency: "USD", products: [placeholder]};
const prod = {vercelEnv: "production", host: "www.iqondaily.com", catalog: live};

test("only the production deployment on www.iqondaily.com is indexable", () => {
  assert.equal(isCanonicalProduction(prod), true);
  assert.equal(isCanonicalProduction({...prod, host: "WWW.IQONDAILY.COM:443"}), true);
  for (const host of ["iqondaily.com", "www.iqonbody.com", "iqonbody.com", "iqon-supplements.vercel.app", "localhost:3000", "www.iqondaily.com.evil.example", "", null])
    assert.equal(isCanonicalProduction({...prod, host}), false, String(host));
  for (const vercelEnv of ["preview", "development", undefined]) assert.equal(isCanonicalProduction({...prod, vercelEnv}), false);
  assert.equal(normalHost("www.iqondaily.com, proxy"), "www.iqondaily.com");
});

test("catalog-dependent pages fail closed unless Shopify is live", () => {
  for (const catalog of [{...live, mode: "preview" as const}, {mode: "unavailable" as const, products: [], currency: "USD"}, emptyLive, undefined]) {
    assert.equal(isIndexable({...prod, catalog}, {requiresLiveCatalog: true}), false, catalog?.mode);
    assert.equal(isIndexable({...prod, catalog}), true, "static pages stay indexable");
  }
  assert.equal(isIndexable(prod, {requiresLiveCatalog: true}), true);
  assert.equal(isIndexable(prod, {requiresLiveCatalog: true, catalogCategory: "skincare"}), false, "no listed skincare");
  assert.equal(isIndexable(prod, {requiresLiveCatalog: true, eligible: false}), false);
});

test("only Shopify-backed products are listed", () => {
  assert.equal(isListedProduct(live, listed), true);
  assert.equal(isListedProduct(live, placeholder), false);
  assert.equal(isListedProduct({...live, mode: "preview"}, listed), false);
  assert.equal(isListedProduct(live, undefined), false);
  for (const {handle} of LEGACY_PRODUCT_REDIRECTS) assert.equal(isListedProduct(live, {...listed, id: handle}), false, handle);
});

test("metadata always canonicalizes to www and noindexes non-canonical copies", () => {
  const meta = pageMetadata({path: "/collections/supplements", title: "t", description: "d", indexable: false});
  assert.equal(meta.alternates?.canonical, "https://www.iqondaily.com/collections/supplements");
  assert.deepEqual(meta.robots, {index: false, follow: true});
  assert.deepEqual(pageMetadata({path: "/", title: "t", indexable: true}).robots, {index: true, follow: true});
});

test("robots.txt: canonical lists sitemap and private exclusions, aliases omit sitemap, previews block all", () => {
  const canonical = robotsRules(prod);
  assert.equal(canonical.sitemap, "https://www.iqondaily.com/sitemap.xml");
  assert.deepEqual(canonical.rules, [{userAgent: "*", allow: "/", disallow: ["/account", "/affiliates", "/checkout", "/api/"]}]);
  const alias = robotsRules({...prod, host: "www.iqonbody.com"});
  assert.equal(alias.sitemap, undefined);
  assert.deepEqual(alias.rules, canonical.rules);
  assert.deepEqual(robotsRules({...prod, vercelEnv: "preview"}).rules, [{userAgent: "*", disallow: "/"}]);
  // No crawler-specific groups: a separate GPTBot group would silently drop the private exclusions for it.
  assert.equal(JSON.stringify(canonical).includes("GPTBot"), false);
});

test("sitemap lists canonical 200 pages only", () => {
  const paths = sitemapPaths({...prod, catalog: {...live, products: [...live.products, ...LEGACY_PRODUCT_REDIRECTS.map(r => ({...listed, id: r.handle}))]}}, journalArticles);
  assert.ok(paths.includes("/") && paths.includes("/products/creatine-monohydrate") && paths.includes(`/journal/${journalArticles[0].slug}`));
  assert.equal(paths.includes("/products/keto-5"), false);
  for (const banned of ["/reviews", "/checkout", "/account", "/affiliates"]) assert.equal(paths.some(p => p.startsWith(banned)), false, banned);
  assert.equal(paths.some(p => p.includes("?")), false);
  assert.equal(paths.some(p => LEGACY_PRODUCT_REDIRECTS.some(r => p === `/products/${r.handle}`)), false, "redirect sources");
  assert.equal(paths.includes("/collections/skincare"), false, "no listed skincare products");
  assert.equal(new Set(paths).size, paths.length);
  const staticOnly = ["/approach", "/journal", ...journalArticles.map(a => `/journal/${a.slug}`)];
  // Outage, preview fixtures and a successful-but-empty Shopify response all fall back to static pages.
  for (const catalog of [{mode: "unavailable" as const, products: [], currency: "USD"}, {...live, mode: "preview" as const}, emptyLive])
    assert.deepEqual(sitemapPaths({...prod, catalog}, journalArticles), staticOnly, catalog.mode);
  assert.deepEqual(sitemapPaths({...prod, host: "iqondaily.com"}, journalArticles), []);
  assert.deepEqual(sitemapPaths({...prod, vercelEnv: "preview"}, journalArticles), []);
});

test("Product JSON-LD mirrors visible facts and invents nothing", () => {
  const data = productJsonLd(listed, false)!;
  assert.deepEqual(data.offers, {"@type": "Offer", url: "https://www.iqondaily.com/products/creatine-monohydrate", price: "39.00", priceCurrency: "USD", availability: "https://schema.org/InStock"});
  for (const invented of ["aggregateRating", "review", "gtin", "sku", "priceValidUntil", "hasMerchantReturnPolicy", "shippingDetails"]) assert.equal(invented in data, false, invented);
  // No verifiable one-time offer: no Product node at all (an offer-less Product is an invalid rich result).
  assert.equal(productJsonLd(listed, true), null, "coming soon");
  assert.equal(productJsonLd({...listed, requiresSellingPlan: true}, false), null, "subscription only");
  assert.equal(productJsonLd({...listed, pricePending: true}, false), null, "unpriced");
  assert.equal(productJsonLd({...listed, variants: []}, false), null, "no variant");
  const sold = productJsonLd({...listed, available: false, variants: [{...listed.variants![0], available: false}]}, false) as {offers: {availability: string}};
  assert.equal(sold.offers.availability, "https://schema.org/OutOfStock");
});

test("Article JSON-LD has no fabricated dates or people", () => {
  const data = articleJsonLd(journalArticles[0]);
  for (const key of ["datePublished", "dateModified"]) assert.equal(key in data, false);
  assert.equal((data.author as {"@type": string})["@type"], "Organization");
});

test("JSON-LD cannot break out of its script element", () => {
  assert.equal(jsonLdScript({name: "</script><script>x</script>"}).includes("<"), false);
});
