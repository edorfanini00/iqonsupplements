import { createPurchase, listPurchases } from "@/lib/accounting/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_NOTE = 1_000;
const MAX_NAME = 200;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const purchases = await listPurchases();
    return apiSuccess({ purchases });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/purchases GET]", err);
    return apiError("INTERNAL", "Failed to load purchases.", 500);
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
      units?: number;
      totalCost?: number;
      purchasedAt?: string;
      note?: string;
    };

    const shopifyProductId = Number(body.shopifyProductId);
    if (!Number.isInteger(shopifyProductId) || shopifyProductId <= 0) {
      return apiError("INVALID_PRODUCT", "Pick a product.", 400);
    }
    const productName = (body.productName ?? "").trim();
    if (!productName || productName.length > MAX_NAME) {
      return apiError("INVALID_PRODUCT", "Product name missing or too long.", 400);
    }
    const units = Number(body.units);
    if (!Number.isInteger(units) || units <= 0 || units > 1_000_000) {
      return apiError("INVALID_UNITS", "Units must be a positive whole number.", 400);
    }
    const totalCost = Number(body.totalCost);
    if (!Number.isFinite(totalCost) || totalCost < 0 || totalCost > 10_000_000) {
      return apiError("INVALID_COST", "Enter a valid total cost.", 400);
    }
    const purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : new Date();
    if (Number.isNaN(purchasedAt.getTime())) {
      return apiError("INVALID_DATE", "Invalid purchase date.", 400);
    }
    if (body.note && body.note.length > MAX_NOTE) {
      return apiError("INVALID_NOTE", "Note is too long.", 400);
    }

    const purchase = await createPurchase({
      shopifyProductId,
      productName,
      units,
      totalCost,
      purchasedAt,
      note: body.note,
    });

    return apiSuccess({ purchase });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/purchases POST]", err);
    return apiError("INTERNAL", "Failed to record purchase.", 500);
  }
}
