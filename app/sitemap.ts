import type { MetadataRoute } from "next";
import { journalArticles } from "@/lib/journal";
import { canonicalUrl, isCanonicalProduction, sitemapPaths } from "@/lib/seo";
import { activeSkincareProducts } from "@/lib/new-skincare";
import { indexContext } from "@/lib/seo.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await indexContext();
  const paths = sitemapPaths(context, journalArticles);
  // These eight complete, approved informational pages do not require a Shopify offer.
  if (isCanonicalProduction(context)) paths.push("/skincare", "/collections/skincare", ...activeSkincareProducts.map(p => `/products/${p.id}`));
  return [...new Set(paths)].map(path => ({url: canonicalUrl(path)}));
}
