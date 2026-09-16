/**
 * POST /api/affiliates/admin/marketing/campaigns/[id]/run — send the next
 * batch of a drip campaign right now (doesn't wait for the daily cron).
 * Admin-only.
 */

import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { isPrismaConnectionError } from "@/lib/db/database";
import { getCampaign, runCampaignBatch } from "@/lib/marketing/campaigns";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-marketing-run", 10, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const result = await runCampaignBatch(id, { force: true });
    if (result.skipped) {
      return apiError("RUN_SKIPPED", result.skipped, 400);
    }

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "marketing.campaign.batch_sent",
      after: {
        campaignId: id,
        attempted: result.attempted,
        sent: result.sent,
        failed: result.failed,
        completed: result.completed,
      },
      request,
    });

    const campaign = await getCampaign(id);
    return apiSuccess({ result, campaign });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/marketing/campaigns/[id]/run]", err);
    return apiError("INTERNAL", "Failed to send batch.", 500);
  }
}
