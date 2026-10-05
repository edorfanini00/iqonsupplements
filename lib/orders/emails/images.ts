/**
 * Product images for order emails.
 *
 * Shopify order and fulfilment webhooks carry product/variant ids but no image
 * URLs, so we look them up through the Storefront API (variant image, then the
 * product's featured image, requested as JPG for Outlook). When Shopify is
 * unreachable or has no image we fall back to the email sized JPGs shipped in
 * public/images/email/products (keyed by catalog handle, matched by handle or
 * product title), then to a neutral IQON placeholder. All URLs are absolute
 * https so they render in every client.
 */
import { products } from "../../catalog";
import { shopifyConfig, shopifyRequest } from "../../shopify";
import { safeHttpsUrl } from "./format";
import { lineItemPlaceholder } from "./layout";
import type { EmailBrandConfig, EmailLineItem } from "./types";

const EMAIL_IMAGE_HANDLES = new Set(products.map((p) => p.id));

export function catalogImageForHandle(handle: string | null | undefined, brand: EmailBrandConfig): string | null {
  if (!handle || !EMAIL_IMAGE_HANDLES.has(handle)) return null;
  return `${brand.assetOrigin}/images/email/products/${handle}.jpg`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function catalogHandleForTitle(title: string): string | null {
  const wanted = normalize(title);
  return products.find((p) => normalize(p.name) === wanted || normalize(p.id) === wanted)?.id ?? null;
}

export interface StorefrontImage {
  handle: string | null;
  imageUrl: string | null;
}

/** variant id (numeric string) -> Shopify image + product handle. */
export type StorefrontImageLookup = (variantIds: string[], productIds: string[]) => Promise<Map<string, StorefrontImage>>;

const IMAGE_FIELDS = `url(transform:{maxWidth:240,maxHeight:300,crop:CENTER,preferredContentType:JPG})`;
export const STOREFRONT_IMAGES_QUERY = `query EmailLineItemImages($ids:[ID!]!){nodes(ids:$ids){
  ... on ProductVariant{id image{${IMAGE_FIELDS}} product{id handle featuredImage{${IMAGE_FIELDS}}}}
  ... on Product{id handle featuredImage{${IMAGE_FIELDS}}}
}}`;

type Node = { id?: string; handle?: string; image?: { url?: string } | null; featuredImage?: { url?: string } | null; product?: { id?: string; handle?: string; featuredImage?: { url?: string } | null } | null } | null;

export function storefrontImageLookup(env: Record<string, unknown> = process.env, timeoutMs = 1500, fetcher: typeof fetch = fetch): StorefrontImageLookup {
  return async (variantIds, productIds) => {
    const result = new Map<string, StorefrontImage>();
    const config = shopifyConfig(env);
    if (!config) return result;
    const ids = [
      ...variantIds.map((v) => `gid://shopify/ProductVariant/${v}`),
      ...productIds.map((p) => `gid://shopify/Product/${p}`),
    ].slice(0, 250);
    if (!ids.length) return result;
    const timed: typeof fetch = (url, init) =>
      fetcher(url, { ...init, signal: AbortSignal.any([init?.signal, AbortSignal.timeout(timeoutMs)].filter(Boolean) as AbortSignal[]) });
    const data = await shopifyRequest<{ nodes: Node[] }>(config, STOREFRONT_IMAGES_QUERY, { ids }, undefined, timed);
    for (const node of data.nodes ?? []) {
      const nodeId = node?.id?.split("/").pop();
      if (!node || !nodeId) continue;
      if (node.id!.includes("/ProductVariant/")) {
        result.set(`variant:${nodeId}`, {
          handle: node.product?.handle ?? null,
          imageUrl: safeHttpsUrl(node.image?.url) ?? safeHttpsUrl(node.product?.featuredImage?.url),
        });
      } else {
        result.set(`product:${nodeId}`, { handle: node.handle ?? null, imageUrl: safeHttpsUrl(node.featuredImage?.url) });
      }
    }
    return result;
  };
}

/**
 * Fill imageUrl on every line. Never throws: a failed Storefront call only
 * downgrades to catalog or placeholder images.
 */
export async function resolveLineItemImages(
  items: EmailLineItem[],
  brand: EmailBrandConfig,
  lookup: StorefrontImageLookup | null,
  log: (event: Record<string, unknown>) => void = () => {},
): Promise<EmailLineItem[]> {
  let found = new Map<string, StorefrontImage>();
  const needs = items.filter((i) => !safeHttpsUrl(i.imageUrl));
  if (lookup && needs.length) {
    try {
      found = await lookup(
        [...new Set(needs.map((i) => i.variantId).filter((v): v is string => !!v))],
        [...new Set(needs.map((i) => i.productId).filter((p): p is string => !!p))],
      );
    } catch (error) {
      log({ event: "storefront_image_lookup_failed", error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return items.map((item) => {
    const existing = safeHttpsUrl(item.imageUrl);
    if (existing) return { ...item, imageUrl: existing };
    const shopify = (item.variantId && found.get(`variant:${item.variantId}`)) || (item.productId && found.get(`product:${item.productId}`)) || null;
    const imageUrl =
      shopify?.imageUrl ??
      catalogImageForHandle(shopify?.handle, brand) ??
      catalogImageForHandle(catalogHandleForTitle(item.title), brand) ??
      lineItemPlaceholder(brand);
    return { ...item, imageUrl };
  });
}
