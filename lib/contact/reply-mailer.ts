/**
 * Contact-inbox reply email.
 *
 * Sends an admin's reply to a Contact-form submitter via Resend when
 * RESEND_API_KEY is set; otherwise logs the email to the server console so
 * dev/preview flows stay unblocked. Server-only.
 *
 * Env:
 *   RESEND_API_KEY      — enables live sending
 *   EMAIL_FROM          — preferred From (e.g. "IQON <support@iqonsupplements.com>")
 *   AFFILIATE_EMAIL_FROM — fallback From if EMAIL_FROM isn't set
 *   CONTACT_REPLY_TO / EMAIL_REPLY_TO — optional Reply-To so customer replies
 *                          land in a real inbox instead of the From alias
 */

import { Resend } from "resend";

export interface SendResult {
  ok: boolean;
  mode: "resend" | "logged" | "skipped";
  id?: string;
  error?: string;
}

/** File attached to a reply; content is base64 (no data-URL prefix). */
export interface ReplyAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

const BRAND_COLOR = "#242526";
const BG_COLOR = "#fafbfb";
const TEXT_COLOR = "#20282c";
const MUTED = "#64717a";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px 0;color:${TEXT_COLOR};font-size:15px;line-height:1.65;">${escapeHtml(
          block
        ).replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

function shell(opts: { previewText: string; body: string }): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_COLOR};">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${opts.previewText}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_COLOR};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(30,30,30,0.08);">
            <tr>
              <td style="background:${BRAND_COLOR};padding:28px 32px;color:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">IQON</td>
                    <td align="right" style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.55);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Support</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 32px 32px;">
                ${opts.body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid rgba(30,30,30,0.08);font-size:12px;color:${MUTED};line-height:1.6;">
                IQON Supplements · You're receiving this because you contacted us through our website.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: ReplyAttachment[];
}): Promise<SendResult> {
  const apiKey = process.env.SUPPLEMENTS_RESEND_API_KEY?.trim();
  const from =
    process.env.SUPPLEMENTS_EMAIL_FROM?.trim() ||
    process.env.SUPPLEMENTS_AFFILIATE_EMAIL_FROM?.trim() ||
    "IQON <onboarding@resend.dev>";
  const replyTo =
    params.replyTo ||
    process.env.SUPPLEMENTS_CONTACT_REPLY_TO?.trim() ||
    process.env.SUPPLEMENTS_EMAIL_REPLY_TO?.trim() ||
    undefined;

  if (!params.to || !params.to.includes("@")) {
    return { ok: false, mode: "skipped", error: "Missing recipient" };
  }

  if (!apiKey || (!process.env.SUPPLEMENTS_EMAIL_FROM && !process.env.SUPPLEMENTS_AFFILIATE_EMAIL_FROM)) {
    return {ok:false,mode:"skipped",error:"Email delivery is not configured."};
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(replyTo ? { replyTo } : {}),
      ...(params.attachments?.length
        ? {
            attachments: params.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.contentType ? { contentType: a.contentType } : {}),
            })),
          }
        : {}),
    });
    if (result.error) {
      console.error("[contact-reply-mailer] Resend error", result.error);
      return { ok: false, mode: "resend", error: result.error.message };
    }
    return { ok: true, mode: "resend", id: result.data?.id };
  } catch (err) {
    console.error("[contact-reply-mailer] send failed", err);
    return {
      ok: false,
      mode: "resend",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export interface ContactReplyInput {
  to: string;
  customerName?: string | null;
  subject: string;
  reply: string;
  originalMessage?: string | null;
  replyTo?: string;
  attachments?: ReplyAttachment[];
}

/**
 * Build the exact subject/html/text used for a contact reply email without
 * sending it. Exported so previews and tests can render the real template.
 */
export function renderContactReplyEmail(input: ContactReplyInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greetingName = (input.customerName ?? "").trim().split(/\s+/)[0] || "there";

  const quoted = input.originalMessage?.trim()
    ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
  <tr>
    <td style="border-left:3px solid rgba(30,30,30,0.12);padding:4px 0 4px 16px;">
      <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Your original message</p>
      <p style="margin:0;color:${MUTED};font-size:13px;line-height:1.6;">${escapeHtml(
        input.originalMessage.trim()
      ).replace(/\n/g, "<br />")}</p>
    </td>
  </tr>
</table>`
    : "";

  const html = shell({
    previewText: input.reply.slice(0, 120),
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">A reply from IQON</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${escapeHtml(
      greetingName
    )},</h1>
${paragraphs(input.reply)}
${quoted}
`,
  });

  const text = `Hi ${greetingName},

${input.reply}
${
  input.originalMessage?.trim()
    ? `\n----- Your original message -----\n${input.originalMessage.trim()}\n`
    : ""
}
— IQON`;

  return { subject: input.subject, html, text };
}

export async function sendContactReplyEmail(
  input: ContactReplyInput
): Promise<SendResult> {
  const { subject, html, text } = renderContactReplyEmail(input);
  return send({
    to: input.to,
    subject,
    html,
    text,
    replyTo: input.replyTo,
    attachments: input.attachments,
  });
}
