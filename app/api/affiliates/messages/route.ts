import {
  createAffiliateMessage,
  getAdminNotifyEmails,
  listMessagesForAffiliate,
  markThreadReadByAffiliate,
} from "@/lib/affiliates/messages-store";
import {
  isNextResponse,
  requireAffiliateBadgeSession,
  requireAffiliateOnlySession,
} from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { sendAffiliateMessageToAdminEmail } from "@/lib/affiliates/mailer";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 4000;

export async function GET() {
  try {
    // Polled frequently while the chat is open — authorize from the snapshot
    // cookie (no DB lookup for the session).
    const auth = await requireAffiliateBadgeSession();
    if (isNextResponse(auth)) return auth;

    const affiliateId = auth.profileId;
    const messages = await listMessagesForAffiliate(affiliateId);

    // Clear unread admin messages only when there are actually some — most polls
    // have nothing to mark and skip this write entirely.
    if (messages.some((m) => m.senderRole === "admin" && !m.readByAffiliate)) {
      await markThreadReadByAffiliate(affiliateId);
    }

    return apiSuccess({ messages });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/messages GET]", err);
    return apiError("INTERNAL", "Failed to load messages.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAffiliateOnlySession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliate-message-send", 20, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many messages. Try again shortly.", 429);

    const json = (await request.json().catch(() => ({}))) as { body?: string };
    const body = (json.body ?? "").trim();
    if (!body) return apiError("INVALID_BODY", "Message cannot be empty.", 400);
    if (body.length > MAX_BODY_LENGTH) {
      return apiError("INVALID_BODY", "Message is too long.", 400);
    }

    const affiliate = session.profile!;
    const message = await createAffiliateMessage({
      affiliateId: affiliate.id,
      senderRole: "affiliate",
      body,
    });

    // Notify the admin team (best effort — never block the send on email).
    void notifyAdmins({
      affiliateName: `${affiliate.firstName} ${affiliate.lastName}`.trim(),
      affiliateEmail: affiliate.email,
      preview: body,
    });

    return apiSuccess({ message });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/messages POST]", err);
    return apiError("INTERNAL", "Failed to send message.", 500);
  }
}

async function notifyAdmins(input: {
  affiliateName: string;
  affiliateEmail: string;
  preview: string;
}) {
  try {
    const recipients = await getAdminNotifyEmails();
    await Promise.all(
      recipients.map((to) =>
        sendAffiliateMessageToAdminEmail({
          to,
          affiliateName: input.affiliateName,
          affiliateEmail: input.affiliateEmail,
          preview: input.preview,
        })
      )
    );
  } catch (err) {
    console.error("[api/affiliates/messages notifyAdmins]", err);
  }
}
