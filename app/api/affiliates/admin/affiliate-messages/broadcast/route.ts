import {
  createAdminBroadcastMessages,
  listBroadcastRecipients,
} from "@/lib/affiliates/messages-store";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { sendAdminMessageToAffiliateEmail } from "@/lib/affiliates/mailer";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";
// Email fan-out is throttled, so a large roster can take a while.
export const maxDuration = 60;

const MAX_BODY_LENGTH = 4000;
/** Resend allows ~2 requests/second — send in small paced batches. */
const EMAIL_BATCH_SIZE = 2;
const EMAIL_BATCH_DELAY_MS = 600;

/**
 * Broadcast one message from the admin team to every active affiliate: the
 * message lands in each affiliate's thread and each one gets the usual
 * "new message" email notification.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(
      request,
      "admin-message-broadcast",
      5,
      60_000
    );
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const json = (await request.json().catch(() => ({}))) as { body?: string };
    const body = (json.body ?? "").trim();
    if (!body) return apiError("INVALID_BODY", "Message cannot be empty.", 400);
    if (body.length > MAX_BODY_LENGTH) {
      return apiError("INVALID_BODY", "Message is too long.", 400);
    }

    const recipients = await listBroadcastRecipients();
    if (recipients.length === 0) {
      return apiError("NO_RECIPIENTS", "There are no active affiliates.", 400);
    }

    const created = await createAdminBroadcastMessages(
      recipients.map((r) => r.id),
      body
    );

    // Email everyone in paced batches so we stay under the provider's rate
    // limit. Failures are logged but never undo the in-app messages.
    let emailed = 0;
    for (let i = 0; i < recipients.length; i += EMAIL_BATCH_SIZE) {
      const batch = recipients.slice(i, i + EMAIL_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((r) =>
          sendAdminMessageToAffiliateEmail({
            firstName: r.firstName,
            email: r.email,
            preview: body,
          })
        )
      );
      for (const res of results) {
        if (res.status === "fulfilled") emailed += 1;
        else console.error("[affiliate-messages/broadcast email]", res.reason);
      }
      if (i + EMAIL_BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, EMAIL_BATCH_DELAY_MS));
      }
    }

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "affiliate_message_broadcast",
      after: { recipients: recipients.length, created, emailed },
      request,
    });

    return apiSuccess({ recipients: recipients.length, created, emailed });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/affiliate-messages/broadcast]", err);
    return apiError("INTERNAL", "Failed to send the broadcast.", 500);
  }
}
