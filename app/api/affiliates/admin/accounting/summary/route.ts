import { getPnlSummary } from "@/lib/accounting/report";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Earliest date used for "all time" summaries. */
const ALL_TIME_START = "2020-01-01T00:00:00.000Z";

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? new Date(fromParam) : new Date(ALL_TIME_START);
    const to = toParam ? new Date(toParam) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return apiError("INVALID_RANGE", "Invalid date range.", 400);
    }

    const summary = await getPnlSummary(from, to);
    return apiSuccess({ summary });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/summary GET]", err);
    return apiError("INTERNAL", "Failed to build summary.", 500);
  }
}
