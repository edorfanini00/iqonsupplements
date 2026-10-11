// Response-ordering races from the round-1 reviews, against real PostgreSQL and the real
// handlers. Each case holds a provider response mid-request, changes the session elsewhere,
// then releases it and checks the identity the browser ends up with.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_A, CUSTOMER_B, handlers, Jar, ORIGIN, request, SESSION_COOKIE, setup, signIn, store } from "./harness";
import { LEASE_MS } from "@/lib/customer-account/session";

type Hold = {release: () => void; reached: Promise<void>};
/** Wraps a fetcher so chosen provider responses are produced (Shopify acts) but delivered late. */
function gate(base: typeof fetch) {
  let holds: {match: (url: string, init?: RequestInit) => boolean; release: Promise<void>; reached: () => void}[] = [];
  return {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const hold = holds.find(h => h.match(url, init));
      if (!hold) return base(input, init);
      holds = holds.filter(h => h !== hold);
      const response = await base(input, init);
      hold.reached();
      await hold.release;
      return response;
    }) as typeof fetch,
    hold(match: (url: string, init?: RequestInit) => boolean): Hold {
      let release!: () => void, reached!: () => void;
      const released = new Promise<void>(resolve => { release = resolve; });
      const reachedPromise = new Promise<void>(resolve => { reached = resolve; });
      holds.push({match, release: released, reached});
      return {release, reached: reachedPromise};
    },
  };
}
const isGraphql = (url: string) => url.includes("/account/customer/api/");
const isRefresh = (url: string, init?: RequestInit) => url.endsWith("/oauth/token") && String(init?.body).includes("grant_type=refresh_token");
const logout = (jar: Jar, t: ReturnType<typeof setup>) => handlers.logoutRoute(request("/account/logout", jar, {method: "POST", headers: {origin: ORIGIN, "sec-fetch-site": "same-origin"}}), t.deps);
async function identity(jar: Jar, t: ReturnType<typeof setup>) {
  const body = await (await handlers.sessionApi(request("/api/account/session", jar), t.deps)).json();
  return body.status === "signed_in" ? body.email : body.status;
}
function expiring(t: ReturnType<typeof setup>) { t.provider.configure({expiresIn: 120, rotateRefresh: true}); }

test("late successful refresh (GraphQL held) after logout cannot restore the session", async () => {
  const t = setup(); expiring(t);
  const {jar} = await signIn(t);
  t.clock.now += 5 * 60 * 1000;
  const g = gate(t.fetcher);
  const hold = g.hold(isGraphql);
  const pending = handlers.overviewApi(request("/api/account/overview", jar), {...t.deps, fetcher: g.fetch});
  await hold.reached;
  jar.take(await logout(jar.clone(), t));
  hold.release();
  const late = jar.take(await pending);
  assert.equal(late.headers.getSetCookie().length, 0, "the late response carries no cookie");
  assert.equal(await identity(jar, t), "signed_out");
  assert.equal(t.provider.ledger().filter((e: {op: string}) => e.op === "refresh").length, 1);
});

test("late refresh (token response held) after logout: the new tokens are discarded", async () => {
  const t = setup(); expiring(t);
  const {jar} = await signIn(t);
  const id = jar.cookies.get(SESSION_COOKIE)!.split(".")[0];
  t.clock.now += 5 * 60 * 1000;
  const g = gate(t.fetcher);
  const hold = g.hold(isRefresh);
  const pending = handlers.overviewApi(request("/api/account/overview", jar), {...t.deps, fetcher: g.fetch});
  await hold.reached;
  await logout(jar.clone(), t);
  hold.release();
  const late = await pending;
  assert.equal(late.status, 401);
  assert.equal(late.headers.getSetCookie().length, 0);
  const row = (await store.get(id))!;
  assert.ok(row.revokedAt !== null);
  assert.equal(row.generation, 0, "refreshed tokens were never installed on the revoked row");
  assert.equal(await identity(jar, t), "signed_out");
});

test("A's held request completing after B signs in on the same browser leaves B signed in", async () => {
  for (const held of ["graphql", "token"] as const) {
    const t = setup(); expiring(t);
    const {jar} = await signIn(t, CUSTOMER_A);
    t.clock.now += 5 * 60 * 1000;
    const g = gate(t.fetcher);
    const hold = g.hold(held === "graphql" ? isGraphql : isRefresh);
    const pending = handlers.overviewApi(request("/api/account/overview", jar), {...t.deps, fetcher: g.fetch});
    await hold.reached;
    // Another tab signs out and signs in as B; the shared jar now holds B's cookie.
    jar.take(await logout(jar.clone(), t));
    const b = await signIn(t, CUSTOMER_B);
    jar.take(b.done);
    assert.equal(await identity(jar, t), "blake.synthetic@example.test");
    hold.release();
    jar.take(await pending);
    assert.equal(await identity(jar, t), "blake.synthetic@example.test", `${held}: B stays signed in`);
  }
});

test("concurrent session checks under strict rotation: one refresh, both signed in, either delivery order", async () => {
  const t = setup(); expiring(t);
  const {jar} = await signIn(t);
  t.clock.now += 5 * 60 * 1000;
  const g = gate(t.fetcher);
  const hold = g.hold(isRefresh);
  const first = handlers.sessionApi(request("/api/account/session", jar), {...t.deps, fetcher: g.fetch});
  await hold.reached;
  // The second check starts while the first holds the lease, as on another instance.
  const second = handlers.sessionApi(request("/api/account/session", jar), {...t.deps, fetcher: g.fetch});
  await new Promise(resolve => setTimeout(resolve, 100));
  hold.release();
  const [a, b] = await Promise.all([first, second]);
  for (const response of [a, b]) {
    assert.equal((await response.json()).status, "signed_in");
    assert.equal(response.headers.getSetCookie().length, 0);
  }
  assert.equal(t.provider.ledger().filter((e: {op: string}) => e.op === "refresh").length, 1, "the waiter used the winner's tokens");
  for (const order of [[a, b], [b, a]]) { const browser = jar.clone(); for (const r of order) browser.take(r); assert.equal(await identity(browser, t), "avery.synthetic@example.test"); }
});

test("a delayed rejection of A's dead grant arriving after B signs in does not touch B", async () => {
  const t = setup(); expiring(t);
  const {jar} = await signIn(t, CUSTOMER_A);
  t.clock.now += 5 * 60 * 1000;
  t.provider.mutate((state: {refresh: Record<string, {used: boolean}>}) => { for (const r of Object.values(state.refresh)) r.used = true; });
  const g = gate(t.fetcher);
  const hold = g.hold(isRefresh);
  const pending = handlers.sessionApi(request("/api/account/session", jar), {...t.deps, fetcher: g.fetch});
  await hold.reached;
  const b = await signIn(t, CUSTOMER_B);
  jar.take(b.done);
  hold.release();
  const late = jar.take(await pending);
  assert.deepEqual(await late.json(), {status: "signed_out"});
  assert.equal(late.headers.getSetCookie().length, 0);
  assert.equal(await identity(jar, t), "blake.synthetic@example.test");
});

test("a delayed logout response arriving after a new sign-in does not sign the new session out", async () => {
  const t = setup();
  const {jar} = await signIn(t, CUSTOMER_A);
  const oldLogout = await logout(jar.clone(), t);
  const b = await signIn(t, CUSTOMER_B);
  jar.take(b.done);
  jar.take(oldLogout);
  assert.equal(await identity(jar, t), "blake.synthetic@example.test");
});

test("a crashed refresher's lease lapses; waiting is bounded and honest", async () => {
  const t = setup(); expiring(t);
  const {jar} = await signIn(t);
  const id = jar.cookies.get(SESSION_COOKIE)!.split(".")[0];
  t.clock.now += 5 * 60 * 1000;
  assert.ok(await store.acquireLease(id, 0, "crashed-instance", t.clock.now, t.clock.now + LEASE_MS));
  const started = Date.now();
  const waiting = await handlers.overviewApi(request("/api/account/overview", jar), {...t.deps, waitMs: 400});
  assert.equal(waiting.status, 503, "unavailable, not signed out, while another instance holds the lease");
  assert.ok(Date.now() - started < 3000);
  t.clock.now += LEASE_MS + 1;
  const recovered = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(recovered.status, 200);
  assert.equal((await store.get(id))!.generation, 1);
});

test("a hanging token endpoint is cut off by the refresh timeout and the lease is released", async () => {
  const t = setup(); expiring(t);
  const {jar} = await signIn(t);
  const id = jar.cookies.get(SESSION_COOKIE)!.split(".")[0];
  t.clock.now += 5 * 60 * 1000;
  const hanging = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isRefresh(String(input), init)) return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    return t.fetcher(input, init);
  }) as typeof fetch;
  const started = Date.now();
  const response = await handlers.overviewApi(request("/api/account/overview", jar), {...t.deps, fetcher: hanging, refreshTimeoutMs: 300});
  assert.equal(response.status, 503);
  assert.ok(Date.now() - started < 3000, "bounded");
  assert.equal((await store.get(id))!.leaseOwner, null);
  assert.equal((await handlers.overviewApi(request("/api/account/overview", jar), t.deps)).status, 200, "the next request recovers");
});

test("database outage is 'unavailable', never 'signed out', and sets no cookie", async () => {
  const t = setup();
  const {jar} = await signIn(t);
  const broken = {...t.deps, store: {...store, get: async () => { throw new Error("connection refused"); }}};
  const response = await handlers.sessionApi(request("/api/account/session", jar), broken);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {status: "unavailable"});
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.equal(await identity(jar, t), "avery.synthetic@example.test");
});

void CUSTOMER_A;
