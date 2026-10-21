import type { MetadataRoute } from "next";
import { journalArticles } from "@/lib/journal";
import { canonicalUrl, sitemapPaths } from "@/lib/seo";
import { indexContext } from "@/lib/seo.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = sitemapPaths(await indexContext(), journalArticles);
  return paths.map(path => ({url: canonicalUrl(path)}));
}
