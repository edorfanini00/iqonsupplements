/**
 * POST /api/affiliates/admin/customers/email — send an admin-composed email to
 * a hand-picked set of customers. Each recipient gets a personalized copy (no
 * shared To/BCC), sent via the Resend Batch API. Admin-only.
 *
 * Body: { subject: string, message: string, recipients: { email, firstName? }[] }
 */

import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import {
  sendCustomerOutreachEmails,
  type OutreachRecipient,
} from "@/lib/customers/mailer";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 20000;
const MAX_RECIPIENTS = 2000;

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(
      request,
      "admin-customer-email",
      10,
      60_000
    );
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const json = (await request.json().catch(() => ({}))) as {
      subject?: string;
      message?: string;
      recipients?: Array<{ email?: string; firstName?: string }>;
    };

    const subject = (json.subject ?? "").trim();
    const message = (json.message ?? "").trim();
    if (!subject) return apiError("INVALID_BODY", "Subject is required.", 400);
    if (subject.length > MAX_SUBJECT) {
      return apiError("INVALID_BODY", "Subject is too long.", 400);
    }
    if (!message) return apiError("INVALID_BODY", "Message is required.", 400);
    if (message.length > MAX_MESSAGE) {
      return apiError("INVALID_BODY", "Message is too long.", 400);
    }

    const seen = new Set<string>();
    const recipients: OutreachRecipient[] = [];
    for (const r of json.recipients ?? []) {
      const email = (r.email ?? "").trim().toLowerCase();
      if (!email || !email.includes("@") || seen.has(email)) continue;
      seen.add(email);
      recipients.push({ email, firstName: (r.firstName ?? "").trim() });
    }

    if (recipients.length === 0) {
      return apiError("INVALID_BODY", "Select at least one recipient.", 400);
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return apiError(
        "INVALID_BODY",
        `Too many recipients (max ${MAX_RECIPIENTS}).`,
        400
      );
    }

    const result = await sendCustomerOutreachEmails(
      recipients,
      subject,
      message
    );

    return apiSuccess({
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      mode: result.mode,
      error: result.error,
    });
  } catch (err) {
    console.error("[api/affiliates/admin/customers/email]", err);
    return apiError("INTERNAL_ERROR", "Failed to send emails", 500);
  }
}
