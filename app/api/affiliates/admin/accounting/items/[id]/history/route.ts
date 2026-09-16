import { getStockHistory } from "@/lib/accounting/report";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";
// Scanning Shopify orders across many pages can exceed the default limit.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const { id } = await context.params;
    const history = await getStockHistory(id);
    if (!history) return apiError("NOT_FOUND", "Inventory item not found.", 404);

    return apiSuccess({ history });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/items/:id/history GET]", err);
    return apiError("INTERNAL", "Failed to load stock history.", 500);
  }
}
