// Test harness: drives the real handlers against the MOCK provider. No network.
import { CLIENT_ID, SHOP_ID, createFakeProvider } from "./fake-provider.mjs";
import * as handlers from "@/lib/customer-account/handlers";
import { resetJwksCache } from "@/lib/customer-account/oauth";

export const ORIGIN = "https://www.iqonbody.example";
export const SECRET = Buffer.from("0123456789abcdef0123456789abcdef-test-only-secret").toString("base64");
export const env = {
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: CLIENT_ID, SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: SHOP_ID,
  CUSTOMER_ACCOUNT_SESSION_SECRET: SECRET, CUSTOMER_ACCOUNT_PUBLIC_ORIGIN: ORIGIN,
};
export const CUSTOMER_A = "gid://shopify/Customer/7001";
export const CUSTOMER_B = "gid://shopify/Customer/7002";
export const CUSTOMER_NEW = "gid://shopify/Customer/7003";

export function setup(options: {env?: Record<string, string | undefined>; clock?: {now: number}} = {}) {
  resetJwksCache();
  const provider = createFakeProvider({origin: ORIGIN});
  const clock = options.clock ?? {now: Date.now()};
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await provider.fetch(input as string, init);
    if (!response) throw new Error(`unexpected external request ${String(input)}`);
    return response;
  }) as typeof fetch;
  const deps = {env: options.env ?? env, fetcher, now: () => clock.now};
  return {provider, clock, deps, fetcher};
}

/** Minimal browser-like cookie jar honouring Max-Age=0 deletions. */
export class Jar {
  cookies = new Map<string, string>();
  attributes = new Map<string, string>();
  take(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attrs] = header.split("; ");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index), value = pair.slice(index + 1);
      this.attributes.set(name, attrs.join("; "));
      if (attrs.includes("Max-Age=0")) this.cookies.delete(name); else this.cookies.set(name, value);
    }
    return response;
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  clone() { const jar = new Jar(); jar.cookies = new Map(this.cookies); return jar; }
}

export function request(path: string, jar: Jar | null, init: RequestInit & {headers?: Record<string, string>} = {}) {
  const headers: Record<string, string> = {...(init.headers || {})};
  if (jar?.cookies.size) headers.cookie = jar.header();
  return new Request(`${ORIGIN}${path}`, {...init, headers});
}

export function mutation(path: string, jar: Jar, csrf: string, method: string, body: unknown, extra: Record<string, string> = {}) {
  return request(path, jar, {method, body: JSON.stringify(body), headers: {"content-type": "application/json", origin: ORIGIN, "sec-fetch-site": "same-origin", "x-iqb-csrf": csrf, ...extra}});
}

export async function signIn(t: ReturnType<typeof setup>, customer = CUSTOMER_A, returnTo = "/account") {
  const jar = new Jar();
  const login = jar.take(await handlers.loginRoute(request(`/account/login?return=${encodeURIComponent(returnTo)}`, jar), t.deps));
  const callback = t.provider.authorize(login.headers.get("location")!, customer);
  const done = jar.take(await handlers.callbackRoute(request(new URL(callback).pathname + new URL(callback).search, jar), t.deps));
  const session = await (await handlers.sessionApi(request("/api/account/session", jar), t.deps)).json();
  return {jar, login, callback, done, csrf: session.csrf as string, session};
}

export { handlers };
