/**
 * Creator access codes for the IQON mobile app.
 *
 * Creators promote the app but should not have to pay for it, so a code lets
 * them skip the paywall. Validation lives here rather than in the app bundle so
 * a leaked code can be rotated by changing an env var and redeploying, instead
 * of shipping an App Store update and waiting on review.
 *
 * Server-only.
 */

const DEFAULT_CODES = ["freeiqonic"];

const normalize = (code: string) => code.trim().toLowerCase().replace(/\s+/g, "");

function configuredCodes(): string[] {
  const raw = process.env.SUPPLEMENTS_IQON_CREATOR_ACCESS_CODES?.trim();
  if (!raw) return DEFAULT_CODES;

  const codes = raw.split(",").map(normalize).filter(Boolean);
  // An env var set to only separators would otherwise silently disable every
  // code and lock creators out with no signal as to why.
  return codes.length > 0 ? codes : DEFAULT_CODES;
}

export function isValidCreatorCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const candidate = normalize(code);
  if (!candidate) return false;
  return configuredCodes().includes(candidate);
}
