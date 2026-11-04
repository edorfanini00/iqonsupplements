/** Retired product handles. Shared by next.config redirects and the sitemap so a redirect source is never listed. */
export const LEGACY_PRODUCT_REDIRECTS = [
  {handle: "gentle-cleanser", destination: "/products/anti-aging-cleanser-with-peptides"},
  {handle: "peptide-serum", destination: "/collections/skincare"},
  {handle: "barrier-cream", destination: "/collections/skincare"},
  // Retired 3 Nov 2026 and replaced by Gut Health; the Shopify product may stay published.
  {handle: "colon-gentle-cleanse", destination: "/products/gut-health"},
] as const;
/** Supplements still published in Shopify that the storefront never lists, links, recommends, bundles or adds to a bag. */
export const RETIRED_PRODUCT_HANDLES: readonly string[] = ["colon-gentle-cleanse"];
export const isRetiredProductHandle = (handle: string) => RETIRED_PRODUCT_HANDLES.includes(handle);
export const isRedirectedProductHandle = (handle: string) => LEGACY_PRODUCT_REDIRECTS.some(r => r.handle === handle);
