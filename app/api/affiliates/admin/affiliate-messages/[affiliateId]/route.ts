import {
  createAffiliateMessage,
  listMessagesForAffiliate,
  markThreadReadByAdmin,
} from "@/lib/affiliates/messages-store";
import { getAffiliateById } from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAdminBadgeSession,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { sendAdminMessageToAffiliateEmail } from "@/lib/affiliates/mailer";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 4000;

export async function GET(
  request: Request,
  context: { params: Promise<{ affiliateId: string }> }
) {
  try {
    // Polled frequently while a conversation is open — authorize from the
    // snapshot cookie (no DB lookup for the session).
    const auth = await requireAdminBadgeSession();
    if (isNextResponse(auth)) return auth;

    const { affiliateId } = await context.params;
    // The affiliate header (name/email) only changes between opens, so it's
    // fetched once via ?meta=1 on first load — polls skip it.
    const withMeta = new URL(request.url).searchParams.get("meta") === "1";

    const messages = await listMessagesForAffiliate(affiliateId);

    // Only write when there's actually something to mark read (most polls skip
    // this, saving an operation).
    if (messages.some((m) => m.senderRole === "affiliate" && !m.readByAdmin)) {
      await markThreadReadByAdmin(affiliateId);
    }

    if (!withMeta) {
      return apiSuccess({ messages });
    }

    const affiliate = await getAffiliateById(affiliateId);
    if (!affiliate) return apiError("NOT_FOUND", "Affiliate not found.", 404);

    return apiSuccess({
      messages,
      affiliate: {
        id: affiliate.id,
        name: `${affiliate.firstName} ${affiliate.lastName}`.trim(),
        email: affiliate.email,
        promoCode: affiliate.promoCode,
      },
    });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/affiliate-messages/:id GET]", err);
    return apiError("INTERNAL", "Failed to load conversation.", 500);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ affiliateId: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-message-send", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { affiliateId } = await context.params;
    const affiliate = await getAffiliateById(affiliateId);
    if (!affiliate) return apiError("NOT_FOUND", "Affiliate not found.", 404);

    const json = (await request.json().catch(() => ({}))) as { body?: string };
    const body = (json.body ?? "").trim();
    if (!body) return apiError("INVALID_BODY", "Message cannot be empty.", 400);
    if (body.length > MAX_BODY_LENGTH) {
      return apiError("INVALID_BODY", "Message is too long.", 400);
    }

    const message = await createAffiliateMessage({
      affiliateId,
      senderRole: "admin",
      body,
    });

    // Await so the email flushes before the serverless function suspends; a
    // fire-and-forget send gets dropped on Vercel after the response is sent.
    await sendAdminMessageToAffiliateEmail({
      firstName: affiliate.firstName,
      email: affiliate.email,
      preview: body,
    }).catch((err) =>
      console.error("[api/affiliates/admin/affiliate-messages notify]", err)
    );

    return apiSuccess({ message });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/affiliate-messages/:id POST]", err);
    return apiError("INTERNAL", "Failed to send message.", 500);
  }
}
