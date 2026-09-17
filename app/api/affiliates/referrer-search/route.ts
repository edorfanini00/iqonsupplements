import { searchActiveAffiliates } from "@/lib/affiliates/store";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

/**
 * Public typeahead for the signup "who referred you?" field.
 * Returns up to 8 active affiliates matching a name or promo code. Requires a
 * query (>= 2 chars) so the full roster is never exposed.
 */
export async function GET(request: Request) {
  try {
    const rate = await enforceRateLimit(request, "referrer-search", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return apiSuccess({ results: [] });

    const results = await searchActiveAffiliates(q, 8);
    return apiSuccess({ results });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/referrer-search]", err);
    return apiError("INTERNAL", "Search failed.", 500);
  }
}
