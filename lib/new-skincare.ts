import type { Product, StoreCatalog } from './catalog';
import range from './new-skincare-range.json';

/** Owner-approved informational pages only. Do not merge into the shared catalog:
 * doing so would change the existing seven PDP switchers/related grids/navigation.
 * The numeric zero is an internal sentinel; pricePending always suppresses prices.
 * There is no approved retail price, stock count, variant or selling plan. */
export const newSkincareProducts: Product[] = range.map(p => ({
  ...p, category: 'skincare', available: false, price: 0, pricePending: true,
  currency: 'USD', tone: 'silver', campaign: p.image,
  variants: [], requiresSellingPlan: false,
  images: [{src:p.image, alt:`IQON ${p.name}, ${p.size} — CGI packaging visualization based on approved artwork`}],
}));
export const newSkincareIds = new Set(range.map(p => p.id));
export const newSkincareFor = (id:string) => range.find(p => p.id === id);
export const comingSoonSkincareDepartment = (pathname:string) =>
  range.some(p=>pathname===`/products/${p.id}`) ? 'skincare' as const : undefined;
// Existing own-brand abstract studies, referenced in place without altering the source.
// These do not represent the color or viscosity of any new finished formula.
const textureReferences: Record<string,string> = {
  'enzyme-gel-cleanser':'/images/product-details/anti-aging-cleanser-with-peptides.webp',
  'hyaluronic-serum':'/images/pdp-materials-v6/hydra-c-ferulic-serum.webp',
  'peptide-anti-wrinkle-day-cream':'/images/pdp-materials-v6/copper-peptide-restore-cream.webp',
};
export const newSkincareImage = (id:string, role:'packshot'|'editorial'|'texture') => {
  if (!newSkincareIds.has(id)) return undefined;
  if (role === 'packshot') return newSkincareFor(id)!.image;
  if (role === 'texture') return textureReferences[id];
  // Owner-approved editorial render; no commerce activation is implied.
  return `/images/skincare/new-products-only/${id}/editorial.webp`;
};

/** Explicit allowlist independent of Shopify availability; always non-orderable. */
export function comingSoonSkincareProduct(_catalog: Pick<StoreCatalog,'mode'|'products'>, id:string) {
  return newSkincareProducts.find(p => p.id === id);
}
export function withComingSoonSkincareCards(products:Product[]) {
  // Preserve every unrelated record and hold these three even on an external collision.
  return [...products.map(p=>newSkincareProducts.find(held=>held.id===p.id)||p),...newSkincareProducts.filter(p=>!products.some(existing=>existing.id===p.id))];
}
