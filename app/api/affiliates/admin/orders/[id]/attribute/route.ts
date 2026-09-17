/**
 * POST   /api/affiliates/admin/orders/[id]/attribute — manually credit a paid
 *        Shopify order to a chosen affiliate (for orders that came in
 *        without the affiliate's code). Body: { affiliateId }.
 * DELETE /api/affiliates/admin/orders/[id]/attribute — remove the attribution.
 *
 * Commission is computed exactly like the automatic ingest (first-order rate on
 * net product revenue) and the affiliate's network referrer is credited too.
 */

import {
  attributeShopifyOrderToAffiliate,
  removeShopifyOrderAttribution,
} from "@/lib/affiliates/shopify-ingest";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

function parseShopifyOrderId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const shopifyOrderId = parseShopifyOrderId(id);
    if (shopifyOrderId == null) return apiError("INVALID_ORDER", "Invalid order id.", 400);

    const body = (await request.json().catch(() => ({}))) as { affiliateId?: string };
    const affiliateId = (body.affiliateId ?? "").trim();
    if (!affiliateId) return apiError("INVALID_AFFILIATE", "Pick an affiliate.", 400);

    const result = await attributeShopifyOrderToAffiliate(shopifyOrderId, affiliateId);
    if (!result.ok) {
      return apiError("ATTRIBUTION_FAILED", result.reason ?? "Could not attribute order.", 400);
    }

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "affiliate.order.manual_attribution",
      targetAffiliateId: result.affiliateId,
      after: {
        shopifyOrderId,
        affiliateId: result.affiliateId,
        promoCode: result.promoCode,
        commission: result.commission,
        reassigned: Boolean(result.reassigned),
      },
      request,
    });

    return apiSuccess({ attribution: result });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/orders/[id]/attribute POST]", err);
    return apiError("INTERNAL", "Failed to attribute order.", 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const shopifyOrderId = parseShopifyOrderId(id);
    if (shopifyOrderId == null) return apiError("INVALID_ORDER", "Invalid order id.", 400);

    const result = await removeShopifyOrderAttribution(shopifyOrderId);
    if (!result.ok) {
      return apiError("REMOVE_FAILED", result.reason ?? "Could not remove attribution.", 400);
    }

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "affiliate.order.manual_attribution_removed",
      after: { shopifyOrderId, removed: result.removed },
      request,
    });

    return apiSuccess({ removed: result.removed });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/orders/[id]/attribute DELETE]", err);
    return apiError("INTERNAL", "Failed to remove attribution.", 500);
  }
}
