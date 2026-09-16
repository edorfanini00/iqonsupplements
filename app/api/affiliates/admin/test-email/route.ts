import { sendTestEmail } from "@/lib/affiliates/mailer";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-test-email", 10, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

  const body = await request.json().catch(() => ({}));
  const to =
    typeof body.to === "string" && body.to.trim()
      ? body.to.trim()
      : session.email;

  if (!to || !to.includes("@")) {
    return apiError("VALIDATION_ERROR", "A valid recipient email is required.", 400);
  }

  const result = await sendTestEmail(to);

  return apiSuccess({
    to,
    mode: result.mode,
    apiKeyConfigured: result.apiKeyConfigured,
    from: result.from,
    error: result.error ?? null,
    id: result.id ?? null,
  });
}
