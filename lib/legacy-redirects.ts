/** Retired product handles. Shared by next.config redirects and the sitemap so a redirect source is never listed. */
export const LEGACY_PRODUCT_REDIRECTS = [
  {handle: "gentle-cleanser", destination: "/products/anti-aging-cleanser-with-peptides"},
  {handle: "peptide-serum", destination: "/collections/skincare"},
  {handle: "barrier-cream", destination: "/collections/skincare"},
] as const;
export const isRedirectedProductHandle = (handle: string) => LEGACY_PRODUCT_REDIRECTS.some(r => r.handle === handle);
