import type { MetadataRoute } from "next";
import { journalArticles } from "@/lib/journal";
import { canonicalUrl, sitemapPaths } from "@/lib/seo";
import { indexContext } from "@/lib/seo.server";
import { getStoreCatalog } from "@/lib/shopify.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = sitemapPaths(await indexContext(), await getStoreCatalog(), journalArticles);
  return paths.map(path => ({url: canonicalUrl(path)}));
}
