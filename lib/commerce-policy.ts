/** Keep skincare visible for discovery, but closed to every purchase entry point. */
export const SKINCARE_COMING_SOON = true;
export function isComingSoon(product:{category?:string}) {
  return SKINCARE_COMING_SOON && product.category === "skincare";
}
