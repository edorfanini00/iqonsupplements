import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { otherGuideAnswers, assertGuideAnswer } from "./other-guide-answers.mjs";
import { isCanonicalProduction, isIndexable, isListedProduct, jsonLdScript, normalHost, pageMetadata, productJsonLd, robotsRules, sitemapPaths, articleJsonLd, journalArticleTitle, organizationJsonLd } from "../../lib/seo";
import { DEFAULT_SUPPORT_EMAIL } from "../../lib/orders/emails/format";
import { LEGACY_PRODUCT_REDIRECTS } from "../../lib/legacy-redirects";
import type { Product, StoreCatalog } from "../../lib/catalog";
import { journalArticles } from "../../lib/journal";

for (const answer of otherGuideAnswers) {
  test(`${answer.slug}: direct answer, placement and supporting source`, () => {
    const article = journalArticles.find(a => a.slug === answer.slug)!;
    const index = article.sections.findIndex(s => s.heading === answer.heading);
    assert.ok(index > 0, "new answer exists");
    assert.equal(article.sections[index - 1].heading, answer.after);
    const section = article.sections[index];
    assertGuideAnswer(answer, section.paragraphs);
    assert.equal(section.format, undefined);
    assert.equal(section.products, undefined);
    assert.ok(article.sources?.some(s => s.url === answer.source && s.label === answer.sourceLabel));
  });
}

test("complete existing journal articles remain identical outside the two answers and AAD citation", () => {
  // SHA256(JSON.stringify(article)) from main 20828e514df5db135173bff5f2129d572c2a3280.
  // Includes every original paragraph, metadata field, source and product/format association.
  const baseline = [
    "602d4a82cd4e5f2887a5e0673e29ea99141092a0284a9db708bf3c236a509f0d",
    "d1126b51f0802805bfc479f6c9f8df2dc7107330344ea11ef80d030121f0ed6f",
    "af41690108f5e7c5337d36387e90849f4207b36aa0669b267e04b04362fe7aa2",
  ];
  const preserved = journalArticles.map(article => {
    const copy = structuredClone(article);
    const answer = otherGuideAnswers.find(a => a.slug === copy.slug);
    if (answer) {
      assert.equal(copy.sections.filter(s => s.heading === answer.heading).length, 1);
      copy.sections = copy.sections.filter(s => s.heading !== answer.heading);
      if (copy.slug === "a-simple-skincare-routine") {
        assert.equal(copy.sources!.filter(s => s.url === answer.source).length, 1);
        copy.sources = copy.sources!.filter(s => s.url !== answer.source);
      }
    }
    return createHash("sha256").update(JSON.stringify(copy)).digest("hex");
  });
  assert.deepEqual(preserved, baseline);
});

const listed: Product = {id: "creatine-monohydrate", name: "Creatine", category: "supplements", type: "Powder", number: "01", price: 39, size: "", descriptor: "", description: "d",
  image: "https://cdn.shopify.com/a.jpg", campaign: "", tone: "", ritual: "", currency: "USD", available: true,
  variants: [{id: "v1", title: "Default Title", price: 39, currency: "USD", available: true}], images: [{src: "https://cdn.shopify.com/a.jpg", alt: "a"}]};
const placeholder: Product = {...listed, id: "keto-5", variants: []};
const live: StoreCatalog = {mode: "live", currency: "USD", products: [listed, placeholder]};
// A successful Shopify response with no products: the merged catalog holds only editorial placeholders.
const emptyLive: StoreCatalog = {mode: "live", currency: "USD", products: [placeholder]};
const prod = {vercelEnv: "production", host: "www.iqondaily.com", catalog: live};
const indexNowKey = "4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9";

test("IndexNow public verification file has exact key bytes and stays out of the sitemap", () => {
  const keyPath = `/${indexNowKey}.txt`;
  assert.match(indexNowKey, /^[a-f0-9]{64}$/);
  const bytes = readFileSync(new URL(`../../public${keyPath}`, import.meta.url));
  assert.deepEqual(bytes, Buffer.from(indexNowKey, "utf8"), "filename matches content, without BOM, whitespace or newline");
  for (const context of [prod, {...prod, catalog: emptyLive}, {...prod, catalog: {...live, mode: "unavailable" as const}}, {...prod, host: "iqondaily.com"}, {...prod, vercelEnv: "preview"}]) {
    assert.equal(sitemapPaths(context, journalArticles).includes(keyPath), false, "verification file is not a content URL");
  }
});

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

test("journal article titles name the journal, not \"Latest News\"", () => {
  assert.equal(journalArticleTitle({title: "Read the label with confidence."}), "Read the label with confidence | IQON Journal");
  for (const article of journalArticles) {
    const title = journalArticleTitle(article);
    assert.ok(title.startsWith(article.title.replace(/\.$/, "")) && title.endsWith(" | IQON Journal"), title);
    assert.doesNotMatch(title, /Latest News|\. \|/);
  }
});

test("Organization contact is the owner-approved support inbox only", () => {
  assert.equal(DEFAULT_SUPPORT_EMAIL, "info@iqonhealth.com");
  const [org] = organizationJsonLd();
  assert.deepEqual(org.contactPoint, {"@type": "ContactPoint", contactType: "customer support", email: "info@iqonhealth.com"});
  for (const invented of ["telephone", "address", "areaServed", "hoursAvailable"]) assert.equal(JSON.stringify(org).includes(invented), false, invented);
});

test("JSON-LD cannot break out of its script element", () => {
  assert.equal(jsonLdScript({name: "</script><script>x</script>"}).includes("<"), false);
});
