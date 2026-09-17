import { createAdjustment, listAdjustments } from "@/lib/accounting/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_REASON = 1_000;
const MAX_NAME = 200;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const adjustments = await listAdjustments();
    return apiSuccess({ adjustments });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/adjustments GET]", err);
    return apiError("INTERNAL", "Failed to load adjustments.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as {
      shopifyProductId?: number;
      productName?: string;
      delta?: number;
      reason?: string;
      adjustedAt?: string;
    };

    const shopifyProductId = Number(body.shopifyProductId);
    if (!Number.isInteger(shopifyProductId) || shopifyProductId <= 0) {
      return apiError("INVALID_PRODUCT", "Pick a product.", 400);
    }
    const productName = (body.productName ?? "").trim();
    if (!productName || productName.length > MAX_NAME) {
      return apiError("INVALID_PRODUCT", "Product name missing or too long.", 400);
    }
    const delta = Number(body.delta);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
      return apiError(
        "INVALID_UNITS",
        "Adjustment must be a non-zero whole number of units.",
        400
      );
    }
    const adjustedAt = body.adjustedAt ? new Date(body.adjustedAt) : new Date();
    if (Number.isNaN(adjustedAt.getTime())) {
      return apiError("INVALID_DATE", "Invalid adjustment date.", 400);
    }
    if (body.reason && body.reason.length > MAX_REASON) {
      return apiError("INVALID_REASON", "Reason is too long.", 400);
    }

    const adjustment = await createAdjustment({
      shopifyProductId,
      productName,
      delta,
      reason: body.reason,
      adjustedAt,
    });

    return apiSuccess({ adjustment });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/adjustments POST]", err);
    return apiError("INTERNAL", "Failed to record the adjustment.", 500);
  }
}
