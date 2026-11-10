import type { Product, StoreCatalog } from './catalog';
import range from './new-skincare-range.json';

/** Local, non-orderable candidates only. Do not merge into the shared catalog:
 * doing so would change the existing seven PDP switchers/related grids/navigation.
 * The numeric zero is an internal sentinel; pricePending always suppresses prices.
 * There is no approved retail price, stock count, variant or selling plan. */
export const newSkincareProducts: Product[] = range.map(p => ({
  ...p, category: 'skincare', available: false, price: 0, pricePending: true,
  currency: 'USD', tone: 'silver', campaign: p.image,
  variants: [], requiresSellingPlan: false,
  images: [{src:p.image, alt:`IQON ${p.name}, ${p.size} — CGI packaging visualization based on approved artwork; local preview only`}],
}));
export const newSkincareIds = new Set(range.map(p => p.id));
export const newSkincareFor = (id:string) => range.find(p => p.id === id);
export const localNewSkincareDepartment = (pathname:string, mode:StoreCatalog['mode']) =>
  mode === 'preview' && range.some(p=>pathname===`/products/${p.id}`) ? 'skincare' as const : undefined;
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
  // Editorial art remains unapproved; never substitute the rejected supporting renders.
  return `/images/skincare/new-products-only/${id}/editorial.svg`;
};

/** Deliberately fail closed outside the unconfigured local preview catalog. */
export function localNewSkincareProduct(catalog: Pick<StoreCatalog,'mode'|'products'>, id:string) {
  return catalog.mode === 'preview' ? newSkincareProducts.find(p => p.id === id) : undefined;
}
export function withLocalNewSkincareCards(products:Product[], mode:StoreCatalog['mode']) {
  return mode === 'preview' ? [...products,...newSkincareProducts.filter(p=>!products.some(existing=>existing.id===p.id))] : products;
}
