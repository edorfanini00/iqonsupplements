import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isValidCreatorCode } from "@/lib/affiliates/creator-codes";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";

export const runtime = "nodejs";

/**
 * Validates a creator access code for the IQON mobile app, which uses it to
 * unlock premium without an App Store subscription.
 *
 * Public by necessity — the app calls it before the user has any account we
 * could authenticate. The rate limit is much tighter than other public routes
 * because this endpoint is the only thing standing between a guessed code and
 * free access.
 */
export async function POST(request: Request) {
  try {
    const rate = await enforceRateLimit(request, "creator-code", 10, 60_000);
    if (!rate.allowed) {
      return apiError("RATE_LIMITED", "Too many attempts. Try again shortly.", 429);
    }

    let code: unknown;
    try {
      code = (await request.json())?.code;
    } catch {
      return apiError("INVALID_BODY", "Expected a JSON body with a code.", 400);
    }

    if (typeof code !== "string" || !code.trim()) {
      return apiError("INVALID_CODE", "Enter a code.", 400);
    }

    // A wrong code is a normal outcome, not a failure, so it answers 200 with
    // valid: false. That keeps the app's error handling reserved for genuine
    // problems like the server being unreachable.
    return apiSuccess({ valid: isValidCreatorCode(code) });
  } catch (err) {
    console.error("[api/affiliates/creator-code]", err);
    return apiError("INTERNAL", "Could not verify the code.", 500);
  }
}
