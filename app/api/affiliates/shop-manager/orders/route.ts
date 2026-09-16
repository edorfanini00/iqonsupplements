/**
 * GET /api/affiliates/shop-manager/orders — fulfillment queue for shop managers.
 * Returns Shopify orders with line items and shipping addresses only.
 */

import { resolveRange } from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireShopManagerSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { listPaidOrders } from "@/lib/portal-commerce";
import { toShopifyLocalDate } from "@/lib/affiliates/time-series";
import { extractTracking } from "@/lib/orders/tracking";
import type { ShopifyOrderPayload } from "@/types/portal-commerce";

export const runtime = "nodejs";

function formatAddress(
  address: ShopifyOrderPayload["shipping"] | ShopifyOrderPayload["billing"] | undefined
): string {
  if (!address) return "";
  const name = `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim();
  const lines = [
    name,
    address.company,
    address.address_1,
    address.address_2,
    [address.city, address.state, address.postcode].filter(Boolean).join(", "),
    address.country,
  ].filter((line) => Boolean(line?.trim()));
  return lines.join("\n");
}

export async function GET(request: Request) {
  try {
    const session = await requireShopManagerSession();
    if (isNextResponse(session)) return session;

    const url = new URL(request.url);
    const { start, end, value: preset } = resolveRange(
      url.searchParams.get("range")
    );

    const shopifyResult = await listPaidOrders({
      after: toShopifyLocalDate(start),
      before: toShopifyLocalDate(end),
      statuses: ["processing", "completed", "pending", "on-hold"],
      fields:
        "id,status,date_created,date_paid,billing,shipping,line_items,meta_data,shipping_lines",
    });

    const orders = shopifyResult.orders.map((o) => {
      const shipping = o.shipping ?? o.billing;
      const tracking = extractTracking(o);
      return {
        id: o.id,
        status: o.status,
        date: o.date_paid || o.date_created,
        customerName: `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim(),
        customerEmail: o.billing?.email ?? "",
        customerPhone: o.billing?.phone ?? "",
        shippingName: `${shipping?.first_name ?? ""} ${shipping?.last_name ?? ""}`.trim(),
        shippingAddress: formatAddress(shipping),
        shippingMethod:
          o.shipping_lines?.[0]?.method_title ??
          o.shipping_lines?.[0]?.method_id ??
          null,
        items: (o.line_items ?? []).map((li) => ({
          name: li.name ?? `#${li.product_id}`,
          quantity: li.quantity,
        })),
        tracking,
      };
    });

    return apiSuccess({
      orders,
      truncated: shopifyResult.truncated,
      preset,
    });
  } catch (err) {
    console.error("[api/affiliates/shop-manager/orders]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
