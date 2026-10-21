import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalProduction, isIndexable, isListedProduct, jsonLdScript, normalHost, pageMetadata, productJsonLd, robotsRules, sitemapPaths, articleJsonLd } from "../../lib/seo";
import type { Product, StoreCatalog } from "../../lib/catalog";
import { journalArticles } from "../../lib/journal";

const prod = {vercelEnv: "production", host: "www.iqondaily.com", catalogMode: "live" as const};
const listed: Product = {id: "creatine-monohydrate", name: "Creatine", category: "supplements", type: "Powder", number: "01", price: 39, size: "", descriptor: "", description: "d",
  image: "https://cdn.shopify.com/a.jpg", campaign: "", tone: "", ritual: "", currency: "USD", available: true,
  variants: [{id: "v1", title: "Default Title", price: 39, currency: "USD", available: true}], images: [{src: "https://cdn.shopify.com/a.jpg", alt: "a"}]};
const placeholder: Product = {...listed, id: "keto-5", variants: []};
const live: StoreCatalog = {mode: "live", currency: "USD", products: [listed, placeholder]};

test("only the production deployment on www.iqondaily.com is indexable", () => {
  assert.equal(isCanonicalProduction(prod), true);
  assert.equal(isCanonicalProduction({...prod, host: "WWW.IQONDAILY.COM:443"}), true);
  for (const host of ["iqondaily.com", "www.iqonbody.com", "iqonbody.com", "iqon-supplements.vercel.app", "localhost:3000", "www.iqondaily.com.evil.example", "", null])
    assert.equal(isCanonicalProduction({...prod, host}), false, String(host));
  for (const vercelEnv of ["preview", "development", undefined]) assert.equal(isCanonicalProduction({...prod, vercelEnv}), false);
  assert.equal(normalHost("www.iqondaily.com, proxy"), "www.iqondaily.com");
});

test("catalog-dependent pages fail closed unless Shopify is live", () => {
  for (const catalogMode of ["preview", "unavailable"] as const) {
    assert.equal(isIndexable({...prod, catalogMode}, {requiresLiveCatalog: true}), false);
    assert.equal(isIndexable({...prod, catalogMode}), true, "static pages stay indexable");
  }
  assert.equal(isIndexable(prod, {requiresLiveCatalog: true, eligible: false}), false);
});

test("only Shopify-backed products are listed", () => {
  assert.equal(isListedProduct(live, listed), true);
  assert.equal(isListedProduct(live, placeholder), false);
  assert.equal(isListedProduct({...live, mode: "preview"}, listed), false);
  assert.equal(isListedProduct(live, undefined), false);
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
  const paths = sitemapPaths(prod, live, journalArticles);
  assert.ok(paths.includes("/") && paths.includes("/products/creatine-monohydrate") && paths.includes(`/journal/${journalArticles[0].slug}`));
  assert.equal(paths.includes("/products/keto-5"), false);
  for (const banned of ["/reviews", "/checkout", "/account", "/affiliates"]) assert.equal(paths.some(p => p.startsWith(banned)), false, banned);
  assert.equal(paths.some(p => p.includes("?")), false);
  assert.equal(new Set(paths).size, paths.length);
  const down = sitemapPaths(prod, {mode: "unavailable", products: [], currency: "USD"}, journalArticles);
  assert.deepEqual(down, ["/approach", "/journal", ...journalArticles.map(a => `/journal/${a.slug}`)]);
  // The preview fixture catalog is never enumerated.
  assert.equal(sitemapPaths(prod, {...live, mode: "preview"}, journalArticles).some(p => p.startsWith("/products/")), false);
  assert.deepEqual(sitemapPaths({...prod, host: "iqondaily.com"}, live, journalArticles), []);
  assert.deepEqual(sitemapPaths({...prod, vercelEnv: "preview"}, live, journalArticles), []);
});

test("Product JSON-LD mirrors visible facts and invents nothing", () => {
  const data = productJsonLd(listed, false);
  assert.deepEqual(data.offers, {"@type": "Offer", url: "https://www.iqondaily.com/products/creatine-monohydrate", price: "39.00", priceCurrency: "USD", availability: "https://schema.org/InStock"});
  for (const invented of ["aggregateRating", "review", "gtin", "sku", "priceValidUntil", "hasMerchantReturnPolicy", "shippingDetails"]) assert.equal(invented in data, false, invented);
  assert.equal("offers" in productJsonLd(listed, true), false, "coming soon: no offer");
  assert.equal("offers" in productJsonLd({...listed, requiresSellingPlan: true}, false), false);
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
