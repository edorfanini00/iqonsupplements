import type { Metadata } from "next";
import type { Category, Product, StoreCatalog } from "./catalog";
import { isRedirectedProductHandle } from "./legacy-redirects";
import type { JournalArticle } from "./journal";

// The one public origin. The same deployment also answers on legacy and Vercel
// hosts; those stay reachable (old order links) but are never indexable.
export const CANONICAL_HOST = "www.iqondaily.com";
export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
export const SITE_NAME = "IQON";
export const DEFAULT_SHARE_IMAGE = "/images/supplements/20_group_all_row.webp";

/** Crawl/index exclusions. Listed in robots.txt and sent as X-Robots-Tag. */
export const PRIVATE_PATHS = ["/account", "/affiliates", "/checkout", "/api/"];

export type IndexContext = {vercelEnv?: string; host?: string | null; catalog?: StoreCatalog};

export function normalHost(host?: string | null) {
  return (host || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/** Only the production deployment answering on the canonical host may be indexed. */
export function isCanonicalProduction({vercelEnv, host}: IndexContext) {
  return vercelEnv === "production" && normalHost(host) === CANONICAL_HOST;
}

/** A product page is genuine only when Shopify returned it (editorial-only entries have no variants)
 * and its URL is not a redirect source. */
export function isListedProduct(catalog: StoreCatalog | undefined, product: Product | undefined): product is Product {
  return catalog?.mode === "live" && !!product && (product.variants?.length ?? 0) > 0 && !isRedirectedProductHandle(product.id);
}

/** Shopify-returned products. A successful but empty Shopify response leaves only editorial placeholders: none listed. */
export function listedProducts(catalog: StoreCatalog | undefined, category?: Category) {
  return (catalog?.products ?? []).filter(p => isListedProduct(catalog, p) && (!category || p.category === category));
}

/** Pages that show catalog data (prices, availability, store copy) also need live Shopify products
 * (in their category, when given); preview, outage and empty catalogs fail closed. */
export function isIndexable(context: IndexContext, {requiresLiveCatalog = false, catalogCategory, eligible = true}: {requiresLiveCatalog?: boolean; catalogCategory?: Category; eligible?: boolean} = {}) {
  return eligible && isCanonicalProduction(context) && (!requiresLiveCatalog || listedProducts(context.catalog, catalogCategory).length > 0);
}

export function canonicalUrl(path: string) {
  return new URL(path, CANONICAL_ORIGIN).toString();
}

export function pageMetadata({path, title, description, image = DEFAULT_SHARE_IMAGE, imageAlt, type = "website", indexable}: {
  path: string; title: string; description?: string; image?: string; imageAlt?: string; type?: "website" | "article"; indexable: boolean;
}): Metadata {
  const images = [{url: canonicalUrl(image), ...(imageAlt ? {alt: imageAlt} : {})}];
  return {
    title, description,
    alternates: {canonical: canonicalUrl(path)},
    openGraph: {type, url: canonicalUrl(path), siteName: SITE_NAME, title, description, images},
    twitter: {card: "summary_large_image", title, description, images: images.map(i => i.url)},
    // Non-canonical copies keep link discovery but stay out of the index.
    robots: indexable ? {index: true, follow: true} : {index: false, follow: true},
  };
}

export function robotsRules(context: IndexContext) {
  if (context.vercelEnv !== "production") return {rules: [{userAgent: "*", disallow: "/"}]};
  // Legacy hosts stay crawlable so crawlers can read their noindex and canonical.
  const rules = [{userAgent: "*", allow: "/", disallow: PRIVATE_PATHS}];
  return isCanonicalProduction(context) ? {rules, sitemap: canonicalUrl("/sitemap.xml")} : {rules};
}

/** Pages that render without the catalog. */
export const STATIC_PUBLIC_PATHS = ["/approach", "/journal"];
/** Pages whose content depends on live Shopify products (in a category, when given).
 * /reviews is excluded: it has no published reviews. Must match each page's publicPageMetadata() options. */
export const CATALOG_PUBLIC_PAGES: {path: string; category?: Category}[] = [
  {path: "/"}, {path: "/help"}, {path: "/skincare", category: "skincare"},
  {path: "/collections/all"}, {path: "/collections/supplements", category: "supplements"}, {path: "/collections/skincare", category: "skincare"},
];
export const collectionCategory = (category: string): Category | undefined => category === "supplements" || category === "skincare" ? category : undefined;

/** Only canonical, 200, indexable URLs. No lastmod: no trustworthy modification date exists for these pages. */
export function sitemapPaths(context: IndexContext, articles: Pick<JournalArticle, "slug">[]) {
  if (!isCanonicalProduction(context)) return [];
  const catalogPages = CATALOG_PUBLIC_PAGES.filter(page => isIndexable(context, {requiresLiveCatalog: true, catalogCategory: page.category})).map(page => page.path);
  const products = listedProducts(context.catalog).map(p => `/products/${encodeURIComponent(p.id)}`);
  return [...new Set([...catalogPages, ...STATIC_PUBLIC_PATHS, ...articles.map(a => `/journal/${a.slug}`), ...products])];
}

type JsonLd = Record<string, unknown>;
export function jsonLdScript(data: JsonLd | JsonLd[]) {
  // Escape "<" so catalog text cannot close the script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(): JsonLd[] {
  return [
    {"@context": "https://schema.org", "@type": "Organization", "@id": `${CANONICAL_ORIGIN}/#organization`, name: SITE_NAME, url: canonicalUrl("/"), logo: canonicalUrl("/favicon.svg")},
    {"@context": "https://schema.org", "@type": "WebSite", "@id": `${CANONICAL_ORIGIN}/#website`, name: SITE_NAME, url: canonicalUrl("/"), publisher: {"@id": `${CANONICAL_ORIGIN}/#organization`}},
  ];
}

export function breadcrumbJsonLd(items: {name: string; path: string}[]): JsonLd {
  return {"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({
    "@type": "ListItem", position: i + 1, name: item.name, item: canonicalUrl(item.path),
  }))};
}

/** Mirrors the visible product facts. The offer is the "One time purchase" price shown for the default
 * variant (the page's first available variant). Coming-soon, unpriced and subscription-only products have no
 * verifiable one-time offer, so no Product node is emitted for them (an offer-less Product is an invalid rich
 * result). No ratings, GTINs or policies. */
export function productJsonLd(product: Product, comingSoon: boolean): JsonLd | null {
  const variant = product.variants?.find(v => v.available) || product.variants?.[0];
  if (comingSoon || product.pricePending || product.requiresSellingPlan || !variant || !Number.isFinite(variant.price)) return null;
  const offer = {
    "@type": "Offer", url: canonicalUrl(`/products/${product.id}`), price: variant.price.toFixed(2), priceCurrency: variant.currency,
    availability: product.available !== false && variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
  return {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    image: (product.images?.length ? product.images.map(i => i.src) : [product.image]).map(src => canonicalUrl(src)),
    brand: {"@type": "Brand", name: SITE_NAME}, url: canonicalUrl(`/products/${product.id}`), offers: offer,
  };
}

export function articleJsonLd(article: JournalArticle): JsonLd {
  return {
    "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.dek,
    image: [canonicalUrl(article.image)], mainEntityOfPage: canonicalUrl(`/journal/${article.slug}`),
    author: {"@type": "Organization", name: "IQON Editorial", url: canonicalUrl("/")},
    publisher: {"@type": "Organization", name: SITE_NAME, url: canonicalUrl("/"), logo: canonicalUrl("/favicon.svg")},
    ...(article.sources?.length ? {citation: article.sources.map(s => s.url)} : {}),
  };
}
