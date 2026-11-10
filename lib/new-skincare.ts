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
  images: [{src:p.image, alt:`${p.name} — image pending approval; local preview only`}],
}));
export const newSkincareIds = new Set(range.map(p => p.id));
export const newSkincareFor = (id:string) => range.find(p => p.id === id);
export const localNewSkincareDepartment = (pathname:string, mode:StoreCatalog['mode']) =>
  mode === 'preview' && range.some(p=>pathname===`/products/${p.id}`) ? 'skincare' as const : undefined;
export const newSkincareImage = (id:string, role:'packshot'|'editorial'|'texture') =>
  newSkincareIds.has(id) ? `/images/skincare/new-products-only/${id}/${role}.svg` : undefined;

/** Deliberately fail closed outside the unconfigured local preview catalog. */
export function localNewSkincareProduct(catalog: Pick<StoreCatalog,'mode'|'products'>, id:string) {
  return catalog.mode === 'preview' ? newSkincareProducts.find(p => p.id === id) : undefined;
}
export function withLocalNewSkincareCards(products:Product[], mode:StoreCatalog['mode']) {
  return mode === 'preview' ? [...products,...newSkincareProducts.filter(p=>!products.some(existing=>existing.id===p.id))] : products;
}
