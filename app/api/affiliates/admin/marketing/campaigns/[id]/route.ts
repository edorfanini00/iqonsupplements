/**
 * PATCH  /api/affiliates/admin/marketing/campaigns/[id] — pause or resume a
 *        drip campaign. Body: { status: "active" | "paused" }.
 * DELETE /api/affiliates/admin/marketing/campaigns/[id] — delete the campaign
 *        and its remaining queue (already-sent emails are not affected).
 *
 * Admin-only.
 */

import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { isPrismaConnectionError } from "@/lib/db/database";
import {
  deleteCampaign,
  getCampaign,
  setCampaignStatus,
} from "@/lib/marketing/campaigns";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-marketing-campaign", 30, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = body.status === "paused" ? "paused" : body.status === "active" ? "active" : null;
    if (!status) return apiError("INVALID_BODY", "Status must be active or paused.", 400);

    const ok = await setCampaignStatus(id, status);
    if (!ok) return apiError("NOT_FOUND", "Campaign not found or already completed.", 404);

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "marketing.campaign.status",
      after: { campaignId: id, status },
      request,
    });

    const campaign = await getCampaign(id);
    return apiSuccess({ campaign });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/marketing/campaigns/[id] PATCH]", err);
    return apiError("INTERNAL", "Failed to update campaign.", 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-marketing-campaign", 30, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const ok = await deleteCampaign(id);
    if (!ok) return apiError("NOT_FOUND", "Campaign not found.", 404);

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "marketing.campaign.deleted",
      after: { campaignId: id },
      request,
    });

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/marketing/campaigns/[id] DELETE]", err);
    return apiError("INTERNAL", "Failed to delete campaign.", 500);
  }
}
