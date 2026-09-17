import { SHARED_ROUTES, ORIGINAL_READ_ROUTES } from './shared-route-allowlist';

type Env = Record<string, string | undefined>;
type Transport = (input: string | URL, init?: RequestInit) => Promise<Response>;
export const SHARED_AUTH_COOKIES = ['iqon_affiliate_wp_jwt', 'iqon_affiliate_portal_snapshot'] as const;
const MAX_BODY = 1024 * 1024;
const fail = (status: number) => Response.json({ok:false,error:status === 503 ? 'Shared affiliate authority is not configured' : 'Shared affiliate request rejected'}, {status,headers:{'cache-control':'no-store'}});
function origin(raw: string | undefined, env: Env): string {
  if (!raw) throw Error('missing origin');
  const u = new URL(raw);
  const local = env.NODE_ENV !== 'production' && env.SHARED_AFFILIATE_ALLOW_LOOPBACK === '1' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname);
  if ((u.protocol !== 'https:' && !(local && u.protocol === 'http:')) || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw Error('unsafe origin');
  return u.origin;
}
export function sharedRelayConfig(env: Env = process.env) {
  const health = origin(env.SHARED_AFFILIATE_HEALTH_ORIGIN,env);
  const portal = origin(env.SHARED_AFFILIATE_PORTAL_ORIGIN,env);
  const secret = env.SHARED_AFFILIATE_RELAY_SECRET;
  if (!secret || secret.length < 32 || health === portal) throw Error('missing relay credential');
  return {health,portal,secret};
}
export function affiliateCookieHeader(raw: string): string {
  const parts = raw.split(';').map(p => p.trim());
  return SHARED_AUTH_COOKIES.flatMap(name => {
    const matches = parts.filter(p=>p.startsWith(name+'='));
    // Reject ambiguous duplicate cookie names and malformed values.
    return matches.length === 1 && /^[A-Za-z0-9_.%=-]+$/.test(matches[0].slice(name.length+1)) ? matches : [];
  }).join('; ');
}
async function boundedBody(request: Request): Promise<Uint8Array | undefined> {
  if (!request.body) return undefined;
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>MAX_BODY){await reader.cancel();throw Error('body too large');} chunks.push(value); }
  const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;} return bytes;
}
/** Server-only fixed-origin BFF. Does not import any independent DB/auth code. */
export async function relayAffiliateRequest(request: Request, options: {env?:Env;fetch?:Transport} = {}): Promise<Response> {
  const env=options.env ?? process.env;
  let config:ReturnType<typeof sharedRelayConfig>;
  try {config=sharedRelayConfig(env);} catch {return fail(503);}
  const incoming = new URL(request.url);
  const method = request.method.toUpperCase();
  // Restore narrowly audited original reads, retaining canonical role/identity checks.
  // Detail refresh is a write to a Woo snapshot despite using GET; never relay it.
  const originalRead = method === 'GET' && ORIGINAL_READ_ROUTES.some(pattern => pattern.test(incoming.pathname))
    && !(incoming.pathname.startsWith('/api/affiliates/orders/') && incoming.searchParams.get('refresh') === '1');
  if (!originalRead && /^\/api\/affiliates\/(?:admin\/(?:orders|subscriptions|accounting|customers|marketing)|orders|shop-manager)(?:\/|$)/.test(incoming.pathname)) {
    return Response.json({ok:false,error:'Source-aware commerce operation is unavailable in this portal'}, {status:501,headers:{'cache-control':'no-store'}});
  }
  if (!originalRead && !SHARED_ROUTES.some(([pattern,methods])=>pattern.test(incoming.pathname)&&methods.includes(method))) return fail(404);
  const mutation=!['GET','HEAD'].includes(method);
  if (incoming.origin !== config.portal || (mutation && request.headers.get('origin') !== config.portal)) return fail(403);
  if (mutation && request.body && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return fail(415);
  const headers=new Headers({'accept':'application/json','x-iqon-portal':config.portal,'x-iqon-relay-secret':config.secret});
  // Only the canonical payout creation route accepts header-based idempotency.
  if (method === 'POST' && incoming.pathname === '/api/affiliates/admin/payouts') {
    const key=request.headers.get('idempotency-key');
    if (key !== null) {
      // Match Health's nonblank/200-character bound; reject header control bytes.
      // Never discard an invalid header and silently use a different body token.
      if (!key.trim() || key.length > 200 || /[\x00-\x1f\x7f]/.test(key)) return fail(400);
      headers.set('idempotency-key',key);
    }
  }
  const cookie=affiliateCookieHeader(request.headers.get('cookie') ?? ''); if(cookie)headers.set('cookie',cookie);
  if(mutation) headers.set('content-type','application/json');
  // Origin is server generated after browser-origin validation, never blindly copied.
  headers.set('origin',config.portal);
  let body:Uint8Array | undefined;
  try { body=mutation ? await boundedBody(request) : undefined; } catch {return fail(413);}
  try {
    const target = new URL(incoming.pathname + incoming.search,config.health);
    const upstream=await (options.fetch ?? fetch)(target,{method,headers,body:body as BodyInit | undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    if(upstream.status>=300 && upstream.status<400) return fail(502);
    const out = new Headers({'cache-control':'no-store','content-type':upstream.headers.get('content-type') ?? 'application/json','x-content-type-options':'nosniff'});
    // Never reflect Domain, arbitrary cookies, CORS, Location or upstream headers.
    for (const cookie of upstream.headers.getSetCookie()) {
      const pair=cookie.split(';',1)[0]; const split=pair.indexOf('='); const name=pair.slice(0,split); const value=pair.slice(split+1);
      if (!(SHARED_AUTH_COOKIES as readonly string[]).includes(name) || !/^[A-Za-z0-9_.%=-]*$/.test(value)) continue;
      const clear=/;\s*max-age=0(?:;|$)/i.test(cookie) || value === '';
      out.append('set-cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 2592000}${env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    }
    return new Response(upstream.body,{status:upstream.status,headers:out});
  } catch { return fail(502); }
}
