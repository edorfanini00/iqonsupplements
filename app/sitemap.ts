import type { MetadataRoute } from "next";
import { journalArticles } from "@/lib/journal";
import { canonicalUrl, isCanonicalProduction, sitemapPaths } from "@/lib/seo";
import { newSkincareProducts } from "@/lib/new-skincare";
import { indexContext } from "@/lib/seo.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await indexContext();
  const paths = sitemapPaths(context, journalArticles);
  // These three complete, approved informational pages do not require a Shopify offer.
  if (isCanonicalProduction(context)) paths.push(...newSkincareProducts.map(p => `/products/${p.id}`));
  return [...new Set(paths)].map(path => ({url: canonicalUrl(path)}));
}
