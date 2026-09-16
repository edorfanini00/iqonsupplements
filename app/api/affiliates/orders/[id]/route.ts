import { shopifyAdminConfigured } from "@/lib/affiliates/shopify-admin";
import {
  getAffiliateOrderById,
  getAffiliateById,
  updateCartSnapshotForShopifyOrder,
  type AffiliateOrderItem,
} from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

const SHOPIFY_ENABLED = shopifyAdminConfigured();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const session = await requireAffiliateSession();
  if (isNextResponse(session)) return session;

  const order = await getAffiliateOrderById(id);
  if (!order) return apiError("NOT_FOUND", "Not found", 404);

  if (session.role !== "admin" && order.affiliateId !== sessionProfileId(session)) {
    return apiError("FORBIDDEN", "Forbidden", 403);
  }

  const url = new URL(request.url);
  const wantRefresh = url.searchParams.get("refresh") === "1";

  let refreshed = order;
  let refreshError: string | null = null;
  let refreshAttempted = false;

  if (wantRefresh && order.shopifyOrderId && SHOPIFY_ENABLED) {
    refreshAttempted = true;
    try {
      const { getOrder } = await import("@/lib/portal-commerce");
      const shopifyOrder = await getOrder(order.shopifyOrderId);
      if (shopifyOrder) {
        const items: AffiliateOrderItem[] = (shopifyOrder.line_items ?? []).map((li) => ({
          productId: li.product_id,
          name: (li.name ?? "Item").trim(),
          quantity:
            typeof li.quantity === "number" ? li.quantity : Number(li.quantity) || 1,
          unitPrice: li.price ? Number(li.price) : undefined,
          subtotal: li.subtotal ? Number(li.subtotal) : undefined,
          total: li.total ? Number(li.total) : undefined,
          imageUrl: li.image?.src,
        }));
        const snapshot = {
          items,
          subtotal: items.reduce((s, it) => s + (it.subtotal ?? 0), 0),
          discountTotal: shopifyOrder.discount_total
            ? Number(shopifyOrder.discount_total)
            : undefined,
          shippingTotal: shopifyOrder.shipping_total
            ? Number(shopifyOrder.shipping_total)
            : undefined,
          taxTotal: shopifyOrder.total_tax ? Number(shopifyOrder.total_tax) : undefined,
          currency: shopifyOrder.currency,
          couponCode: order.couponCode,
        };
        await updateCartSnapshotForShopifyOrder(order.shopifyOrderId, snapshot);
        const stored = await getAffiliateOrderById(id);
        if (stored) refreshed = stored;
      }
    } catch (err) {
      refreshError = err instanceof Error ? err.message : "Failed to refresh from Shopify.";
    }
  }

  const owner = await getAffiliateById(refreshed.affiliateId);
  const sourceAffiliate = refreshed.sourceAffiliateId
    ? await getAffiliateById(refreshed.sourceAffiliateId)
    : null;

  return apiSuccess({
    order: refreshed,
    affiliate: owner
      ? {
          id: owner.id,
          name: `${owner.firstName} ${owner.lastName}`.trim(),
          promoCode: owner.promoCode,
          commissionRate: owner.commissionRate,
        }
      : null,
    sourceAffiliate: sourceAffiliate
      ? {
          id: sourceAffiliate.id,
          name: `${sourceAffiliate.firstName} ${sourceAffiliate.lastName}`.trim(),
          promoCode: sourceAffiliate.promoCode,
        }
      : null,
    refresh: {
      enabled: SHOPIFY_ENABLED && Boolean(refreshed.shopifyOrderId),
      attempted: refreshAttempted,
      error: refreshError,
      lastSyncedAt: refreshed.itemsSyncedAt ?? null,
    },
  });
}
