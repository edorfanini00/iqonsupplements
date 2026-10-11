// Post-sign-in destinations are a fixed same-origin allowlist. Anything else lands on /account.
const EXACT = new Set(["/account", "/account/orders", "/account/addresses", "/account/subscriptions", "/account/profile", "/account/privacy"]);
const DETAIL = /^\/account\/(orders|subscriptions)\/\d{1,20}$/;

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 64) return "/account";
  return EXACT.has(value) || DETAIL.test(value) ? value : "/account";
}
