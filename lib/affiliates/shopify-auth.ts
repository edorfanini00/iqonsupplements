/** Server-only Shopify authentication. Never import from client components. */
import { createHash } from 'node:crypto';
export const SHOPIFY_ADMIN_SHOP = 'nr9zd0-t5.myshopify.com';
type Env = Record<string, string | undefined>;
type Token = { value: string; renewAt: number };
type Entry = { key: string; token?: Token; flight?: Promise<Token> };
let current: Entry | undefined;

export function shopifyAuthConfigured(env: Env = process.env): boolean {
  const id = env.SUPPLEMENTS_SHOPIFY_CLIENT_ID?.trim();
  const secret = env.SUPPLEMENTS_SHOPIFY_CLIENT_SECRET?.trim();
  return env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN === SHOPIFY_ADMIN_SHOP &&
    (id || secret ? Boolean(id && secret) : Boolean(env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN?.trim()));
}

async function accessToken(entry: Entry, id: string, secret: string): Promise<Token> {
  if (entry.token && Date.now() < entry.token.renewAt) return entry.token;
  if (entry.flight) return entry.flight;
  entry.flight = (async () => {
    const started = Date.now();
    const response = await fetch(`https://${SHOPIFY_ADMIN_SHOP}/admin/oauth/access_token`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    });
    if (!response.ok) throw new Error('SHOPIFY_AUTH_FAILED');
    const result = await response.json();
    if (!result || typeof result.access_token !== 'string' || !/^[\x21-\x7E]+$/.test(result.access_token) ||
        typeof result.expires_in !== 'number' || !Number.isFinite(result.expires_in) || result.expires_in <= 0 ||
        typeof result.scope !== 'string' || !/^[a-z_]+(?:\s*,\s*[a-z_]+)*$/.test(result.scope.trim())) {
      throw new Error('SHOPIFY_AUTH_FAILED');
    }
    const ttl = result.expires_in * 1000;
    const token = { value: result.access_token, renewAt: started + ttl - Math.min(60_000, ttl / 10) };
    if (!Number.isFinite(token.renewAt) || Date.now() >= token.renewAt) throw new Error('SHOPIFY_AUTH_FAILED');
    entry.token = token;
    return token;
  })().catch(() => { throw new Error('SHOPIFY_AUTH_FAILED'); });
  try { return await entry.flight; }
  finally { entry.flight = undefined; }
}

export async function shopifyAuthenticatedFetch(query: string, variables: Record<string, unknown>): Promise<Response> {
  if (!shopifyAuthConfigured()) throw new Error('SHOPIFY_UNCONFIGURED');
  const id = process.env.SUPPLEMENTS_SHOPIFY_CLIENT_ID?.trim();
  const secret = process.env.SUPPLEMENTS_SHOPIFY_CLIENT_SECRET?.trim();
  let entry: Entry | undefined;
  let token: Token;
  if (id && secret) {
    const key = createHash('sha256').update(JSON.stringify([id, secret])).digest('hex');
    if (current?.key !== key) current = { key };
    entry = current;
    token = await accessToken(entry, id, secret);
  } else {
    current = undefined;
    token = { value: process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN!.trim(), renewAt: Infinity };
  }
  // Conservative classification: unknown documents are never replayed. Keywords
  // in comments/strings may suppress a read retry, but cannot permit a mutation.
  const readOnly = /^\s*(?:query\b|\{)/.test(query) && !/\b(?:mutation|subscription)\b/.test(query);
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://${SHOPIFY_ADMIN_SHOP}/admin/api/2026-07/graphql.json`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token.value },
      body: JSON.stringify({ query, variables }),
    }).catch(() => { throw new Error('SHOPIFY_REQUEST_FAILED'); });
    if (response.status !== 401 || !entry) return response;
    // Object identity, not token text: a late 401 must not evict a new grant.
    if (entry.token === token) entry.token = undefined;
    if (!readOnly || attempt === 1 || current !== entry) return response;
    try { await response.body?.cancel(); }
    catch { throw new Error('SHOPIFY_REQUEST_FAILED'); }
    token = await accessToken(entry, id!, secret!);
  }
}
