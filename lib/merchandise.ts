import type { Product } from "./catalog";

/** Show the approved upcoming skincare range without granting it live inventory.
 * A matching Shopify record always owns price, currency, variants and availability. */
export function mergeSkincareMerchandise(live: Product[], editorial: Product[]): Product[] {
  const upcoming = editorial.filter(p => p.category === "skincare");
  const mapped = live.map(p => {
    const copy = upcoming.find(item => item.id === p.id);
    return copy ? {...p, descriptor: copy.descriptor, ritual: copy.ritual} : p;
  });
  return [...mapped, ...upcoming.filter(p => !live.some(item => item.id === p.id)).map(p => ({
    ...p, available: false, variants: [], requiresSellingPlan: false,
  }))];
}
