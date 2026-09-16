/**
 * Products not yet published in Shopify but available in the accounting
 * purchase picker. Reserved high IDs (900xxx) avoid collisions with real Shopify
 * product ids. Once a product goes live in Shopify, drop it from this list — the
 * picker will surface the real catalog entry instead.
 */

export interface AccountingPickerProduct {
  id: number;
  name: string;
  price: string;
  pending?: boolean;
}

export const PENDING_ACCOUNTING_PRODUCTS: { id: number; name: string }[] = [
  { id: 900_001, name: "KPV 10mg" },
  { id: 900_002, name: "Tirzepatide 20mg" },
  { id: 900_003, name: "Epithalon 10mg" },
  { id: 900_004, name: "Tesamorelin 10mg" },
  { id: 900_005, name: "MOTS-c 10mg" },
];

/**
 * Ids at or above this are synthetic placeholders, never real Shopify products.
 * Hardcoded entries use 900_00x; admin-created ones (pending_products table)
 * start at 910_000.
 */
export const SYNTHETIC_ID_FLOOR = 900_000;
export const CUSTOM_SYNTHETIC_ID_START = 910_000;

/** True when a Shopify catalog product already covers this pending name. */
export function shopifyCoversPending(shopifyName: string, pendingName: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const w = norm(shopifyName);
  const p = norm(pendingName);
  return w === p || w.includes(p) || p.includes(w);
}

export function mergePendingProducts(
  shopifyProducts: AccountingPickerProduct[],
  customPending: { id: number; name: string }[] = []
): AccountingPickerProduct[] {
  const usedIds = new Set(shopifyProducts.map((p) => p.id));
  const pending: AccountingPickerProduct[] = [
    ...PENDING_ACCOUNTING_PRODUCTS,
    ...customPending,
  ]
    .filter(
      (p) =>
        !usedIds.has(p.id) &&
        !shopifyProducts.some((w) => shopifyCoversPending(w.name, p.name))
    )
    .map((p) => ({ id: p.id, name: p.name, price: "", pending: true }));

  return [...shopifyProducts, ...pending];
}
