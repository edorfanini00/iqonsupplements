import { listActiveAffiliateRoster } from "@/lib/affiliates/store";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

/**
 * Public roster of active affiliates, consumed by the IQON mobile app to
 * populate its "who referred you?" onboarding step. Approving an affiliate in
 * the admin portal is all it takes for them to appear in the app.
 *
 * Unlike /api/affiliates/referrer-search this intentionally returns everyone,
 * because the app presents a browsable list instead of a typeahead. Only the
 * fields the picker renders are exposed — names, promo codes and social handles
 * are already public, emails and payout details are not and stay out.
 */
export async function GET(request: Request) {
  try {
    const rate = await enforceRateLimit(request, "affiliate-roster", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const affiliates = await listActiveAffiliateRoster();

    return apiSuccess(
      { affiliates },
      {
        headers: {
          // The roster only changes when an admin approves someone, so serving
          // a slightly stale copy is fine and keeps onboarding instant.
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/roster]", err);
    return apiError("INTERNAL", "Could not load affiliates.", 500);
  }
}
