import {
  requireAffiliateOnlySession,
  isNextResponse,
} from "@/lib/affiliates/auth-guards";
import { updateAffiliate } from "@/lib/affiliates/store";
import { ensureWelcomeCoupon } from "@/lib/affiliates/welcome-coupon";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

/** Whether the logged-in affiliate still needs the first-login welcome flow. */
export async function GET() {
  try {
    const session = await requireAffiliateOnlySession();
    if (isNextResponse(session)) return session;
    const profile = session.profile!;

    return apiSuccess({
      needsOnboarding: !profile.onboardedAt,
      welcomeCode: profile.welcomeCouponCode ?? null,
    });
  } catch (err) {
    console.error("[api/affiliates/onboarding] GET", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

/**
 * Completes onboarding: issues the affiliate's personal one-time 70% welcome
 * coupon in Shopify (idempotent) and marks the flow as done.
 */
export async function POST() {
  try {
    const session = await requireAffiliateOnlySession();
    if (isNextResponse(session)) return session;
    const profile = session.profile!;

    let code = profile.welcomeCouponCode ?? null;
    if (!code) {
      code = await ensureWelcomeCoupon(profile);
    }

    await updateAffiliate(profile.id, {
      welcomeCouponCode: code ?? undefined,
      onboardedAt: profile.onboardedAt ?? new Date().toISOString(),
    });

    return apiSuccess({ welcomeCode: code });
  } catch (err) {
    console.error("[api/affiliates/onboarding] POST", err);
    return apiError(
      "INTERNAL_ERROR",
      "Couldn't generate your welcome code. Please try again.",
      500
    );
  }
}
