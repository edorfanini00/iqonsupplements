import type { CustomerAccountConfig } from "./config";
import { cookieNames, parseCookies, serializeCookie } from "./cookies";
import { hmac, randomToken, safeEqual, seal, unseal } from "./crypto";
import { ProviderError, refreshTokens, TRANSACTION_TTL_SECONDS, type Fetcher, type LoginTransaction, type TokenSet } from "./oauth";
import type { SessionRow, SessionStore } from "./store";

// Sessions of record live in PostgreSQL (store.ts). The browser cookie is only an opaque
// "id.secret" pointer and is written exactly once, by a successful sign-in callback. Data,
// session and logout responses never set or clear it, so no late response can restore a
// signed-out identity, replace a newer sign-in, or erase a newer session.

export type CustomerSession = {id: string; sub: string; generation: number; tokens: TokenSet; expiresAt: number};

/** The session row was revoked (logout, rejected refresh), expired, or never existed. */
export class SessionEnded extends Error {}
/** The session store could not be read or written. */
export class StoreUnavailable extends Error {}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const REFRESH_LEEWAY_MS = 60 * 1000;
// A crashed refresher's lease lapses after this; its provider call times out well before.
export const LEASE_MS = 20 * 1000;
export const REFRESH_TIMEOUT_MS = 10 * 1000;
export const REFRESH_WAIT_MS = 12 * 1000;
const COOKIE_VALUE = /^([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/;

export type Coordination = {store: SessionStore; fetcher: Fetcher; now: () => number; waitMs?: number; pollMs?: number; refreshTimeoutMs?: number};

async function db<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch { throw new StoreUnavailable("session store unavailable"); }
}
const secretHash = (config: CustomerAccountConfig, secret: string) => hmac(config.secret, "session-secret", secret);
const sealTokens = (config: CustomerAccountConfig, id: string, tokens: TokenSet) => seal(config.secret, "session-tokens", tokens, id);

/** Creates the session row and returns the only Set-Cookie that ever establishes a session. */
export async function createSession(config: CustomerAccountConfig, store: SessionStore, sub: string, tokens: TokenSet, now: number) {
  const id = randomToken(24), secret = randomToken(32);
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const row = {id, secretHash: await secretHash(config, secret), customerSub: sub, tokens: await sealTokens(config, id, tokens), accessExpiresAt: tokens.accessTokenExpiresAt, expiresAt};
  await db(() => store.create(row, now));
  return {id, cookie: serializeCookie(config, cookieNames(config).session, `${id}.${secret}`, SESSION_MAX_AGE_SECONDS)};
}

async function toSession(config: CustomerAccountConfig, row: SessionRow | null, now: number): Promise<CustomerSession> {
  if (!row || row.revokedAt !== null || row.expiresAt <= now) throw new SessionEnded("session ended");
  const tokens = await unseal<TokenSet>(config.secret, "session-tokens", row.tokens, row.id);
  if (!tokens) throw new SessionEnded("session tokens unreadable");
  return {id: row.id, sub: row.customerSub, generation: row.generation, tokens, expiresAt: row.expiresAt};
}

/**
 * The session named by this request's cookie, or null when there is none or it is not live.
 * Throws StoreUnavailable when the database can't be read: that is "unavailable", not "signed out".
 */
export async function readSession(config: CustomerAccountConfig, store: SessionStore, request: Request, now: number): Promise<CustomerSession | null> {
  const raw = parseCookies(request.headers.get("cookie")).get(cookieNames(config).session);
  const match = raw ? COOKIE_VALUE.exec(raw) : null;
  if (!match) return null;
  const row = await db(() => store.get(match[1]));
  if (!row || !safeEqual(row.secretHash, await secretHash(config, match[2]))) return null;
  try { return await toSession(config, row, now); }
  catch (error) { if (error instanceof SessionEnded) return null; throw error; }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Returns a session whose access token is usable, refreshing it at most once across every
 * server instance: one request takes a lease on the row (conditional UPDATE), calls Shopify,
 * and installs the new tokens only if the row is still live and at the same generation.
 * Others wait for the generation to advance. A lease left by a crashed or timed-out
 * refresher lapses after LEASE_MS. `force` refreshes even before expiry (Shopify rejected the
 * current access token) unless another instance already replaced it.
 */
export async function freshSession(config: CustomerAccountConfig, session: CustomerSession, c: Coordination, force = false): Promise<CustomerSession> {
  const owner = randomToken(16);
  const deadline = Date.now() + (c.waitMs ?? REFRESH_WAIT_MS);
  const seenGeneration = session.generation;
  for (;;) {
    const now = c.now();
    const current = await toSession(config, await db(() => c.store.get(session.id)), now);
    if (current.generation > seenGeneration) return current;
    if (!force && current.tokens.accessTokenExpiresAt - REFRESH_LEEWAY_MS > now) return current;
    if (await db(() => c.store.acquireLease(current.id, current.generation, owner, now, now + LEASE_MS))) {
      let tokens: TokenSet;
      try { tokens = await refreshTokens(config, current.tokens, c.fetcher, now, c.refreshTimeoutMs ?? REFRESH_TIMEOUT_MS); }
      catch (error) {
        if (error instanceof ProviderError && error.kind === "rejected") {
          // The grant is gone. Revoke exactly this generation; a newer one is never touched.
          if (await db(() => c.store.revoke(current.id, "refresh_rejected", now, current.generation))) throw new SessionEnded("refresh rejected");
          continue;
        }
        await db(() => c.store.releaseLease(current.id, owner, c.now()));
        throw error;
      }
      const sealed = await sealTokens(config, current.id, tokens);
      if (await db(() => c.store.completeRefresh(current.id, current.generation, owner, sealed, tokens.accessTokenExpiresAt, c.now()))) {
        return {...current, generation: current.generation + 1, tokens};
      }
      // Revoked (logout) or lease lost while Shopify answered: these tokens are discarded.
      continue;
    }
    if (Date.now() >= deadline) throw new ProviderError("unavailable", "refresh coordination timed out");
    await sleep(c.pollMs ?? 150);
  }
}

export async function revokeSession(store: SessionStore, session: CustomerSession, reason: string, now: number) {
  await db(() => store.revoke(session.id, reason, now));
}

export function csrfToken(config: CustomerAccountConfig, session: CustomerSession) { return hmac(config.secret, "csrf", session.id); }
export async function validCsrf(config: CustomerAccountConfig, session: CustomerSession, supplied: string | null) {
  return !!supplied && safeEqual(supplied, await csrfToken(config, session));
}

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

export { ProviderError };
