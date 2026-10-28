// Bundle tiers for IQON supplements. Shopify applies the savings through two automatic
// product discounts ("Bundle: Buy 2, save 10%" and "Bundle: Buy 3, save 25%") that count
// any mix of the eligible products below. This module only presents the offer: the bag
// always shows Shopify's own discount allocations and cart cost, never a client total.
//
// Eligible products are the ones approved in the 28 Oct 2026 internal margin review; Colon
// Gentle Cleanse is not part of the offer. Keep this list identical to the products selected
// on both Shopify discounts.
export const BUNDLE_ELIGIBLE_HANDLES: readonly string[] = [
  "creatine-monohydrate", "hydrolyzed-collagen-peptides", "collagen-peptides-chocolate", "colostrum-powder",
  "nmn", "glp-1-support", "hair-skin-nails-gummies", "resveratrol", "liver-support", "keto-5",
];

export const BUNDLE_EXCLUDED_NOTE = "Colon Gentle Cleanse is not part of the bundle offer.";

export type BundleTier = {minQuantity: number; percent: number; title: string};
export const BUNDLE_TIERS: readonly BundleTier[] = [
  {minQuantity: 2, percent: 10, title: "Bundle: Buy 2, save 10%"},
  {minQuantity: 3, percent: 25, title: "Bundle: Buy 3, save 25%"},
];

export const isBundleEligible = (handle: string) => BUNDLE_ELIGIBLE_HANDLES.includes(handle);

/** The best tier reached by this many eligible units, if any. */
export function bundleTier(units: number): BundleTier | undefined {
  return [...BUNDLE_TIERS].reverse().find(tier => units >= tier.minQuantity);
}

const cents = (amount: number) => Math.round(amount * 100);

/** Per unit price at a tier, rounded to the cent. */
export function tierUnitPrice(price: number, percent: number) {
  return Math.round(cents(price) * (100 - percent) / 100) / 100;
}

/**
 * Estimated total for `quantity` units of one product added on their own: the line amount
 * less its tier percentage, rounded to the cent. Units already in the bag can only raise the
 * tier, so this never promises more than the bag will show.
 */
export function bundleEstimate(price: number, quantity: number) {
  const gross = cents(price) * quantity;
  const percent = bundleTier(quantity)?.percent ?? 0;
  const saved = Math.round(gross * percent / 100);
  return {gross: gross / 100, saved: saved / 100, total: (gross - saved) / 100, percent};
}

/** Next tier message for a bag holding this many eligible units. */
export function bundleNudge(eligibleUnits: number): string | null {
  const next = BUNDLE_TIERS.find(tier => eligibleUnits < tier.minQuantity);
  if (!next || eligibleUnits < 1) return null;
  const needed = next.minQuantity - eligibleUnits;
  return `Add ${needed} more eligible supplement${needed === 1 ? "" : "s"} to save ${next.percent}%.`;
}

export type DiscountLine = {title: string; amount: number};

/**
 * Shopify's figures for the bag summary. The breakdown is shown only when Shopify's own
 * numbers reconcile to the cent: merchandise less product discounts equals its subtotal,
 * and the subtotal less order discounts equals its total.
 */
export function bagSummary(input: {merchandise: number; lineDiscounts: DiscountLine[]; subtotal: number; orderDiscounts: DiscountLine[]; total: number}) {
  const sum = (lines: DiscountLine[]) => lines.reduce((n, line) => n + cents(line.amount), 0);
  const lineReconciles = cents(input.merchandise) - sum(input.lineDiscounts) === cents(input.subtotal);
  const orderReconciles = cents(input.subtotal) - sum(input.orderDiscounts) === cents(input.total);
  return {
    showLineDiscounts: input.lineDiscounts.length > 0 && lineReconciles,
    showOrderDiscounts: input.orderDiscounts.length > 0 && orderReconciles,
  };
}
