/** Active invoice S8939 identities. Artwork is not batch/inventory confirmation.
 * Historical formulas retain direct noindex pages, never an equivalence redirect. */
export const activeSkincareIds = [
  'enzyme-gel-cleanser', 'exfoliating-pads', 'hyaluronic-serum', 'retinol-rx',
  'hydra-c-ferulic-serum', 'peptide-anti-wrinkle-day-cream',
  'copper-peptide-restore-cream', 'firming-peptide-eye-gel',
] as const;
export const legacySkincareIds = ['anti-aging-cleanser-with-peptides', 'hydrating-tonic'] as const;
export const isActiveSkincareHandle = (id:unknown) => typeof id==='string' && (activeSkincareIds as readonly string[]).includes(id);
export const isLegacySkincareHandle = (id:unknown) => typeof id==='string' && (legacySkincareIds as readonly string[]).includes(id);
/** Exact-handle holds survive missing/mixed/renamed Shopify tags. */
export const isHeldSkincareHandle = (id:unknown) => isActiveSkincareHandle(id) || isLegacySkincareHandle(id);
