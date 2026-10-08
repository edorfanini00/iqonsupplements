"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { contentId, trackViewContent } from "@/lib/analytics/meta";
import type { Product } from "@/lib/catalog";

/** ViewContent for a product page. Uses the variant the page opens with (first available). */
export function MetaViewContent({ product }: { product: Product }) {
  const pathname = usePathname();
  const variant = product.variants?.find((v) => v.available) ?? product.variants?.[0];
  const id = contentId(variant?.id, product.id);
  const value = variant?.price ?? product.price;
  const currency = variant?.currency ?? product.currency ?? "USD";
  useEffect(() => {
    if (product.pricePending) return;
    trackViewContent({ routeKey: pathname, contentId: id, name: product.name, value, currency });
  }, [pathname, id, product.name, product.pricePending, value, currency]);
  return null;
}
