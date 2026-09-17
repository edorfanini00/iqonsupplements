import { createManualSale, listManualSales } from "@/lib/accounting/store";
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

    const sales = await listManualSales();
    return apiSuccess({ sales });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/sales GET]", err);
    return apiError("INTERNAL", "Failed to load offline sales.", 500);
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
      kind?: string;
      units?: number;
      totalAmount?: number;
      soldAt?: string;
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
    // "giveaway" = free shipment (e.g. to an affiliate): deducts inventory,
    // no revenue. Anything else is a regular offline sale.
    const kind = body.kind === "giveaway" ? "giveaway" : "sale";
    const units = Number(body.units);
    if (!Number.isInteger(units) || units <= 0 || units > 1_000_000) {
      return apiError("INVALID_UNITS", "Units must be a positive whole number.", 400);
    }
    const totalAmount = kind === "giveaway" ? 0 : Number(body.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 10_000_000) {
      return apiError("INVALID_AMOUNT", "Enter a valid sale amount.", 400);
    }
    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();
    if (Number.isNaN(soldAt.getTime())) {
      return apiError("INVALID_DATE", "Invalid sale date.", 400);
    }
    if (body.note && body.note.length > MAX_NOTE) {
      return apiError("INVALID_NOTE", "Note is too long.", 400);
    }

    const sale = await createManualSale({
      shopifyProductId,
      productName,
      kind,
      units,
      totalAmount,
      soldAt,
      note: body.note,
    });

    return apiSuccess({ sale });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/sales POST]", err);
    return apiError("INTERNAL", "Failed to record offline sale.", 500);
  }
}
