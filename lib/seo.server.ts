import type { Metadata } from "next";
import { headers } from "next/headers";
import { getStoreCatalog } from "./shopify.server";
import type { Category } from "./catalog";
import { isIndexable, pageMetadata, type IndexContext } from "./seo";

export async function indexContext(): Promise<IndexContext> {
  const requestHeaders = await headers();
  return {vercelEnv: process.env.VERCEL_ENV, host: requestHeaders.get("host"), catalog: await getStoreCatalog()};
}

/** Every public page opts in here; anything else inherits the root layout's noindex. */
export async function publicPageMetadata(page: Omit<Parameters<typeof pageMetadata>[0], "indexable"> & {requiresLiveCatalog?: boolean; catalogCategory?: Category; eligible?: boolean}): Promise<Metadata> {
  const {requiresLiveCatalog, catalogCategory, eligible, ...rest} = page;
  return pageMetadata({...rest, indexable: isIndexable(await indexContext(), {requiresLiveCatalog, catalogCategory, eligible})});
}
