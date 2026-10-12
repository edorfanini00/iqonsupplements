// Storefront advertising choice, shared by the browser and the server. Pure module.
//
// The choice lives in one cookie written only by the browser, at the visitor's click. No HTTP
// response ever writes it, so a late, lost or replayed response cannot overwrite a newer choice.
// It never grants anything by itself: Shopify decides checkout permission from its own privacy
// settings; this choice is passed to checkout with `@inContext(visitorConsent:)` and an opt-out
// (or GPC) also restricts the cart through `AD_RESTRICTION_ATTRIBUTE`, which the Meta checkout
// pixel refuses to send for. See docs/ad-tracking.md.

export const AD_CHOICE_COOKIE = "iqon_ad_choice";
/** Cart attribute read by shopify/custom-pixels: any non-empty value blocks Meta events. */
export const AD_RESTRICTION_ATTRIBUTE = "_iqon_ad_restriction";

export type AdDecision = "granted" | "denied";
export type AdChoice = {decision: AdDecision; id: string};
export type AdRestriction = "denied" | "gpc" | null;
export type CheckoutVisitorConsent = {marketing?: boolean; saleOfData?: boolean};

const CHOICE_PATTERN = /^v1\.([gd])\.([A-Za-z0-9_-]{22})$/;

export function parseAdChoice(value: string | null | undefined): AdChoice | null {
  const match = typeof value === "string" ? CHOICE_PATTERN.exec(value.trim()) : null;
  return match ? {decision: match[1] === "g" ? "granted" : "denied", id: match[2]} : null;
}
export const formatAdChoice = (choice: AdChoice) => `v1.${choice.decision === "granted" ? "g" : "d"}.${choice.id}`;

/** Every value of a cookie in a Cookie header (duplicates can exist across paths/domains). */
export function cookieValues(header: string | null | undefined, name: string): string[] {
  if (!header) return [];
  return header.split(";").flatMap(part => {
    const index = part.indexOf("=");
    return index > 0 && part.slice(0, index).trim() === name ? [part.slice(index + 1).trim()] : [];
  });
}

/** Restrictive merge: if any copy of the cookie is an opt-out, the opt-out wins. */
export function adChoiceFromCookies(header: string | null | undefined): AdChoice | null {
  const choices = cookieValues(header, AD_CHOICE_COOKIE).map(parseAdChoice).filter((choice): choice is AdChoice => !!choice);
  return choices.find(choice => choice.decision === "denied") || choices[0] || null;
}

/** Identity of the choice a decision was based on; compared instead of clocks. */
export const choiceKey = (choice: AdChoice | null) => choice ? choice.id : "none";

export function adRestriction(choice: AdChoice | null, gpc: boolean): AdRestriction {
  if (choice?.decision === "denied") return "denied";
  return gpc ? "gpc" : null;
}

/** Only what the visitor expressed here (or GPC); null means "no preference": Shopify's defaults apply. */
export function checkoutVisitorConsent(choice: AdChoice | null, gpc: boolean): CheckoutVisitorConsent | null {
  if (choice?.decision === "denied") return {marketing: false, saleOfData: false};
  if (choice?.decision === "granted") return {marketing: true, saleOfData: !gpc};
  return gpc ? {saleOfData: false} : null;
}
