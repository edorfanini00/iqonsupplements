import { getContactMessage, markContactMessageReplied } from "@/lib/contact/store";
import {
  sendContactReplyEmail,
  type ReplyAttachment,
} from "@/lib/contact/reply-mailer";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";
import { writeAuditLog } from "@/lib/affiliates/audit";

export const runtime = "nodejs";

const SUBJECT_LABELS: Record<string, string> = {
  order: "Order inquiry",
  coa: "COA request",
  general: "General inquiry",
  other: "Other",
};

function subjectLabel(subject: string | null): string {
  if (!subject) return "your message";
  return SUBJECT_LABELS[subject] ?? subject;
}

// Vercel caps request bodies at ~4.5MB, so keep total decoded attachment size
// comfortably under that (base64 inflates by ~33%).
const MAX_REPLY_CHARS = 10_000;
const MAX_ATTACHMENTS = 5;
const MAX_TOTAL_ATTACHMENT_BYTES = 3 * 1024 * 1024;

function parseAttachments(
  raw: unknown
): { ok: true; attachments: ReplyAttachment[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Invalid attachments." };
  if (raw.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `Up to ${MAX_ATTACHMENTS} attachments per reply.` };
  }

  const attachments: ReplyAttachment[] = [];
  let totalBytes = 0;
  for (const entry of raw) {
    const filename =
      typeof entry?.filename === "string" ? entry.filename.trim().slice(0, 200) : "";
    const content = typeof entry?.content === "string" ? entry.content : "";
    const contentType =
      typeof entry?.contentType === "string" ? entry.contentType.slice(0, 100) : undefined;
    if (!filename || !content) {
      return { ok: false, error: "Each attachment needs a filename and content." };
    }
    // Base64 length → decoded bytes (approx, ignoring padding).
    totalBytes += Math.floor((content.length * 3) / 4);
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return { ok: false, error: "Attachments are too large (3MB total max)." };
    }
    attachments.push({ filename, content, contentType });
  }
  return { ok: true, attachments };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    // Tighter limit than generic mutations: replies send real emails.
    const rate = await enforceRateLimit(request, "affiliates-admin-reply", 20, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      /** Preferred field name. */
      message?: unknown;
      /** Legacy field name used by the admin inbox UI. */
      reply?: unknown;
      subject?: unknown;
      attachments?: unknown;
    };
    const rawReply = typeof body.message === "string" ? body.message : body.reply;
    const reply = typeof rawReply === "string" ? rawReply.trim() : "";

    if (!reply) {
      return apiError("EMPTY_REPLY", "Reply message cannot be empty.", 400);
    }
    if (reply.length > MAX_REPLY_CHARS) {
      return apiError(
        "REPLY_TOO_LONG",
        `Reply is too long (${MAX_REPLY_CHARS} char max).`,
        400
      );
    }
    const customSubject =
      typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";

    const parsed = parseAttachments(body.attachments);
    if (!parsed.ok) {
      return apiError("INVALID_ATTACHMENTS", parsed.error, 400);
    }

    const message = await getContactMessage(id);
    if (!message) return apiError("NOT_FOUND", "Message not found.", 404);
    if (!message.email || !message.email.includes("@")) {
      return apiError("NO_RECIPIENT", "This message has no valid email to reply to.", 400);
    }

    const result = await sendContactReplyEmail({
      to: message.email,
      customerName: message.name,
      subject: customSubject || `Re: ${subjectLabel(message.subject)} — IQON`,
      reply,
      originalMessage: message.message,
      attachments: parsed.attachments,
    });

    if (!result.ok) {
      return apiError("SEND_FAILED", result.error || "Could not send the reply.", 502);
    }

    // Replying counts as handling the message.
    const updated = await markContactMessageReplied(id);

    await writeAuditLog({
      actorPortalUserId: session.portalUserId,
      actorEmail: session.email,
      action: "contact_message.reply",
      before: { id, status: message.status },
      after: {
        id,
        status: updated?.status ?? message.status,
        to: message.email,
        mode: result.mode,
        emailId: result.id ?? null,
        attachments: parsed.attachments.length,
      },
      request,
    });

    return apiSuccess({ id, sent: true, mode: result.mode, message: updated });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/messages/:id/reply POST]", err);
    return apiError("INTERNAL", "Failed to send reply.", 500);
  }
}
