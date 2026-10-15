// IQON Daily customer accounts: Shopify Customer Account API (public client, PKCE).
// Shopify is the only customer identity. Nothing here shares state with the affiliate portal.

export type CustomerAccountConfig = {
  clientId: string;
  shopId: string;
  /** Exact public origin of this storefront, e.g. https://www.iqondaily.com. Never derived from the request. */
  origin: string;
  apiVersion: string;
  secret: Uint8Array;
  /** Cookies use the __Host- prefix and Secure everywhere except plain-http localhost development. */
  secureCookies: boolean;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  logoutEndpoint: string;
  issuer: string;
  jwksEndpoint: string;
  graphqlEndpoint: string;
  callbackUrl: string;
  logoutRedirectUrl: string;
  subscriptionManagementUrl: string | null;
};

export class AccountUnavailable extends Error {}

// Schema validated in tests/customer-account against the 2026-04 Customer Account schema.
export const DEFAULT_API_VERSION = "2026-04";
export const DEFAULT_SUBSCRIPTION_MANAGEMENT_PATH = "/account/pages/6971b1a1-27f6-4c27-b8b0-3009fd3b921d";

function decodeSecret(value: string): Uint8Array | null {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+=*$/.test(normalized)) return null;
  try {
    const bytes = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
    return bytes.length >= 32 ? bytes : null;
  } catch { return null; }
}

function exactOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== value.replace(/\/$/, "")) return null;
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return url.origin;
  } catch { return null; }
}

/**
 * Returns null when the account feature is not configured at all (the site shows an honest
 * "not available yet" state). Throws AccountUnavailable when it is partially or invalidly
 * configured, so a typo can never silently weaken the flow.
 */
export function customerAccountConfig(env: Record<string, string | undefined> = process.env): CustomerAccountConfig | null {
  const clientId = (env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID || "").trim();
  const shopId = (env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID || "").trim();
  const rawSecret = env.CUSTOMER_ACCOUNT_SESSION_SECRET || "";
  const rawOrigin = (env.CUSTOMER_ACCOUNT_PUBLIC_ORIGIN || "").trim();
  if (!clientId && !shopId && !rawSecret && !rawOrigin) return null;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(clientId)) throw new AccountUnavailable("invalid client id");
  if (!/^\d{5,20}$/.test(shopId)) throw new AccountUnavailable("invalid shop id");
  const secret = decodeSecret(rawSecret);
  if (!secret) throw new AccountUnavailable("session secret must be at least 32 random bytes, base64 encoded");
  const origin = exactOrigin(rawOrigin);
  if (!origin) throw new AccountUnavailable("public origin must be an exact https origin");
  const apiVersion = (env.SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION || DEFAULT_API_VERSION).trim();
  if (!/^20\d{2}-(01|04|07|10)$/.test(apiVersion)) throw new AccountUnavailable("invalid api version");
  const auth = `https://shopify.com/authentication/${shopId}`;
  const managementPublished = env.SHOPIFY_SUBSCRIPTION_MANAGEMENT_PUBLISHED === "true";
  const managementUrl = (env.SHOPIFY_SUBSCRIPTION_MANAGEMENT_URL || `https://shopify.com/${shopId}${DEFAULT_SUBSCRIPTION_MANAGEMENT_PATH}`).trim();
  let subscriptionManagementUrl: string | null = null;
  if (managementPublished) {
    const url = new URL(managementUrl);
    // Only the store's own hosted customer-account pages are accepted as the provider link.
    if (url.protocol !== "https:" || url.hostname !== "shopify.com" || !url.pathname.startsWith(`/${shopId}/account/`)) throw new AccountUnavailable("invalid subscription management url");
    subscriptionManagementUrl = url.href;
  }
  return {
    clientId, shopId, origin, apiVersion, secret,
    secureCookies: new URL(origin).protocol === "https:",
    authorizeEndpoint: `${auth}/oauth/authorize`,
    tokenEndpoint: `${auth}/oauth/token`,
    logoutEndpoint: `${auth}/logout`,
    issuer: auth,
    jwksEndpoint: `${auth}/.well-known/jwks.json`,
    graphqlEndpoint: `https://shopify.com/${shopId}/account/customer/api/${apiVersion}/graphql`,
    callbackUrl: `${origin}/account/callback`,
    logoutRedirectUrl: `${origin}/account/signed-out`,
    subscriptionManagementUrl,
  };
}

/** Hosted Shopify account home. Used only as an honest fallback link, never as a fake native page. */
export function hostedAccountUrl(config: CustomerAccountConfig) { return `https://shopify.com/${config.shopId}/account`; }
