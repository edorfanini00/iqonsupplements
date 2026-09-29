import type { Product } from "./catalog";
import { isComingSoon } from "./commerce-policy";

/** Show the approved upcoming catalog without granting it live inventory.
 * Shopify owns prices, currency and variants; the launch hold can restrict availability. */
export function mergeCatalogMerchandise(live: Product[], editorial: Product[]): Product[] {
  const upcoming = editorial;
  const mapped = live.map(p => {
    const copy = upcoming.find(item => item.id === p.id);
    if (!copy) return isComingSoon(p) ? {...p,available:false} : p;
    const approvedSkincareImage = p.category === "skincare" && copy.category === "skincare"
      && copy.image?.startsWith("/images/skincare/products/");
    return {...p, ...(isComingSoon(p)?{available:false}:{}), descriptor: copy.descriptor, ritual: copy.ritual,
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
