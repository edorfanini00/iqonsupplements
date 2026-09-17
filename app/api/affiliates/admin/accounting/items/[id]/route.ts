import { updateItemThreshold } from "@/lib/accounting/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      lowStockThreshold?: number;
    };

    const threshold = Number(body.lowStockThreshold);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100_000) {
      return apiError("INVALID_THRESHOLD", "Threshold must be a whole number ≥ 0.", 400);
    }

    const ok = await updateItemThreshold(id, threshold);
    if (!ok) return apiError("NOT_FOUND", "Inventory item not found.", 404);

    return apiSuccess({ updated: true });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/items/:id PATCH]", err);
    return apiError("INTERNAL", "Failed to update item.", 500);
  }
}
