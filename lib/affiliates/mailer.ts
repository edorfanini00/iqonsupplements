/**
 * Affiliate transactional email.
 *
 * Email is delivered only when the supplements API key and verified sender are configured.
 *
 * Required env vars for live sending:
 *   RESEND_API_KEY
 *   AFFILIATE_EMAIL_FROM   (e.g. "IQON Affiliates <affiliates@iqonsupplements.com>")
 *   AFFILIATE_PORTAL_URL   (optional — defaults to NEXT_PUBLIC_SITE_URL/affiliates/login)
 */

import { Resend } from "resend";

export interface SendResult {
  ok: boolean;
  mode: "resend" | "logged" | "skipped";
  id?: string;
  error?: string;
}

function getSiteUrl(): string {
  const explicit =
    process.env.SUPPLEMENTS_SITE_URL;
  if (explicit && explicit.trim() && !/localhost/.test(explicit)) {
    return explicit.trim().replace(/\/$/, "");
  }
  // Vercel provides the stable production domain at runtime.
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel && vercel.trim()) {
    return `https://${vercel
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")}`;
  }
  return (explicit ?? "http://localhost:3000").trim().replace(/\/$/, "");
}

function getPortalUrl(): string {
  const explicit = process.env.SUPPLEMENTS_AFFILIATE_PORTAL_URL?.trim();
  if (explicit) return explicit;
  return `${getSiteUrl()}/affiliates/login`;
}

export function getInviteUrl(refValue: string): string {
  return `${getSiteUrl()}/affiliates?ref=${encodeURIComponent(refValue)}`;
}

export function getPasswordResetUrl(token: string): string {
  return `${getSiteUrl()}/affiliates/reset-password?token=${encodeURIComponent(token)}`;
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.SUPPLEMENTS_RESEND_API_KEY?.trim();
  const from =
    process.env.SUPPLEMENTS_AFFILIATE_EMAIL_FROM?.trim() ||
    "IQON Affiliates <onboarding@resend.dev>";

  if (!params.to || !params.to.includes("@")) {
    return { ok: false, mode: "skipped", error: "Missing recipient" };
  }

  if (!apiKey || !process.env.SUPPLEMENTS_AFFILIATE_EMAIL_FROM?.trim()) {
    return { ok: false, mode: "skipped", error: "Email delivery is not configured." };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (result.error) {
      console.error("[affiliate-mailer] Resend error", result.error);
      return { ok: false, mode: "resend", error: result.error.message };
    }
    return { ok: true, mode: "resend", id: result.data?.id };
  } catch (err) {
    console.error("[affiliate-mailer] send failed", err);
    return {
      ok: false,
      mode: "resend",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

interface BaseRecipient {
  firstName: string;
  email: string;
  promoCode: string;
}

interface MinimalRecipient {
  firstName: string;
  email: string;
}

const BRAND_COLOR = "#242526";
const BG_COLOR = "#fafbfb";
const TEXT_COLOR = "#20282c";
const MUTED = "#64717a";

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
                    <td align="right" style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.55);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Affiliates</td>
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
                IQON Supplements · This is an automated message from the affiliate program.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
  <tr>
    <td style="border-radius:999px;background:${BRAND_COLOR};">
      <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${label}</a>
    </td>
  </tr>
</table>`;
}

function codeBlock(code: string): string {
  return `<div style="background:${BRAND_COLOR};color:#ffffff;border-radius:16px;padding:20px 24px;margin:18px 0;text-align:center;">
  <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.55);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:8px;">Your promo code</div>
  <div style="font-size:28px;font-weight:600;letter-spacing:0.06em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${code}</div>
</div>`;
}

// --- Public templates ---

export async function sendApprovalEmail(
  recipient: BaseRecipient & {
    commissionRate: number;
    couponRate: number;
    referrerName?: string;
    /** Set only when we had to generate a password for them at approval. */
    temporaryPassword?: string;
  }
): Promise<SendResult> {
  const portalUrl = getPortalUrl();
  const subject = "You're in — your IQON affiliate account is approved";
  const referrerLine = recipient.referrerName
    ? `<p style="margin:0 0 16px 0;color:${MUTED};font-size:14px;line-height:1.6;">You were referred by <strong style="color:${TEXT_COLOR};">${recipient.referrerName}</strong>. Thanks for joining their network!</p>`
    : "";
  const credentialsBlock = recipient.temporaryPassword
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px 0;border:1px solid rgba(30,30,30,0.08);border-radius:14px;background:rgba(30,30,30,0.03);">
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};">
      <strong style="color:${TEXT_COLOR};">Login email</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.email}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);">
      <strong style="color:${TEXT_COLOR};">Temporary password</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.temporaryPassword}</span>
    </td>
  </tr>
</table>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:13px;line-height:1.65;">
  Please sign in and change your password from your account once you're inside.
</p>`
    : "";
  const html = shell({
    previewText: "Your IQON affiliate application has been approved.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Welcome aboard</p>
<h1 style="margin:0 0 18px 0;font-size:28px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName}, you're approved.</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  Your IQON affiliate account is now live. You can start sharing your promo
  code immediately and we'll attribute every sale to you.
</p>
${codeBlock(recipient.promoCode)}
${credentialsBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px 0;border:1px solid rgba(30,30,30,0.08);border-radius:14px;">
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};">
      <strong style="color:${TEXT_COLOR};">Commission</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.commissionRate}%</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);">
      <strong style="color:${TEXT_COLOR};">Customer discount</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.couponRate}%</span>
    </td>
  </tr>
</table>
${referrerLine}
<p style="margin:0 0 8px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  Sign in to see your dashboard, track orders, and add your payout details.
</p>
${ctaButton(portalUrl, "Sign in to your dashboard")}
<p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6;">Use the email and password you signed up with.</p>
`,
  });

  const text = `Hi ${recipient.firstName},

Your IQON affiliate application has been approved.

Promo code: ${recipient.promoCode}
Commission: ${recipient.commissionRate}%
Customer discount: ${recipient.couponRate}%
${recipient.referrerName ? `Referred by: ${recipient.referrerName}\n` : ""}${
    recipient.temporaryPassword
      ? `\nLogin email: ${recipient.email}\nTemporary password: ${recipient.temporaryPassword}\n(Please change it after first sign-in.)\n`
      : ""
  }
Sign in: ${portalUrl}

— IQON Affiliates`;

  return send({ to: recipient.email, subject, html, text });
}

export async function sendAffiliateRejectionEmail(
  recipient: { firstName: string; email: string }
): Promise<SendResult> {
  const subject = "Update on your IQON affiliate application";
  const html = shell({
    previewText: "An update on your IQON affiliate application.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Application update</p>
<h1 style="margin:0 0 18px 0;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName},</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  Thanks for applying to the IQON affiliate program. After reviewing your
  application we're not able to move forward at this time.
</p>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  We appreciate your interest and wish you the best.
</p>
`,
  });
  const text = `Hi ${recipient.firstName},

Thanks for applying to the IQON affiliate program. After reviewing your application we're not able to move forward at this time.

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

export async function sendWelcomeEmail(
  recipient: BaseRecipient & {
    commissionRate: number;
    couponRate: number;
    /** When admin creates the account directly we share the temporary password. */
    temporaryPassword?: string;
    referrerName?: string;
  }
): Promise<SendResult> {
  const portalUrl = getPortalUrl();
  const subject = "Welcome to IQON Affiliates";
  const credentialsBlock = recipient.temporaryPassword
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px 0;border:1px solid rgba(30,30,30,0.08);border-radius:14px;background:rgba(30,30,30,0.03);">
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};">
      <strong style="color:${TEXT_COLOR};">Email</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.email}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);">
      <strong style="color:${TEXT_COLOR};">Temporary password</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.temporaryPassword}</span>
    </td>
  </tr>
</table>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:13px;line-height:1.65;">
  Please sign in and change your password from your account once you're inside.
</p>`
    : "";
  const referrerLine = recipient.referrerName
    ? `<p style="margin:0 0 16px 0;color:${MUTED};font-size:14px;line-height:1.6;">You were referred by <strong style="color:${TEXT_COLOR};">${recipient.referrerName}</strong>.</p>`
    : "";
  const html = shell({
    previewText: "Your IQON affiliate account is ready.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Welcome</p>
<h1 style="margin:0 0 18px 0;font-size:28px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName}, your account is ready.</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  We've created your IQON affiliate account. Below is your unique promo code —
  share it and we'll attribute every sale to you.
</p>
${codeBlock(recipient.promoCode)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px 0;border:1px solid rgba(30,30,30,0.08);border-radius:14px;">
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};">
      <strong style="color:${TEXT_COLOR};">Commission</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.commissionRate}%</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);">
      <strong style="color:${TEXT_COLOR};">Customer discount</strong>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.couponRate}%</span>
    </td>
  </tr>
</table>
${referrerLine}
${credentialsBlock}
${ctaButton(portalUrl, "Sign in to your dashboard")}
`,
  });
  const text = `Hi ${recipient.firstName},

Your IQON affiliate account is ready.

Promo code: ${recipient.promoCode}
Commission: ${recipient.commissionRate}%
Customer discount: ${recipient.couponRate}%
${recipient.referrerName ? `Referred by: ${recipient.referrerName}\n` : ""}${
    recipient.temporaryPassword
      ? `\nLogin email: ${recipient.email}\nTemporary password: ${recipient.temporaryPassword}\n(Please change it after first sign-in.)\n`
      : ""
  }
Sign in: ${portalUrl}

— IQON Affiliates`;

  return send({ to: recipient.email, subject, html, text });
}

// --- Signup confirmation ---

export async function sendSignupConfirmationEmail(
  recipient: BaseRecipient & { inviteUrl?: string }
): Promise<SendResult> {
  const subject = "We received your IQON affiliate application";
  const html = shell({
    previewText: "Your application is in review.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Application received</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName}, thanks for applying.</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  Our team is reviewing your application. We typically respond within
  1-2 business days. You'll get an email the moment we approve you and
  your account goes live.
</p>
${codeBlock(recipient.promoCode)}
<p style="margin:0;color:${MUTED};font-size:13px;line-height:1.65;">
  Note: your code is provisional until your account is approved.
</p>
${recipient.inviteUrl ? ctaButton(recipient.inviteUrl, "Your recruitment link") + `<p>Share this link even while your application is pending. Each applicant still needs approval.</p>` : ""}
`,
  });
  const text = `Hi ${recipient.firstName},

Thanks for applying to the IQON affiliate program. Our team will review your application and email you once approved (usually within 1-2 business days).

Provisional promo code: ${recipient.promoCode}
${recipient.inviteUrl ? `Your recruitment link: ${recipient.inviteUrl}\nEach applicant still needs approval.` : ""}

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

// --- Password changed confirmation ---

export async function sendPasswordChangedEmail(
  recipient: MinimalRecipient
): Promise<SendResult> {
  const resetUrl = `${getSiteUrl()}/affiliates/forgot-password`;
  const subject = "Your IQON affiliate password was changed";
  const html = shell({
    previewText: "Your IQON affiliate password was changed.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Security update</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName || "there"},</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  This is a confirmation that the password for your IQON affiliate account was
  just changed. You can keep using the portal as normal with your new password.
</p>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  If you did not make this change, reset your password immediately and contact
  our team.
</p>
${ctaButton(resetUrl, "Reset my password")}
`,
  });
  const text = `Hi ${recipient.firstName || "there"},

This is a confirmation that the password for your IQON affiliate account was just changed.

If you did not make this change, reset your password immediately: ${resetUrl}

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

// --- Diagnostics ---

/**
 * Send a simple test email and report exactly what happened. Used by the admin
 * panel to verify Resend is configured and a domain is verified.
 */
export async function sendTestEmail(
  to: string
): Promise<SendResult & { from: string; apiKeyConfigured: boolean }> {
  const apiKeyConfigured = Boolean(process.env.SUPPLEMENTS_RESEND_API_KEY?.trim());
  const from =
    process.env.SUPPLEMENTS_AFFILIATE_EMAIL_FROM?.trim() ||
    "IQON Affiliates <onboarding@resend.dev>";
  const html = shell({
    previewText: "IQON affiliate email test.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Delivery test</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">It works.</h1>
<p style="margin:0;color:${MUTED};font-size:15px;line-height:1.65;">
  If you're reading this, your IQON affiliate emails (approvals, payouts,
  password resets) are delivering correctly.
</p>
`,
  });
  const result = await send({
    to,
    subject: "IQON affiliate email test",
    html,
    text: "If you're reading this, IQON affiliate email delivery is working.",
  });
  return { ...result, from, apiKeyConfigured };
}

// --- Password reset ---

export async function sendPasswordResetEmail(
  recipient: MinimalRecipient & { resetUrl: string; expiresMinutes: number }
): Promise<SendResult> {
  const subject = "Reset your IQON affiliate password";
  const html = shell({
    previewText: "Reset your IQON affiliate password.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Password reset</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName || "there"},</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  We received a request to reset the password for your IQON affiliate account.
  Click the button below to choose a new password. This link expires in
  ${recipient.expiresMinutes} minutes.
</p>
${ctaButton(recipient.resetUrl, "Reset my password")}
<p style="margin:0 0 16px 0;color:${MUTED};font-size:12px;line-height:1.6;">
  Or paste this link into your browser:<br />
  <a href="${recipient.resetUrl}" style="color:${TEXT_COLOR};">${recipient.resetUrl}</a>
</p>
<p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6;">
  If you didn't request this, you can safely ignore this email — your password
  won't change.
</p>
`,
  });
  const text = `Hi ${recipient.firstName || "there"},

We received a request to reset the password for your IQON affiliate account.
Use the link below to choose a new password. It expires in ${recipient.expiresMinutes} minutes.

${recipient.resetUrl}

If you didn't request this, you can safely ignore this email.

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

// --- Payout email ---

export async function sendPayoutEmail(
  recipient: MinimalRecipient & {
    amount: number;
    method: "bank" | "paypal" | "zelle" | "other";
    reference?: string;
    paidAt: string;
    orderCount: number;
  }
): Promise<SendResult> {
  const portalUrl = getPortalUrl();
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(recipient.amount);
  const date = new Date(recipient.paidAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const methodLabel: Record<typeof recipient.method, string> = {
    bank: "Bank transfer",
    paypal: "PayPal",
    zelle: "Zelle",
    other: "Other",
  };
  const subject = `Your payout of ${formatted} is on its way`;
  const html = shell({
    previewText: `${formatted} payout sent.`,
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Payout sent</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${recipient.firstName},</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  We've just settled <strong style="color:${TEXT_COLOR};">${formatted}</strong>
  in commissions to you on ${date}. Thanks for being a part of IQON.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px 0;border:1px solid rgba(30,30,30,0.08);border-radius:14px;">
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};"><strong style="color:${TEXT_COLOR};">Amount</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${formatted}</span></td></tr>
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">Method</strong><span style="float:right;color:${TEXT_COLOR};">${methodLabel[recipient.method]}</span></td></tr>
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">Orders covered</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.orderCount}</span></td></tr>${
    recipient.reference
      ? `<tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">Reference</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${recipient.reference}</span></td></tr>`
      : ""
  }
</table>
${ctaButton(portalUrl + "?ref=payouts", "View payout history")}
`,
  });
  const text = `Hi ${recipient.firstName},

We've sent you ${formatted} on ${date}.

Method: ${methodLabel[recipient.method]}
Orders: ${recipient.orderCount}
${recipient.reference ? `Reference: ${recipient.reference}\n` : ""}
View history: ${portalUrl}

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

// --- New order email ---

export async function sendNewOrderEmail(
  recipient: MinimalRecipient & {
    orderTotal: number;
    commission: number;
    customerName: string;
    matchType: "code" | "recurring" | "referral";
    fromAffiliateName?: string;
    /**
     * Net amount the commission was calculated on (order total minus shipping
     * and taxes). When provided, the email shows the full breakdown so the
     * percentage is transparent.
     */
    commissionBase?: number;
  }
): Promise<SendResult> {
  const portalUrl = getPortalUrl();
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  const matchLabel =
    recipient.matchType === "code"
      ? "via your promo code"
      : recipient.matchType === "recurring"
        ? "from one of your returning customers"
        : `from ${recipient.fromAffiliateName ?? "your network"}`;

  const base =
    typeof recipient.commissionBase === "number" && recipient.commissionBase > 0
      ? recipient.commissionBase
      : null;
  const excluded = base != null ? Math.max(0, recipient.orderTotal - base) : 0;
  const pct =
    base != null
      ? (Math.round((recipient.commission / base) * 1000) / 10).toString().replace(/\.0$/, "")
      : null;
  const commissionLabel = pct != null ? `Your commission (${pct}%)` : "Your commission";

  const breakdownRowsHtml =
    base != null
      ? `
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">Shipping &amp; taxes</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${MUTED};">−${fmt(excluded)}</span></td></tr>
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">Commissionable amount</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${fmt(base)}</span></td></tr>`
      : "";

  const subject = `You earned ${fmt(recipient.commission)} on a new order`;
  const html = shell({
    previewText: `New order from ${recipient.customerName}.`,
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">New commission</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Cha-ching, ${recipient.firstName}.</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  An order just came in ${matchLabel}. Here's the breakdown:
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px 0;border:1px solid rgba(30,30,30,0.08);border-radius:14px;">
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};"><strong style="color:${TEXT_COLOR};">Customer</strong><span style="float:right;color:${TEXT_COLOR};">${recipient.customerName}</span></td></tr>
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">Order total</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${fmt(recipient.orderTotal)}</span></td></tr>${breakdownRowsHtml}
  <tr><td style="padding:14px 18px;font-size:13px;color:${MUTED};border-top:1px solid rgba(30,30,30,0.08);"><strong style="color:${TEXT_COLOR};">${commissionLabel}</strong><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;float:right;color:${TEXT_COLOR};">${fmt(recipient.commission)}</span></td></tr>
</table>
${
  base != null
    ? `<p style="margin:0 0 22px 0;color:${MUTED};font-size:12px;line-height:1.6;">Commissions are calculated on the order total after shipping and taxes.</p>`
    : ""
}
${ctaButton(portalUrl, "View in dashboard")}
`,
  });
  const text = `Hi ${recipient.firstName},

A new order just came in ${matchLabel}.

Customer: ${recipient.customerName}
Order total: ${fmt(recipient.orderTotal)}${
    base != null
      ? `
Shipping & taxes: −${fmt(excluded)}
Commissionable amount: ${fmt(base)}`
      : ""
  }
${commissionLabel}: ${fmt(recipient.commission)}
${base != null ? "\nCommissions are calculated on the order total after shipping and taxes.\n" : ""}
View dashboard: ${portalUrl}

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

// --- Referral accepted (email to referrer) ---

export async function sendReferralAcceptedEmail(
  recipient: { firstName: string; email: string },
  referee: { name: string; promoCode: string },
  referralRate: number
): Promise<SendResult> {
  const portalUrl = getPortalUrl();
  const subject = `${referee.name} just joined your IQON network`;
  const html = shell({
    previewText: `${referee.name} was approved as your referral.`,
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Network update</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">${referee.name} is in.</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  Hi ${recipient.firstName} — your referral
  <strong style="color:${TEXT_COLOR};">${referee.name}</strong>
  (<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${referee.promoCode}</span>)
  was just approved as an IQON affiliate.
</p>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  You'll automatically earn
  <strong style="color:${TEXT_COLOR};">${referralRate}%</strong>
  on every order they bring in. We'll deposit it into your pending balance
  alongside your regular commissions.
</p>
${ctaButton(portalUrl + "?ref=network", "See your network")}
`,
  });
  const text = `Hi ${recipient.firstName},

Your referral ${referee.name} (${referee.promoCode}) was just approved as an IQON affiliate.

You'll automatically earn ${referralRate}% on every order they bring in.

See your network: ${portalUrl}

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

/**
 * Sent when an admin assigns (or reassigns) an existing affiliate into a
 * referrer's network — the referrer now earns the referral cut on that
 * affiliate's sales going forward.
 */
export async function sendReferralAssignedEmail(
  recipient: { firstName: string; email: string },
  referee: { name: string; promoCode: string },
  referralRate: number
): Promise<SendResult> {
  const portalUrl = getPortalUrl();
  const subject = `${referee.name} was added to your IQON network`;
  const html = shell({
    previewText: `${referee.name} is now part of your network.`,
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Network update</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">${referee.name} is now on your team.</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  Hi ${recipient.firstName} —
  <strong style="color:${TEXT_COLOR};">${referee.name}</strong>
  (<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${referee.promoCode}</span>)
  has been added to your network for bringing them over to IQON.
</p>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  From now on you'll automatically earn
  <strong style="color:${TEXT_COLOR};">${referralRate}%</strong>
  on every order they bring in. It lands in your pending balance alongside
  your regular commissions — nothing else to do.
</p>
${ctaButton(portalUrl + "?ref=network", "See your network")}
`,
  });
  const text = `Hi ${recipient.firstName},

${referee.name} (${referee.promoCode}) has been added to your network for bringing them over to IQON.

From now on you'll automatically earn ${referralRate}% on every order they bring in.

See your network: ${portalUrl}

— IQON Affiliates`;
  return send({ to: recipient.email, subject, html, text });
}

// --- Invite a friend ---

export async function sendInviteEmail(input: {
  to: string;
  inviteeFirstName?: string;
  inviterName: string;
  inviterPromoCode: string;
  inviterId?: string;
  personalMessage?: string;
}): Promise<SendResult> {
  const inviteUrl = getInviteUrl(input.inviterId ?? input.inviterPromoCode);
  const subject = `${input.inviterName} invited you to join IQON Affiliates`;
  const greeting = input.inviteeFirstName
    ? `Hi ${input.inviteeFirstName},`
    : "Hello,";
  const personalBlock = input.personalMessage
    ? `<blockquote style="margin:18px 0;padding:14px 18px;background:rgba(30,30,30,0.03);border-left:3px solid rgba(30,30,30,0.18);border-radius:8px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">${escapeHtml(
        input.personalMessage
      )}</blockquote>`
    : "";
  const html = shell({
    previewText: `${input.inviterName} invited you to join IQON Affiliates.`,
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Personal invitation</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">${greeting}</h1>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  <strong style="color:${TEXT_COLOR};">${input.inviterName}</strong> thinks
  you'd be a great fit for the IQON affiliate program — and wants you on
  their team.
</p>
${personalBlock}
<p style="margin:0 0 16px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  As an IQON affiliate you get a unique promo code that gives your audience
  15% off, you earn commission on every sale, and you keep earning recurring
  commission on repeat customers.
</p>
${ctaButton(inviteUrl, "Apply to join")}
<p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6;">
  Or paste this link into your browser:<br />
  <a href="${inviteUrl}" style="color:${TEXT_COLOR};">${inviteUrl}</a>
</p>
`,
  });
  const text = `${greeting}

${input.inviterName} invited you to join the IQON affiliate program.

${input.personalMessage ? `"${input.personalMessage}"\n\n` : ""}Apply here: ${inviteUrl}

— IQON Affiliates`;
  return send({ to: input.to, subject, html, text });
}

// --- Direct affiliate <-> admin messaging notifications ---

/** Notify an admin that an affiliate sent them a new message. */
export async function sendAffiliateMessageToAdminEmail(input: {
  to: string;
  affiliateName: string;
  affiliateEmail: string;
  preview: string;
}): Promise<SendResult> {
  const link = `${getSiteUrl()}/affiliates/admin/affiliate-messages`;
  const subject = `New message from ${input.affiliateName}`;
  const quote = `<blockquote style="margin:18px 0;padding:14px 18px;background:rgba(30,30,30,0.03);border-left:3px solid rgba(30,30,30,0.18);border-radius:8px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
    input.preview
  )}</blockquote>`;
  const html = shell({
    previewText: `New affiliate message from ${input.affiliateName}.`,
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">New message</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">${escapeHtml(
      input.affiliateName
    )} messaged you</h1>
<p style="margin:0 0 4px 0;color:${MUTED};font-size:14px;line-height:1.6;">
  From <strong style="color:${TEXT_COLOR};">${escapeHtml(
    input.affiliateEmail
  )}</strong>
</p>
${quote}
${ctaButton(link, "Open messages")}
`,
  });
  const text = `${input.affiliateName} (${input.affiliateEmail}) sent you a new message:

"${input.preview}"

Open messages: ${link}

— IQON Affiliates`;
  return send({ to: input.to, subject, html, text });
}

/** Notify an affiliate that the admin team sent them a new message. */
export async function sendAdminMessageToAffiliateEmail(input: {
  firstName: string;
  email: string;
  preview: string;
}): Promise<SendResult> {
  const link = `${getSiteUrl()}/affiliates/dashboard/messages`;
  const subject = "New message from the IQON team";
  const quote = `<blockquote style="margin:18px 0;padding:14px 18px;background:rgba(30,30,30,0.03);border-left:3px solid rgba(30,30,30,0.18);border-radius:8px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
    input.preview
  )}</blockquote>`;
  const html = shell({
    previewText: "The IQON team sent you a message.",
    body: `
<p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">New message</p>
<h1 style="margin:0 0 18px 0;font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT_COLOR};">Hi ${escapeHtml(
      input.firstName || "there"
    )},</h1>
<p style="margin:0 0 4px 0;color:${MUTED};font-size:15px;line-height:1.65;">
  The IQON team just sent you a message in your affiliate portal:
</p>
${quote}
${ctaButton(link, "Reply in your dashboard")}
`,
  });
  const text = `Hi ${input.firstName || "there"},

The IQON team just sent you a message:

"${input.preview}"

Reply in your dashboard: ${link}

— IQON Affiliates`;
  return send({ to: input.email, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
