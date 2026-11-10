import type { Product, StoreCatalog } from './catalog';
import range from './new-skincare-range.json';
import historicalRange from './skincare-range.json';
import { productContent } from './product-content';
import { activeSkincareIds, isActiveSkincareHandle, isHeldSkincareHandle, isLegacySkincareHandle } from './skincare-identity';
import type { QualifiedSkincare } from './skincare-launch';

/** Owner-approved informational pages. The active range is the invoice eight.
 * The numeric zero is an internal sentinel; pricePending always suppresses prices.
 * There is no approved retail price, stock count, variant or selling plan. */
export const newSkincareProducts: Product[] = range.map(p => ({
  ...p, category: 'skincare', available: false, price: 0, pricePending: true,
  currency: 'USD', tone: 'silver', campaign: p.image,
  variants: [], requiresSellingPlan: false,
  images: [{src:p.image, alt:`IQON ${p.name}, ${p.size} — AI-generated packaging visualization based on approved artwork`}],
}));
export const newSkincareIds = new Set(range.map(p => p.id));
export const newSkincareFor = (id:string) => range.find(p => p.id === id);
// Shared by the gallery, zoom and routine; props are styling, not formula evidence.
const editorialPackaging: Record<string,string> = {
  'enzyme-gel-cleanser':'white bottle on a grey counter with a folded white towel and cropped metal tray',
  'hyaluronic-serum':'silver bottle on a reflective metal pedestal beside an empty shallow glass dish',
  'peptide-anti-wrinkle-day-cream':'silver bottle on a grey counter with folded white towels and a cropped metal tray',
};
export const newSkincareEditorialAlt = (id:string, name:string) => editorialPackaging[id]
  ? `IQON ${name} ${editorialPackaging[id]} — AI-generated packaging visualization` : undefined;
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
const isLaunched = (p:Product) => p.category === 'skincare' && p.launchQualified === true && isActiveSkincareHandle(p.id);
/** Informational page unless the live catalog holds a qualified purchasable product for this exact handle. */
export function comingSoonSkincareProduct(catalog: Pick<StoreCatalog,'mode'|'products'>, id:string) {
  if (catalog.mode === 'live' && catalog.products.some(p => p.id === id && isLaunched(p))) return undefined;
  return activeSkincareProducts.find(p => p.id === id);
}
/** The approved page record with ONLY commerce facts taken from the fresh qualification:
 * approved name, size, copy, INCI, directions and imagery are kept unchanged. */
export function launchedSkincareProduct(q: QualifiedSkincare): Product | undefined {
  const approved = activeSkincareProducts.find(p => p.id === q.handle);
  if (!approved) return undefined;
  return {...approved, available: true, pricePending: false, price: q.price, currency: q.currency, launchQualified: true, stockLimit: q.quantityAvailable,
    variants: [{id: q.variantId, title: q.title && q.title !== 'Default Title' ? q.title : approved.size, price: q.price, currency: q.currency, available: true}],
    requiresSellingPlan: false};
}
export function withComingSoonSkincareCards(products:Product[]) {
  // Preserve ordinary supplements. Neither legacy identities nor unapproved skincare can leak in;
  // a server-qualified launched record replaces its informational card in place (same order).
  const launched = products.filter(isLaunched);
  return [...products.filter(p=>p.category!=='skincare'&&!isHeldSkincareHandle(p.id)),...activeSkincareProducts.map(p => launched.find(l => l.id === p.id) ?? p)];
}
