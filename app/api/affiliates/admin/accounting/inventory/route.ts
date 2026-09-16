import { getInventoryReport } from "@/lib/accounting/report";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";
// Scanning Shopify orders across many pages can exceed the default limit.
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const report = await getInventoryReport();
    return apiSuccess({
      items: report.items,
      lowCount: report.lowCount,
      truncated: report.truncated,
    });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/inventory GET]", err);
    return apiError("INTERNAL", "Failed to load inventory.", 500);
  }
}
