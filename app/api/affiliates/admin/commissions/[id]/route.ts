import { voidPendingAffiliateOrder } from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

/**
 * Remove a single pending commission entry from an affiliate's payable balance.
 * Only affects un-paid (pending) rows — commissions already settled in a payout
 * can't be dropped this way.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

  const { id } = await context.params;
  const ok = await voidPendingAffiliateOrder(id);
  if (!ok) {
    return apiError(
      "NOT_FOUND",
      "Commission not found or already settled in a payout.",
      404
    );
  }

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "commission_void",
    after: { affiliateOrderId: id },
    request,
  });

  return apiSuccess({});
}
