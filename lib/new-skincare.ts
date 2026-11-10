import type { Product, StoreCatalog } from './catalog';
import range from './new-skincare-range.json';
import historicalRange from './skincare-range.json';
import { productContent } from './product-content';
import { activeSkincareIds, isHeldSkincareHandle, isLegacySkincareHandle } from './skincare-identity';

/** Owner-approved informational pages. The active range is the invoice eight.
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
  pathname.startsWith('/products/') && isHeldSkincareHandle(pathname.slice('/products/'.length)) ? 'skincare' as const : undefined;
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
const historicalProducts: Product[] = historicalRange.map(p=>({
  ...p, category:'skincare', available:false, price:0, pricePending:true, currency:'USD',
  tone:'silver', campaign:p.image, variants:[], requiresSellingPlan:false,
  descriptor:productContent[p.id]?.descriptor||p.descriptor,
  description:productContent[p.id]?.description||p.description,
  images:[{src:p.image,alt:`IQON ${p.name}, ${p.size} — illustrative product image; not batch verification`}],
}));
export const activeSkincareProducts: Product[] = activeSkincareIds.map(id=>
  [...newSkincareProducts,...historicalProducts].find(p=>p.id===id)!
);
export const legacySkincareProduct = (id:string) => isLegacySkincareHandle(id) ? historicalProducts.find(p=>p.id===id) : undefined;
export function comingSoonSkincareProduct(_catalog: Pick<StoreCatalog,'mode'|'products'>, id:string) {
  return activeSkincareProducts.find(p => p.id === id);
}
export function withComingSoonSkincareCards(products:Product[]) {
  // Preserve ordinary supplements. Neither legacy identities nor unapproved skincare can leak in.
  return [...products.filter(p=>p.category!=='skincare'&&!isHeldSkincareHandle(p.id)),...activeSkincareProducts];
}
