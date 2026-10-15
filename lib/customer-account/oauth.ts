import type { CustomerAccountConfig } from "./config";
import { fromBase64url, pkceChallenge, randomToken } from "./crypto";

export type Fetcher = typeof fetch;
export type TokenSet = {accessToken: string; accessTokenExpiresAt: number; refreshToken: string; idToken: string};
export type LoginTransaction = {state: string; nonce: string; verifier: string; returnTo: string; createdAt: number};
export const TRANSACTION_TTL_SECONDS = 600;

/** "rejected" means the grant is no longer valid (sign the customer out); "unavailable" means try again later. */
export class ProviderError extends Error {
  constructor(public kind: "rejected" | "unavailable", message: string) { super(message); }
}

const USER_AGENT = "IQON Daily customer account (Shopify Customer Account API client)";
export function providerHeaders(config: CustomerAccountConfig, extra: Record<string, string> = {}) {
  // Shopify requires the registered JavaScript origin and a User-Agent on public-client requests.
  return {"Origin": config.origin, "User-Agent": USER_AGENT, ...extra};
}

export async function startLogin(config: CustomerAccountConfig, returnTo: string, now = Date.now()) {
  const transaction: LoginTransaction = {state: randomToken(32), nonce: randomToken(32), verifier: randomToken(48), returnTo, createdAt: now};
  const url = new URL(config.authorizeEndpoint);
  url.searchParams.set("scope", "openid email customer-account-api:full");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("nonce", transaction.nonce);
  url.searchParams.set("code_challenge", await pkceChallenge(transaction.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return {url: url.href, transaction};
}

type TokenResponse = {access_token?: unknown; expires_in?: unknown; refresh_token?: unknown; id_token?: unknown};

async function tokenRequest(config: CustomerAccountConfig, body: URLSearchParams, fetcher: Fetcher, timeoutMs = 10000): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetcher(config.tokenEndpoint, {
      method: "POST", body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
      headers: providerHeaders(config, {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}),
    });
  } catch { throw new ProviderError("unavailable", "token endpoint unreachable"); }
  if (response.status === 400 || response.status === 401) {
    // invalid_grant, expired/used code, revoked refresh token: the grant itself is gone.
    throw new ProviderError("rejected", `token request rejected (${response.status})`);
  }
  if (!response.ok) throw new ProviderError("unavailable", `token endpoint returned ${response.status}`);
  try { return await response.json() as TokenResponse; }
  catch { throw new ProviderError("unavailable", "token endpoint returned invalid JSON"); }
}

function tokenSet(data: TokenResponse, now: number, previous?: TokenSet): TokenSet {
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  const expiresIn = typeof data.expires_in === "number" && Number.isFinite(data.expires_in) ? data.expires_in : 0;
  const refreshToken = typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : previous?.refreshToken || "";
  const idToken = typeof data.id_token === "string" && data.id_token ? data.id_token : previous?.idToken || "";
  if (!accessToken || expiresIn <= 0 || !refreshToken || !idToken) throw new ProviderError("unavailable", "token response missing required fields");
  return {accessToken, accessTokenExpiresAt: now + Math.min(expiresIn, 60 * 60 * 24) * 1000, refreshToken, idToken};
}

export async function exchangeCode(config: CustomerAccountConfig, code: string, verifier: string, fetcher: Fetcher = fetch, now = Date.now()) {
  const body = new URLSearchParams({grant_type: "authorization_code", client_id: config.clientId, redirect_uri: config.callbackUrl, code, code_verifier: verifier});
  return tokenSet(await tokenRequest(config, body, fetcher), now);
}

export async function refreshTokens(config: CustomerAccountConfig, previous: TokenSet, fetcher: Fetcher = fetch, now = Date.now(), timeoutMs = 10000) {
  const body = new URLSearchParams({grant_type: "refresh_token", client_id: config.clientId, refresh_token: previous.refreshToken});
  return tokenSet(await tokenRequest(config, body, fetcher, timeoutMs), now, previous);
}

export function logoutUrl(config: CustomerAccountConfig, idToken: string | undefined) {
  if (!idToken) return config.logoutRedirectUrl;
  const url = new URL(config.logoutEndpoint);
  url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("post_logout_redirect_uri", config.logoutRedirectUrl);
  return url.href;
}

// ---- id_token verification (RS256 against the shop's published JWKS) ----

type Jwk = JsonWebKey & {kid?: string; kty?: string; alg?: string; use?: string};
type JwksEntry = {keys: Jwk[]; fetchedAt: number};
// Public signing keys only; no customer data is cached.
const jwksCache = new Map<string, JwksEntry>();
export function resetJwksCache() { jwksCache.clear(); }

async function loadJwks(config: CustomerAccountConfig, fetcher: Fetcher, force: boolean, now: number): Promise<Jwk[]> {
  const cached = jwksCache.get(config.jwksEndpoint);
  if (cached && !force && now - cached.fetchedAt < 60 * 60 * 1000) return cached.keys;
  let response: Response;
  try {
    response = await fetcher(config.jwksEndpoint, {redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000), headers: providerHeaders(config, {"Accept": "application/json"})});
  } catch { throw new ProviderError("unavailable", "jwks unreachable"); }
  if (!response.ok) throw new ProviderError("unavailable", `jwks returned ${response.status}`);
  const data = await response.json().catch(() => null) as {keys?: Jwk[]} | null;
  if (!data || !Array.isArray(data.keys)) throw new ProviderError("unavailable", "jwks malformed");
  jwksCache.set(config.jwksEndpoint, {keys: data.keys, fetchedAt: now});
  return data.keys;
}

/**
 * Verified claims. The token proves the sign-in event (signature, issuer, audience, expiry, nonce).
 * It is not the source of customer identity: Shopify's own client never reads `sub`, and the
 * session's customer is taken from the Customer Account API with the new access token.
 * `subShape` is recorded only for diagnostics; the claim's value is never logged.
 */
export type IdTokenClaims = {sub: string | null; subShape: "string" | "absent" | "empty" | "number" | "other"; email?: string; sid?: string; exp: number};

function decodePart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(fromBase64url(part))) as T;
}

export async function verifyIdToken(config: CustomerAccountConfig, idToken: string, expectedNonce: string | null, fetcher: Fetcher = fetch, now = Date.now()): Promise<IdTokenClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new ProviderError("rejected", "id_token malformed");
  let header: {alg?: string; kid?: string}, claims: Record<string, unknown>;
  try { header = decodePart(parts[0]); claims = decodePart(parts[1]); }
  catch { throw new ProviderError("rejected", "id_token malformed"); }
  if (header.alg !== "RS256") throw new ProviderError("rejected", "id_token algorithm not allowed");
  const pick = (keys: Jwk[]) => keys.find(key => key.kty === "RSA" && (!header.kid || key.kid === header.kid) && (!key.use || key.use === "sig"));
  let jwk = pick(await loadJwks(config, fetcher, false, now));
  if (!jwk) jwk = pick(await loadJwks(config, fetcher, true, now));
  if (!jwk) throw new ProviderError("rejected", "id_token signing key unknown");
  const key = await crypto.subtle.importKey("jwk", {kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true}, {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromBase64url(parts[2]) as BufferSource, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new ProviderError("rejected", "id_token signature invalid");
  const seconds = Math.floor(now / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== config.issuer) throw new ProviderError("rejected", "id_token issuer mismatch");
  if (!audience.includes(config.clientId)) throw new ProviderError("rejected", "id_token audience mismatch");
  if (typeof claims.exp !== "number" || claims.exp + 60 < seconds) throw new ProviderError("rejected", "id_token expired");
  if (typeof claims.iat === "number" && claims.iat - 300 > seconds) throw new ProviderError("rejected", "id_token issued in the future");
  if (expectedNonce !== null && claims.nonce !== expectedNonce) throw new ProviderError("rejected", "id_token nonce mismatch");
  const subShape: IdTokenClaims["subShape"] = typeof claims.sub === "string" ? (claims.sub ? "string" : "empty") : claims.sub === undefined || claims.sub === null ? "absent" : typeof claims.sub === "number" ? "number" : "other";
  return {sub: subShape === "string" ? claims.sub as string : null, subShape, exp: claims.exp, ...(typeof claims.email === "string" ? {email: claims.email} : {}), ...(typeof claims.sid === "string" ? {sid: claims.sid} : {})};
}

