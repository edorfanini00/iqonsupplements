import type { Product } from './catalog';

/** Editorial browsing groups, not eligibility or medical outcome claims.
 * Explicit membership uses existing product facts; unmatched products stay in All.
 * No keyword matching, availability filtering or skincare categorization. */
export const supplementFocuses = [
  {id:'training', label:'Training', description:'Creatine for repeated, high-intensity efforts.', products:['creatine-monohydrate']},
  {id:'everyday-nutrition', label:'Everyday nutrition', description:'Collagen protein powders and a vitamin and mineral gummy formula.', products:['hydrolyzed-collagen-peptides','collagen-peptides-chocolate','hair-skin-nails-gummies']},
  {id:'digestive-support', label:'Digestive support', description:'Gut Health combines prebiotic fiber, a probiotic and digestive enzymes.', products:['gut-health']},
] as const;
export type SupplementFocus = 'all' | typeof supplementFocuses[number]['id'];
export function collectionFocus(value: string): SupplementFocus {
  return supplementFocuses.find(f=>f.id===value)?.id || 'all';
}
export function matchesCollectionFocus(product: Product, focus: SupplementFocus) {
  return focus==='all' || (product.category==='supplements' && supplementFocuses.find(f=>f.id===focus)?.products.some(id=>id===product.id)===true);
}
