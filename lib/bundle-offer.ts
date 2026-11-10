// Bundle tiers for IQON. Two independent families, each applied by its own pair of Shopify
// automatic product discounts that count any mix of that family's eligible products:
//  - supplements: "Bundle: Buy 2, save 10%" and "Bundle: Buy 3, save 25%";
//  - skincare: "Skincare bundle: Buy 2, save 10%" and "Skincare bundle: Buy 3, save 15%".
// Units never cross families: skincare counts only toward skincare, supplements only toward
// supplements. This module only presents the offer: the bag always shows Shopify's own discount
// allocations and cart cost, never a client total.
//
// The current supplement catalog is approved for both tiers. Gut Health replaces the retired
// Colon Gentle Cleanse in the approved set (owner decision 3 Nov 2026). Keep this list identical
// to the products selected on both Shopify discounts; activate backend eligibility before releasing UI.
export const BUNDLE_ELIGIBLE_HANDLES: readonly string[] = [
  "creatine-monohydrate", "hydrolyzed-collagen-peptides", "collagen-peptides-chocolate", "colostrum-powder",
  "gut-health", "nmn", "glp-1-support", "hair-skin-nails-gummies", "resveratrol", "liver-support", "keto-5",
];

// Exactly the eight active skincare handles (owner decision 10 Nov 2026). Keep identical to the
// products selected on both skincare Shopify discounts. A skincare product still shows the offer
// only once the server has qualified it as purchasable (see lib/skincare-launch.ts).
export const SKINCARE_BUNDLE_ELIGIBLE_HANDLES: readonly string[] = [
  "enzyme-gel-cleanser", "exfoliating-pads", "hyaluronic-serum", "retinol-rx",
  "hydra-c-ferulic-serum", "peptide-anti-wrinkle-day-cream", "copper-peptide-restore-cream", "firming-peptide-eye-gel",
];

export type BundleFamily = "supplements" | "skincare";
export type BundleTier = {minQuantity: number; percent: number; title: string};
export const BUNDLE_TIERS: readonly BundleTier[] = [
  {minQuantity: 2, percent: 10, title: "Bundle: Buy 2, save 10%"},
  {minQuantity: 3, percent: 25, title: "Bundle: Buy 3, save 25%"},
];
export const SKINCARE_BUNDLE_TIERS: readonly BundleTier[] = [
  {minQuantity: 2, percent: 10, title: "Skincare bundle: Buy 2, save 10%"},
  {minQuantity: 3, percent: 15, title: "Skincare bundle: Buy 3, save 15%"},
];

type BundleOffer = {handles: readonly string[]; tiers: readonly BundleTier[]; unit: [singular: string, plural: string]; terms: string};
export const BUNDLE_OFFERS: Readonly<Record<BundleFamily, BundleOffer>> = {
  supplements: {handles: BUNDLE_ELIGIBLE_HANDLES, tiers: BUNDLE_TIERS, unit: ["eligible supplement", "eligible supplements"],
    terms: "Mix and match any eligible IQON supplements: every eligible item in your bag counts toward the bundle. Savings apply automatically in your bag and at checkout, and can’t be combined with discount codes."},
  skincare: {handles: SKINCARE_BUNDLE_ELIGIBLE_HANDLES, tiers: SKINCARE_BUNDLE_TIERS, unit: ["skincare product", "skincare products"],
    terms: "Mix and match any IQON skincare: every skincare item in your bag counts toward the bundle. Supplements don’t count toward the skincare bundle. Savings apply automatically in your bag and at checkout."},
};
export const BUNDLE_FAMILIES: readonly BundleFamily[] = ["supplements", "skincare"];

/** Eligibility within one family. Without a family this is the original supplement check. */
export const isBundleEligible = (handle: string, family: BundleFamily = "supplements") => BUNDLE_OFFERS[family].handles.includes(handle);

/** The single bundle family an exact handle belongs to, if any. */
export const bundleFamily = (handle: string): BundleFamily | undefined => BUNDLE_FAMILIES.find(family => isBundleEligible(handle, family));

/** The best tier of this family reached by this many of its eligible units, if any. */
export function bundleTier(units: number, family: BundleFamily = "supplements"): BundleTier | undefined {
  return [...BUNDLE_OFFERS[family].tiers].reverse().find(tier => units >= tier.minQuantity);
}

const cents = (amount: number) => Math.round(amount * 100);
const unitDiscountCents = (price: number, percent: number) => Math.floor(cents(price) * percent / 100);

/** Shopify truncates the percentage discount to whole cents per unit. */
export function tierUnitPrice(price: number, percent: number) {
  return (cents(price) - unitDiscountCents(price, percent)) / 100;
}

/**
 * Estimated total for `quantity` units of one product added on their own: Shopify's
 * whole-cent unit discount multiplied by quantity. The actual bag remains authoritative.
 */
export function bundleEstimate(price: number, quantity: number, family: BundleFamily = "supplements") {
  const gross = cents(price) * quantity;
  const percent = bundleTier(quantity, family)?.percent ?? 0;
  const saved = unitDiscountCents(price, percent) * quantity;
  return {gross: gross / 100, saved: saved / 100, total: (gross - saved) / 100, percent};
}

/** Next tier message for a bag holding this many eligible units of one family. */
export function bundleNudge(eligibleUnits: number, family: BundleFamily = "supplements"): string | null {
  const {tiers, unit} = BUNDLE_OFFERS[family];
  const next = tiers.find(tier => eligibleUnits < tier.minQuantity);
  if (!next || eligibleUnits < 1) return null;
  const needed = next.minQuantity - eligibleUnits;
  return `Add ${needed} more ${unit[needed === 1 ? 0 : 1]} to save ${next.percent}%.`;
}

type BagLine = {id: string; quantity: number; purchase: string};
/** One time units of this family's eligible handles. Subscriptions and other families never count. */
export function bundleUnits(lines: readonly BagLine[], family: BundleFamily): number {
  return lines.filter(line => line.purchase === "once" && isBundleEligible(line.id, family)).reduce((n, line) => n + line.quantity, 0);
}

/** The next-tier message for every family with eligible units in the bag, counted separately. */
export function bundleNudges(lines: readonly BagLine[]): {family: BundleFamily; message: string}[] {
  return BUNDLE_FAMILIES.flatMap(family => {
    const message = bundleNudge(bundleUnits(lines, family), family);
    return message ? [{family, message}] : [];
  });
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
