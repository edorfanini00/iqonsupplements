/**
 * GET  /api/affiliates/admin/marketing/campaigns — list drip campaigns with
 *      progress counts.
 * POST /api/affiliates/admin/marketing/campaigns — create a campaign.
 *      Body: { subject, message, dailyLimit, recipients: { email, firstName? }[] }
 *
 * Recipients are queued immediately; the daily cron sends `dailyLimit` per day
 * until the queue is empty. Admin-only.
 */

import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { isPrismaConnectionError } from "@/lib/db/database";
import { createCampaign, listCampaigns } from "@/lib/marketing/campaigns";

export const runtime = "nodejs";

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 20000;
const MAX_RECIPIENTS = 5000;
const MAX_DAILY_LIMIT = 500;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const campaigns = await listCampaigns();
    return apiSuccess({ campaigns });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/marketing/campaigns GET]", err);
    return apiError("INTERNAL", "Failed to load campaigns.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-marketing-campaign", 10, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as {
      subject?: string;
      message?: string;
      dailyLimit?: number;
      recipients?: Array<{ email?: string; firstName?: string }>;
    };

    const subject = (body.subject ?? "").trim();
    const message = (body.message ?? "").trim();
    if (!subject) return apiError("INVALID_BODY", "Subject is required.", 400);
    if (subject.length > MAX_SUBJECT) {
      return apiError("INVALID_BODY", "Subject is too long.", 400);
    }
    if (!message) return apiError("INVALID_BODY", "Message is required.", 400);
    if (message.length > MAX_MESSAGE) {
      return apiError("INVALID_BODY", "Message is too long.", 400);
    }

    const dailyLimitRaw = Number(body.dailyLimit ?? 25);
    if (!Number.isFinite(dailyLimitRaw) || dailyLimitRaw < 1 || dailyLimitRaw > MAX_DAILY_LIMIT) {
      return apiError("INVALID_BODY", `Per-day batch must be 1–${MAX_DAILY_LIMIT}.`, 400);
    }

    const recipients = (body.recipients ?? [])
      .map((r) => ({
        email: (r.email ?? "").trim().toLowerCase(),
        firstName: (r.firstName ?? "").trim() || undefined,
      }))
      .filter((r) => r.email.includes("@"));
    if (recipients.length === 0) {
      return apiError("INVALID_BODY", "Select at least one recipient.", 400);
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return apiError("INVALID_BODY", `Too many recipients (max ${MAX_RECIPIENTS}).`, 400);
    }

    const campaign = await createCampaign({
      subject,
      message,
      dailyLimit: Math.floor(dailyLimitRaw),
      recipients,
    });

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "marketing.campaign.created",
      after: {
        campaignId: campaign.id,
        subject: campaign.subject,
        dailyLimit: campaign.dailyLimit,
        recipients: campaign.total,
      },
      request,
    });

    return apiSuccess({ campaign });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/marketing/campaigns POST]", err);
    return apiError("INTERNAL", "Failed to create campaign.", 500);
  }
}
