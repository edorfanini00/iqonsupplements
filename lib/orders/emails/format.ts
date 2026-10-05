import type { EmailAddress, EmailBrandConfig } from "./types";

export const DEFAULT_ASSET_ORIGIN = "https://www.iqonbody.com";
/** Same support inbox the existing contact reply mailer documents. */
export const DEFAULT_SUPPORT_EMAIL = "support@iqonsupplements.com";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only absolute https URLs may reach an email href/src. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function originFrom(value: string | undefined): string {
  const url = safeHttpsUrl(value);
  return url ? new URL(url).origin : DEFAULT_ASSET_ORIGIN;
}

function plausibleEmail(value: string | undefined): string | null {
  const v = value?.trim();
  return v && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? v : null;
}

export function brandConfig(env: Record<string, string | undefined> = process.env): EmailBrandConfig {
  const assetOrigin = originFrom(env.SUPPLEMENTS_EMAIL_ASSET_ORIGIN);
  return {
    assetOrigin,
    siteUrl: `${assetOrigin}/`,
    supportEmail: plausibleEmail(env.SUPPLEMENTS_SUPPORT_EMAIL) ?? DEFAULT_SUPPORT_EMAIL,
  };
}

export function formatMoney(amount: string | number, currency: string): string {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${currency}`;
  }
}

export function isZero(amount: string | number): boolean {
  return Math.abs(Number(amount) || 0) < 0.005;
}

export function addressLines(address: EmailAddress | null): string[] {
  if (!address) return [];
  const cityLine = [address.city, [address.province, address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [address.name, address.company, address.address1, address.address2, cityLine, address.country]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);
}

/** e.g. "j***@example.com"; used for logs only. */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "(none)";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
