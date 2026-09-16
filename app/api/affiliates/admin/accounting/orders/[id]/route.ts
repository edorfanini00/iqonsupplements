import { deleteSupplierOrder, markSupplierOrderArrived } from "@/lib/accounting/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

/** Mark an in-transit supplier order as arrived — its stock starts counting. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "arrived") {
      return apiError("INVALID_ACTION", "Unsupported action.", 400);
    }

    const { id } = await context.params;
    const order = await markSupplierOrderArrived(id);
    if (!order) return apiError("NOT_FOUND", "Order not found.", 404);

    return apiSuccess({ order });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/orders/:id PATCH]", err);
    return apiError("INTERNAL", "Failed to update the order.", 500);
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
    const ok = await deleteSupplierOrder(id);
    if (!ok) return apiError("NOT_FOUND", "Order not found.", 404);

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/orders/:id DELETE]", err);
    return apiError("INTERNAL", "Failed to delete the order.", 500);
  }
}
