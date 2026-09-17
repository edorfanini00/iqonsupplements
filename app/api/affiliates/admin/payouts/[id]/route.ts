import { reversePayout } from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

  const { id } = await context.params;
  const ok = await reversePayout(id);
  if (!ok) return apiError("NOT_FOUND", "Not found", 404);

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "payout_reverse",
    after: { payoutId: id },
    request,
  });

  return apiSuccess({});
}
