/**
 * Outbound customer email (admin-composed outreach / announcements).
 *
 * The admin picks recipients from the customer directory and writes a plain
 * subject + message; this wraps the message in the IQON branded shell and sends
 * one personalized email per recipient via the Resend Batch API (up to 100 per
 * request). Sends via Resend when RESEND_API_KEY is set; otherwise logs.
 * Server-only.
 *
 * Env:
 *   RESEND_API_KEY     — enables live sending
 *   STORE_EMAIL_FROM   — preferred From (e.g. "IQON <info@iqonsupplements.com>")
 *   EMAIL_FROM / AFFILIATE_EMAIL_FROM — fallbacks
 */

import { Resend } from "resend";

const BRAND_COLOR = "#20282c";
const BG_COLOR = "#fafbfb";
const TEXT_COLOR = "#20282c";
const MUTED = "#64717a";

export interface OutreachRecipient {
  email: string;
  firstName?: string;
}

export interface BatchSendResult {
  sent: number;
  failed: number;
  total: number;
  mode: "resend" | "logged";
  error?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turn a plain-text message into HTML paragraphs, preserving line breaks. */
function messageToHtml(message: string): string {
  const blocks = message
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
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
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_COLOR};">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${opts.previewText}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_COLOR};padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(30,30,30,0.08);">
          <tr><td style="background:${BRAND_COLOR};padding:28px 32px;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.01em;">IQON</td></tr>
          <tr><td style="padding:36px 32px 32px 32px;">${opts.body}</td></tr>
          <tr><td style="padding:20px 32px 28px 32px;border-top:1px solid rgba(30,30,30,0.08);font-size:12px;color:${MUTED};line-height:1.6;">IQON Supplements · You're receiving this because you're a valued IQON customer.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function buildEmail(
  recipient: OutreachRecipient,
  subject: string,
  message: string
): { html: string; text: string } {
  const first = recipient.firstName?.trim();
  const greeting = first ? `Hi ${escapeHtml(first)},` : "Hi,";
  const greetingText = first ? `Hi ${first},` : "Hi,";

  const html = shell({
    previewText: subject,
    body: `
<p style="margin:0 0 18px 0;font-size:16px;font-weight:600;color:${TEXT_COLOR};">${greeting}</p>
${messageToHtml(message)}
<p style="margin:24px 0 0 0;color:${MUTED};font-size:14px;line-height:1.6;">— The IQON Team</p>
`,
  });

  const text = `${greetingText}\n\n${message.trim()}\n\n— The IQON Team`;
  return { html, text };
}

function resolveFrom(): string {
  return (
    process.env.SUPPLEMENTS_STORE_EMAIL_FROM?.trim() ||
    process.env.SUPPLEMENTS_EMAIL_FROM?.trim() ||
    process.env.SUPPLEMENTS_AFFILIATE_EMAIL_FROM?.trim() ||
    "IQON <onboarding@resend.dev>"
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send a personalized outreach email to each recipient. Uses Resend's Batch
 * API in chunks of 100. When RESEND_API_KEY is missing, logs and reports the
 * emails as "sent" in logged mode so preview/dev flows aren't blocked.
 */
export async function sendCustomerOutreachEmails(
  recipients: OutreachRecipient[],
  subject: string,
  message: string
): Promise<BatchSendResult> {
  const clean = recipients.filter((r) => r.email && r.email.includes("@"));
  const total = clean.length;

  const apiKey = process.env.SUPPLEMENTS_RESEND_API_KEY?.trim();
  if (!apiKey) return {sent:0,failed:total,total,mode:"logged",error:"Email delivery is not configured."};

  const from = resolveFrom();
  const resend = new Resend(apiKey);

  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const group of chunk(clean, 100)) {
    const payload = group.map((r) => {
      const { html, text } = buildEmail(r, subject, message);
      return { from, to: r.email, subject, html, text };
    });
    try {
      const result = await resend.batch.send(payload);
      if (result.error) {
        failed += group.length;
        firstError = firstError ?? result.error.message;
        console.error("[customer-mailer] batch error", result.error);
      } else {
        sent += group.length;
      }
    } catch (err) {
      failed += group.length;
      firstError =
        firstError ?? (err instanceof Error ? err.message : "Unknown error");
      console.error("[customer-mailer] batch send failed", err);
    }
  }

  return { sent, failed, total, mode: "resend", error: firstError };
}
