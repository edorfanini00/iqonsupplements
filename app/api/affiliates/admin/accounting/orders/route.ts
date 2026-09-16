import { createSupplierOrder, listSupplierOrders } from "@/lib/accounting/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_NOTE = 1_000;
const MAX_NAME = 200;
const MAX_LINES = 100;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const orders = await listSupplierOrders();
    return apiSuccess({ orders });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/orders GET]", err);
    return apiError("INTERNAL", "Failed to load orders.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as {
      supplier?: string;
      note?: string;
      orderedAt?: string;
      arrived?: boolean;
      lines?: {
        shopifyProductId?: number;
        productName?: string;
        units?: number;
        totalCost?: number;
      }[];
    };

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return apiError("INVALID_LINES", "Add at least one product to the order.", 400);
    }
    if (body.lines.length > MAX_LINES) {
      return apiError("INVALID_LINES", "Too many lines in one order.", 400);
    }

    const lines: {
      shopifyProductId: number;
      productName: string;
      units: number;
      totalCost: number;
    }[] = [];
    for (const raw of body.lines) {
      const shopifyProductId = Number(raw.shopifyProductId);
      if (!Number.isInteger(shopifyProductId) || shopifyProductId <= 0) {
        return apiError("INVALID_PRODUCT", "Pick a product for every line.", 400);
      }
      const productName = (raw.productName ?? "").trim();
      if (!productName || productName.length > MAX_NAME) {
        return apiError("INVALID_PRODUCT", "Product name missing or too long.", 400);
      }
      const units = Number(raw.units);
      if (!Number.isInteger(units) || units <= 0 || units > 1_000_000) {
        return apiError(
          "INVALID_UNITS",
          `Units for ${productName} must be a positive whole number.`,
          400
        );
      }
      const totalCost = Number(raw.totalCost);
      if (!Number.isFinite(totalCost) || totalCost < 0 || totalCost > 10_000_000) {
        return apiError("INVALID_COST", `Enter a valid cost for ${productName}.`, 400);
      }
      lines.push({ shopifyProductId, productName, units, totalCost });
    }

    if (body.supplier && body.supplier.length > MAX_NAME) {
      return apiError("INVALID_SUPPLIER", "Supplier name is too long.", 400);
    }
    if (body.note && body.note.length > MAX_NOTE) {
      return apiError("INVALID_NOTE", "Note is too long.", 400);
    }
    const orderedAt = body.orderedAt ? new Date(body.orderedAt) : new Date();
    if (Number.isNaN(orderedAt.getTime())) {
      return apiError("INVALID_DATE", "Invalid order date.", 400);
    }

    const order = await createSupplierOrder({
      supplier: body.supplier,
      note: body.note,
      orderedAt,
      arrived: body.arrived === true,
      lines,
    });

    return apiSuccess({ order });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/orders POST]", err);
    return apiError("INTERNAL", "Failed to record the order.", 500);
  }
}
