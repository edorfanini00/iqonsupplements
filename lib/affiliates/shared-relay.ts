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
  // Individually mounted adapters; no prefix or arbitrary dispatch.
  const payoutId = /^\/api\/affiliates\/admin\/payouts\/([A-Za-z0-9_-]{1,100})$/.exec(incoming.pathname)?.[1];
  const noteId = /^\/api\/affiliates\/admin\/notes\/([A-Za-z0-9_-]{1,100})$/.exec(incoming.pathname)?.[1];
  const messageId = /^\/api\/affiliates\/admin\/messages\/([A-Za-z0-9_-]{1,100})$/.exec(incoming.pathname)?.[1];
  const nativeTarget = incoming.search !== '' ? null
    : incoming.pathname === '/api/affiliates/bank' && method === 'PUT' ? '/api/integrations/body/native/bank'
    : incoming.pathname === '/api/affiliates/onboarding' && method === 'POST' ? '/api/integrations/body/native/onboarding'
    : incoming.pathname === '/api/affiliates/admin/notes' && method === 'POST' ? '/api/integrations/body/native/notes'
    : noteId && method === 'PATCH' ? '/api/integrations/body/native/notes/'+noteId
    : messageId && method === 'PATCH' ? '/api/integrations/body/native/message-status/'+messageId
    : payoutId && method === 'DELETE' ? '/api/integrations/body/native/payout-reversal/'+payoutId : null;
  const command = /^\/api\/affiliates\/commands\/(signup|affiliate-approval|commission-settings|payout-record|creator-code-sync|admin-create)(?:\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?$/.exec(incoming.pathname);
  const bulk = /^\/api\/affiliates\/commands\/creator-code-bulk(?:\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}))?$/.exec(incoming.pathname);
  const commandWrite = ((!!command && !command[2]) || !!bulk) && method === 'POST' && incoming.search === '';
  const commandRead = (!!bulk?.[1] || !!command?.[2] || /^\/api\/affiliates\/commands\/state\/[A-Za-z0-9_-]{1,100}$/.test(incoming.pathname)) && method === 'GET' && incoming.search === '';
  // Restore narrowly audited original reads, retaining canonical role/identity checks.
  // Detail refresh is a write to a Woo snapshot despite using GET; never relay it.
  const accountingPicker = method === 'GET' && incoming.pathname === '/api/affiliates/admin/accounting/products' && incoming.search === '';
  const categoryRead = method === 'GET' && incoming.pathname === '/api/affiliates/category-revenue';
  // Settlement is all-time and unfiltered. Do not widen this into a prefix proxy.
  const outstandingRead = method === 'GET' && incoming.pathname === '/api/affiliates/payouts/outstanding'
    && incoming.searchParams.size === 1 && !!incoming.searchParams.get('affiliateId')?.trim();
  const originalRead = categoryRead || accountingPicker || (method === 'GET' && ORIGINAL_READ_ROUTES.some(pattern => pattern.test(incoming.pathname))
    && !(incoming.pathname.startsWith('/api/affiliates/orders/') && incoming.search !== ''));
  if (!originalRead && /^\/api\/affiliates\/(?:admin\/(?:orders|subscriptions|accounting|customers|marketing)|orders|shop-manager)(?:\/|$)/.test(incoming.pathname)) {
    return Response.json({ok:false,error:'Source-aware commerce operation is unavailable in this portal'}, {status:501,headers:{'cache-control':'no-store'}});
  }
  if (!nativeTarget && !outstandingRead && !originalRead && !commandWrite && !commandRead && !SHARED_ROUTES.some(([pattern,methods])=>pattern.test(incoming.pathname)&&methods.includes(method))) return fail(404);
  const mutation=!['GET','HEAD'].includes(method);
  // Auth, named canonical commands and individually qualified local-state
  // adapters only. No generic financial or provider dispatch.
  if (mutation && !nativeTarget && !commandWrite && !['/api/affiliates/login','/api/affiliates/logout'].includes(incoming.pathname)) {
    return Response.json({ok:false,error:'This action is unavailable until its dedicated canonical command is qualified'}, {status:501,headers:{'cache-control':'no-store'}});
  }
  const readMarker = method === 'GET' && (incoming.pathname === '/api/affiliates/messages' || /^\/api\/affiliates\/admin\/affiliate-messages\/[A-Za-z0-9_-]+$/.test(incoming.pathname));
  if (readMarker && ((request.headers.get('origin') !== incoming.origin && !(request.headers.get('origin') === null && request.headers.get('sec-fetch-site') === 'same-origin')) || request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')?.includes('prefetch'))) return fail(403);
  // Preview accepts only its exact server-assigned deployment host, never a
  // browser-supplied forwarding header or arbitrary *.vercel.app origin.
  // Authority attribution remains the configured canonical Body portal below.
  let previewOrigin: string | undefined;
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    try {
      const candidate = origin('https://' + env.VERCEL_URL, env);
      if (new URL(candidate).hostname.endsWith('.vercel.app')) previewOrigin = candidate;
    } catch { /* Invalid server configuration grants no additional origin. */ }
  }
  if (incoming.origin !== config.portal && incoming.origin !== previewOrigin) return fail(403);
  if (mutation && request.headers.get('origin') !== incoming.origin) return fail(403);
  if (mutation && !nativeTarget && !bulk?.[1] && request.body && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return fail(415);
  const headers=new Headers({'accept':'application/json','x-iqon-portal':config.portal,'x-iqon-relay-secret':config.secret});
  const cookie=affiliateCookieHeader(request.headers.get('cookie') ?? ''); if(cookie)headers.set('cookie',cookie);
  if(mutation) headers.set('content-type','application/json');
  // Origin is server generated after browser-origin validation, never blindly copied.
  headers.set('origin',config.portal);
  let body:Uint8Array | undefined;
  try { body=mutation ? await boundedBody(request) : undefined; } catch {return fail(413);}
  if (nativeTarget) {
    if (body?.byteLength && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return fail(415);
    if (!body?.byteLength) body=undefined;
  }
  if (bulk?.[1] && mutation) {
    if (body?.byteLength) return fail(400);
    body=undefined; // Next represents bodyless POST as an empty stream.
  }
  try {
    // Compatibility path is local-only; canonical session lives in the additive integration namespace.
    const path = nativeTarget ?? (commandWrite || commandRead ? incoming.pathname.replace('/api/affiliates/commands/', '/api/integrations/body/commands/') : incoming.pathname === '/api/affiliates/shared-session'
      ? '/api/integrations/body/session' : outstandingRead ? '/api/integrations/body/payouts/outstanding' : categoryRead ? '/api/integrations/body/category-revenue' : accountingPicker ? '/api/integrations/body/accounting-products' : incoming.pathname);
    const target = new URL(path + incoming.search,config.health);
    const upstream=await (options.fetch ?? fetch)(target,{method,headers,body:body as BodyInit | undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(originalRead ? 90000 : commandWrite || commandRead ? 60000 : 15000)});
    if(upstream.status>=300 && upstream.status<400) return fail(502);
    const out = new Headers({'cache-control':'no-store','content-type':upstream.headers.get('content-type') ?? 'application/json','x-content-type-options':'nosniff'});
    // Never reflect Domain, arbitrary cookies, CORS, Location or upstream headers.
    for (const cookie of upstream.headers.getSetCookie()) {
      const pair=cookie.split(';',1)[0]; const split=pair.indexOf('='); const name=pair.slice(0,split); const value=pair.slice(split+1);
      if (!(SHARED_AUTH_COOKIES as readonly string[]).includes(name) || !/^[A-Za-z0-9_.%=-]*$/.test(value)) continue;
      const maxAge = /;\s*max-age=(-?\d+)(?:;|$)/i.exec(cookie);
      const expires = /;\s*expires=([^;]+)(?:;|$)/i.exec(cookie);
      const expiry = expires ? Date.parse(expires[1]) : NaN;
      const clear=value === '' || (maxAge && Number(maxAge[1]) <= 0);
      // A session cookie stays session-only. Respect short upstream lifetimes.
      const lifetime = clear ? '; Max-Age=0' : maxAge ? `; Max-Age=${Math.min(Number(maxAge[1]),2592000)}` : Number.isFinite(expiry) ? `; Expires=${new Date(expiry).toUTCString()}` : '';
      out.append('set-cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax${lifetime}${env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    }
    return new Response(upstream.body,{status:upstream.status,headers:out});
  } catch { return fail(502); }
}
