import { isComingSoon, isOrderable } from "./commerce-policy";

/** Customer-facing skincare availability wording, derived only from the catalog the page renders.
 * It never grants purchase eligibility: that stays with isComingSoon / launchQualified and the
 * fresh cart and checkout re-qualification. Anything not orderable falls back to the held copy.
 *  - "live":    every skincare card shown is orderable now
 *  - "partial": some skincare is orderable, some is still held
 *  - "held":    nothing is orderable (preview, outage, unqualified or held) */
export type SkincareAvailability = "live" | "partial" | "held";
type CatalogProduct = Parameters<typeof isOrderable>[0] & Parameters<typeof isComingSoon>[0];

export function skincareAvailability(products: readonly CatalogProduct[], mode: string): SkincareAvailability {
  const skin = products.filter(p => p.category === "skincare");
  const orderable = skin.filter(p => isOrderable(p, mode)).length;
  if (!orderable) return "held";
  return orderable === skin.length ? "live" : "partial";
}

export const SKINCARE_HELD_SUBTITLE = "Coming soon. Explore the collection ahead of launch.";
export function skincareCollectionSubtitle(state: SkincareAvailability) {
  return state === "live" ? "Cleanse. Treat. Moisturize. Ready to order now."
    : state === "partial" ? "Shop skincare now. A few products are still coming soon."
    : SKINCARE_HELD_SUBTITLE;
}

export const DEFAULT_ALL_SUBTITLE = "Find your everyday essentials.";
export const HELD_ALL_SUBTITLE = "Supplements are available to order now. Skincare is shown as a preview and can’t be ordered yet.";
/** All-products header. `supplementsOrderable`: any supplement can be ordered now. */
export function allProductsSubtitle(state: SkincareAvailability, supplementsOrderable: boolean, skincarePreview: boolean) {
  if (!supplementsOrderable) return DEFAULT_ALL_SUBTITLE;
  if (state === "live") return "Shop IQON supplements and skincare, ready to order now.";
  if (state === "partial") return "Supplements and skincare are available to order now. A few skincare products are still coming soon.";
  return skincarePreview ? HELD_ALL_SUBTITLE : DEFAULT_ALL_SUBTITLE;
}

/** "Skincare preview" only while no skincare can be ordered. */
export function skincareDepartmentLabel(state: SkincareAvailability, skincarePreview: boolean) {
  return state === "held" && skincarePreview ? "Skincare preview" : "Skincare";
}

/** The /skincare hero eyebrow keeps its "Coming soon" tag only while nothing can be ordered. */
export function skincareHeroEyebrow(state: SkincareAvailability) {
  return state === "held" ? "IQON / SKINCARE / COMING SOON" : "IQON / SKINCARE";
}

/** Server metadata for /collections/{all,skincare}, from the same request-scoped catalog the page renders. */
export function collectionDescription(category: "all" | "skincare", state: SkincareAvailability) {
  if (category === "skincare") return state === "held" ? "Explore the IQON skincare collection ahead of launch." : "Shop the IQON skincare collection. Cleanse, treat and moisturize.";
  return state === "held" ? "Shop IQON supplements and preview the skincare collection, coming soon." : "Shop every IQON supplement and skincare product in one place.";
}
