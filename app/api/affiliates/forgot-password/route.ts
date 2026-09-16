import {
  getAffiliateByEmail,
  createAffiliatePasswordReset,
} from "@/lib/affiliates/store";
import {
  getPasswordResetUrl,
  sendPasswordResetEmail,
} from "@/lib/affiliates/mailer";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

const RESET_TTL_MINUTES = 60;

// Generic response so we never reveal whether an email is registered.
const GENERIC = {
  message:
    "If an affiliate account exists for that email, we've sent a password reset link.",
};

export async function POST(request: Request) {
  try {
    const rate = await enforceRateLimit(
      request,
      "affiliates-forgot-password",
      5,
      60_000
    );
    if (!rate.allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many requests. Please try again in a minute.",
        429
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email || !email.includes("@")) {
      return apiError("VALIDATION_ERROR", "A valid email is required.", 400);
    }

    const affiliate = await getAffiliateByEmail(email);
    // Only send a reset link to known affiliate accounts; always return generic.
    if (!affiliate) {
      console.warn(
        "[forgot-password] no affiliate profile found for email — nothing sent",
        { email }
      );
    } else if (affiliate.status === "disabled") {
      console.warn("[forgot-password] affiliate is disabled — nothing sent", {
        email,
      });
    } else {
      const created = await createAffiliatePasswordReset(
        affiliate.email,
        RESET_TTL_MINUTES
      );
      if (!created) {
        console.error(
          "[forgot-password] could not create reset token (database not configured?)",
          { email: affiliate.email }
        );
      } else {
        const result = await sendPasswordResetEmail({
          firstName: affiliate.firstName,
          email: affiliate.email,
          resetUrl: getPasswordResetUrl(created.token),
          expiresMinutes: RESET_TTL_MINUTES,
        });
        console.log("[forgot-password] reset email dispatched", {
          email: affiliate.email,
          mode: result.mode,
          error: result.error ?? null,
        });
      }
    }

    return apiSuccess(GENERIC);
  } catch (err) {
    console.error("[api/affiliates/forgot-password]", err);
    // Still return generic success to avoid leaking state / errors.
    return apiSuccess(GENERIC);
  }
}
