import type { CustomerAccountConfig } from "./config";
import { clearChunked, cookieNames, parseCookies, readChunked, serializeCookie, writeChunked } from "./cookies";
import { hmac, randomToken, safeEqual, seal, unseal } from "./crypto";
import { ProviderError, refreshTokens, TRANSACTION_TTL_SECONDS, type Fetcher, type LoginTransaction, type TokenSet } from "./oauth";

export type CustomerSession = {
  v: 1;
  /** Random per sign-in; binds CSRF tokens and refresh single-flight to this session only. */
  sid: string;
  /** Shopify customer subject from the verified id_token. */
  sub: string;
  tokens: TokenSet;
  createdAt: number;
  expiresAt: number;
};

// The customer signs in again after this, regardless of refresh-token validity.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
// Refresh slightly before expiry so a request never reaches Shopify with a dying token.
export const REFRESH_LEEWAY_MS = 60 * 1000;

export function newSession(sub: string, tokens: TokenSet, now = Date.now()): CustomerSession {
  return {v: 1, sid: randomToken(24), sub, tokens, createdAt: now, expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000};
}

function validSession(value: unknown, now: number): value is CustomerSession {
  const s = value as CustomerSession | null;
  return !!s && s.v === 1 && typeof s.sid === "string" && typeof s.sub === "string" && !!s.tokens
    && typeof s.tokens.accessToken === "string" && typeof s.tokens.refreshToken === "string" && typeof s.tokens.idToken === "string"
    && typeof s.tokens.accessTokenExpiresAt === "number" && typeof s.expiresAt === "number" && s.expiresAt > now;
}

export async function readSession(config: CustomerAccountConfig, request: Request, now = Date.now()) {
  const jar = parseCookies(request.headers.get("cookie"));
  const names = cookieNames(config);
  const {value, chunks} = readChunked(jar, names.session);
  const session = await unseal<CustomerSession>(config.secret, "session", value);
  return {session: validSession(session, now) ? session : null, present: chunks > 0};
}

export async function sessionCookies(config: CustomerAccountConfig, session: CustomerSession, now = Date.now()) {
  const sealed = await seal(config.secret, "session", session);
  return writeChunked(config, cookieNames(config).session, sealed, (session.expiresAt - now) / 1000);
}
export function clearSessionCookies(config: CustomerAccountConfig) { return clearChunked(config, cookieNames(config).session); }

export async function readTransaction(config: CustomerAccountConfig, request: Request, now = Date.now()) {
  const jar = parseCookies(request.headers.get("cookie"));
  const tx = await unseal<LoginTransaction>(config.secret, "transaction", jar.get(cookieNames(config).transaction));
  if (!tx || typeof tx.state !== "string" || typeof tx.verifier !== "string" || typeof tx.nonce !== "string" || typeof tx.returnTo !== "string") return null;
  if (typeof tx.createdAt !== "number" || now - tx.createdAt > TRANSACTION_TTL_SECONDS * 1000 || tx.createdAt > now + 60_000) return null;
  return tx;
}
export async function transactionCookie(config: CustomerAccountConfig, tx: LoginTransaction) {
  return serializeCookie(config, cookieNames(config).transaction, await seal(config.secret, "transaction", tx), TRANSACTION_TTL_SECONDS);
}
export function clearTransactionCookie(config: CustomerAccountConfig) { return serializeCookie(config, cookieNames(config).transaction, "", 0); }

export function csrfToken(config: CustomerAccountConfig, session: CustomerSession) { return hmac(config.secret, "csrf", session.sid); }
export async function validCsrf(config: CustomerAccountConfig, session: CustomerSession, supplied: string | null) {
  return !!supplied && safeEqual(supplied, await csrfToken(config, session));
}

// One in-flight refresh per session+refresh token WITHIN THIS INSTANCE ONLY. Concurrent requests
// that land on the same instance share the rotated tokens. This is not a cross-instance lock:
// requests on different serverless instances can each refresh; see docs/customer-accounts.md.
const inflight = new Map<string, Promise<CustomerSession>>();

/** Test hook: simulates a request landing on a different serverless instance. */
export function resetRefreshSingleFlight() { inflight.clear(); }

export async function freshSession(config: CustomerAccountConfig, session: CustomerSession, fetcher: Fetcher = fetch, now = Date.now()): Promise<{session: CustomerSession; rotated: boolean}> {
  if (session.tokens.accessTokenExpiresAt - REFRESH_LEEWAY_MS > now) return {session, rotated: false};
  const key = `${session.sid}:${session.tokens.refreshToken}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = refreshTokens(config, session.tokens, fetcher, now).then(tokens => ({...session, tokens}));
    inflight.set(key, pending);
    // Keep the settled result briefly so requests that read the old cookie just after
    // completion reuse it rather than presenting the rotated-away refresh token.
    pending.then(() => { const timer = setTimeout(() => inflight.delete(key), 30_000) as {unref?: () => void}; timer.unref?.(); }, () => inflight.delete(key));
  }
  return {session: await pending, rotated: true};
}

export { ProviderError };
