import { isComingSoon, isOrderable } from "./commerce-policy";
import { SKINCARE_BUNDLE_TIERS, type BundleTier } from "./bundle-offer";

/** Customer-facing skincare availability wording, derived only from the catalog the page renders.
 * It never grants purchase eligibility: that stays with isComingSoon / launchQualified and the
 * fresh cart and checkout re-qualification.
 *  - "live":    every skincare card shown is orderable now
 *  - "partial": some skincare is orderable, some is held (sold out, price drift, single hold)
 *  - "held":    live store, but no skincare is orderable right now (sold out, qualification outage)
 *  - "preview": the store is not live (mode !== "live"): the original preview copy, unchanged
 * Post-launch held wording is neutral (owner, 11 Nov 2026): true for sold out, outage or a single hold,
 * never "coming soon". */
export type SkincareAvailability = "live" | "partial" | "held" | "preview";
type CatalogProduct = Parameters<typeof isOrderable>[0] & Parameters<typeof isComingSoon>[0];

export function skincareAvailability(products: readonly CatalogProduct[], mode: string): SkincareAvailability {
  if (mode !== "live") return "preview";
  const skin = products.filter(p => p.category === "skincare");
  const orderable = skin.filter(p => isOrderable(p, mode)).length;
  if (!orderable) return "held";
  return orderable === skin.length ? "live" : "partial";
}
/** At least one skincare product can be ordered now. */
export const isSkincareOrderable = (state: SkincareAvailability) => state === "live" || state === "partial";

export const SKINCARE_PREVIEW_SUBTITLE = "Coming soon. Explore the collection ahead of launch.";
export const SKINCARE_HELD_SUBTITLE = "Skincare isn’t available to order right now.";
export function skincareCollectionSubtitle(state: SkincareAvailability) {
  return state === "live" ? "Cleanse. Treat. Moisturize. Ready to order now."
    : state === "partial" ? "Some skincare products aren’t available to order right now."
    : state === "held" ? SKINCARE_HELD_SUBTITLE
    : SKINCARE_PREVIEW_SUBTITLE;
}

export const DEFAULT_ALL_SUBTITLE = "Find your everyday essentials.";
export const HELD_ALL_SUBTITLE = "Supplements are available to order now. Skincare isn’t available to order right now.";
/** All-products header. `supplementsOrderable`: any supplement can be ordered now. `skincareHeld`: a skincare card is held. */
export function allProductsSubtitle(state: SkincareAvailability, supplementsOrderable: boolean, skincareHeld: boolean) {
  if (state === "preview" || !supplementsOrderable) return DEFAULT_ALL_SUBTITLE;
  if (state === "live") return "Shop IQON supplements and skincare, ready to order now.";
  if (state === "partial") return "Supplements and skincare are available to order now. Some skincare products aren’t available right now.";
  return skincareHeld ? HELD_ALL_SUBTITLE : DEFAULT_ALL_SUBTITLE;
}

/** "Skincare preview" survives only in the non-live preview store. */
export function skincareDepartmentLabel(state: SkincareAvailability, skincareHeld: boolean) {
  return state === "preview" && skincareHeld ? "Skincare preview" : "Skincare";
}

/** The /skincare hero eyebrow: "Coming soon" survives only in the non-live preview store. */
export function skincareHeroEyebrow(state: SkincareAvailability) {
  return state === "preview" ? "IQON / SKINCARE / COMING SOON" : "IQON / SKINCARE";
}

/** Help store answer sentence while no skincare is orderable in the live store. */
export const HELP_SKINCARE_HELD = "IQON skincare isn’t available to order right now.";

/** Server metadata for /collections/{all,skincare}, from the same request-scoped catalog the page renders. */
export function collectionDescription(category: "all" | "skincare", state: SkincareAvailability) {
  if (category === "skincare") return state === "preview" ? "Explore the IQON skincare collection ahead of launch."
    : state === "held" ? "Explore the IQON skincare collection. Skincare isn’t available to order right now."
    : "Shop the IQON skincare collection. Cleanse, treat and moisturize.";
  if (state === "preview") return "Shop IQON supplements and preview the skincare collection, coming soon.";
  if (state === "held") return "Shop IQON supplements. Skincare isn’t available to order right now.";
  if (state === "partial") return "Shop IQON supplements and skincare in one place.";
  return "Shop every IQON supplement and skincare product in one place.";
}

/** Help "bundle savings" addition, built from the skincare discount tiers so the copy can't drift from the
 * Shopify discount config. Only shown while skincare is orderable; held skincare gets no bundle line.
 * Owner decision 11 Nov 2026. No discount code claim: the skincare terms don't state one. */
export function skincareBundleHelp(state: SkincareAvailability, tiers: readonly BundleTier[] = SKINCARE_BUNDLE_TIERS): string | null {
  if (!isSkincareOrderable(state) || !tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const offers = sorted.map((t, i) => `buy ${t.minQuantity}${i === 0 ? " IQON skincare products" : ""}${i === sorted.length - 1 && i > 0 ? " or more" : ""} and save ${t.percent}%`);
  return `Skincare has its own bundle: ${offers.join(", or ")}. Mix and match any IQON skincare. Supplements and skincare are counted separately. Savings apply automatically in your bag and at checkout.`;
}
