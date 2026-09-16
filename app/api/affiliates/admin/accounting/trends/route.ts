import { getDemandTrends } from "@/lib/accounting/report";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const url = new URL(request.url);
    const monthsParam = Number(url.searchParams.get("months"));
    const months = Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : 12;

    const trends = await getDemandTrends(months);
    return apiSuccess({ trends });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/trends GET]", err);
    return apiError("INTERNAL", "Failed to load trends.", 500);
  }
}
