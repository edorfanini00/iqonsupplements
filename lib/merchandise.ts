import type { Product } from "./catalog";

/** Show the approved upcoming catalog without granting it live inventory.
 * A matching Shopify record always owns price, currency, variants and availability. */
export function mergeCatalogMerchandise(live: Product[], editorial: Product[]): Product[] {
  const upcoming = editorial;
  const mapped = live.map(p => {
    const copy = upcoming.find(item => item.id === p.id);
    if (!copy) return p;
    const approvedSkincareImage = p.category === "skincare" && copy.category === "skincare"
      && copy.image?.startsWith("/images/skincare/products/");
    return {...p, descriptor: copy.descriptor, ritual: copy.ritual,
      ...(approvedSkincareImage ? {
        image: copy.image,
        images: [{src: copy.image, alt: copy.images?.[0]?.alt || `IQON ${copy.name}`}, ...(p.images || []).slice(1)],
        campaign: p.campaign === p.image ? copy.image : p.campaign,
      } : {}),
    };
  });
  return [...mapped, ...upcoming.filter(p => !live.some(item => item.id === p.id)).map(p => ({
    ...p, available: false, variants: [], requiresSellingPlan: false,
  }))];
}
