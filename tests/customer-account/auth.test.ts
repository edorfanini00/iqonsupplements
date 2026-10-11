import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_ID, SHOP_ID } from "./fake-provider.mjs";
import { CUSTOMER_A, CUSTOMER_B, env, handlers, Jar, ORIGIN, request, setup, signIn } from "./harness";
import { customerAccountConfig, AccountUnavailable } from "@/lib/customer-account/config";
import { safeReturnPath } from "@/lib/customer-account/return-path";
import { seal } from "@/lib/customer-account/crypto";
import { resetRefreshSingleFlight } from "@/lib/customer-account/session";

const location = (response: Response) => response.headers.get("location") || "";

test("configuration: absent is 'not configured', partial or weak is rejected", () => {
  assert.equal(customerAccountConfig({}), null);
  assert.throws(() => customerAccountConfig({SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: CLIENT_ID}), AccountUnavailable);
  assert.throws(() => customerAccountConfig({...env, CUSTOMER_ACCOUNT_SESSION_SECRET: Buffer.from("short").toString("base64")}), AccountUnavailable);
  assert.throws(() => customerAccountConfig({...env, CUSTOMER_ACCOUNT_PUBLIC_ORIGIN: "http://www.iqonbody.com"}), AccountUnavailable);
  assert.throws(() => customerAccountConfig({...env, CUSTOMER_ACCOUNT_PUBLIC_ORIGIN: "https://www.iqonbody.com/account"}), AccountUnavailable);
  assert.throws(() => customerAccountConfig({...env, SHOPIFY_SUBSCRIPTION_MANAGEMENT_PUBLISHED: "true", SHOPIFY_SUBSCRIPTION_MANAGEMENT_URL: "https://evil.example/account/pages/x"}), AccountUnavailable);
  const config = customerAccountConfig(env)!;
  assert.equal(config.callbackUrl, `${ORIGIN}/account/callback`);
  assert.equal(config.logoutRedirectUrl, `${ORIGIN}/account/signed-out`);
  assert.equal(config.graphqlEndpoint, `https://shopify.com/${SHOP_ID}/account/customer/api/2026-04/graphql`);
  assert.equal(config.subscriptionManagementUrl, null, "management link stays hidden until the provider page is published");
  assert.equal(customerAccountConfig({...env, SHOPIFY_SUBSCRIPTION_MANAGEMENT_PUBLISHED: "true"})!.subscriptionManagementUrl, `https://shopify.com/${SHOP_ID}/account/pages/6971b1a1-27f6-4c27-b8b0-3009fd3b921d`);
  // Plain-http localhost is the only non-https origin and switches off the __Host- prefix.
  assert.equal(customerAccountConfig({...env, CUSTOMER_ACCOUNT_PUBLIC_ORIGIN: "http://localhost:3918"})!.secureCookies, false);
});

test("return destinations are a fixed same-origin allowlist (open redirect attempts)", () => {
  for (const ok of ["/account", "/account/orders", "/account/orders/9101", "/account/subscriptions/6101", "/account/privacy"]) assert.equal(safeReturnPath(ok), ok);
  for (const bad of ["//evil.example", "https://evil.example/account", "/account/../admin", "/account/orders/abc", "/\\evil.example", "javascript:alert(1)", "/account?x=1", "/account/orders/1/../../x", "/affiliates/dashboard", "", null, 42])
    assert.equal(safeReturnPath(bad), "/account", String(bad));
});

test("login builds a PKCE S256 authorization request and an encrypted single-use transaction cookie", async () => {
  const t = setup();
  const jar = new Jar();
  const response = jar.take(await handlers.loginRoute(request("/account/login?return=//evil.example", jar), t.deps));
  assert.equal(response.status, 303);
  const url = new URL(location(response));
  assert.equal(url.origin + url.pathname, `https://shopify.com/authentication/${SHOP_ID}/oauth/authorize`);
  assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), `${ORIGIN}/account/callback`);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("code_challenge")!, /^[A-Za-z0-9_-]{43}$/);
  assert.match(url.searchParams.get("state")!, /^[A-Za-z0-9_-]{43}$/);
  assert.match(url.searchParams.get("nonce")!, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const attrs = jar.attributes.get("__Host-iqb_ca_tx")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=600"]) assert.ok(attrs.includes(flag), flag);
  const raw = jar.cookies.get("__Host-iqb_ca_tx")!;
  assert.ok(!raw.includes(url.searchParams.get("state")!), "state is not readable from the cookie");
  // Open redirect attempt resolves to /account after sign-in.
  const callback = t.provider.authorize(url.href, CUSTOMER_A);
  const done = await handlers.callbackRoute(request(new URL(callback).pathname + new URL(callback).search, jar), t.deps);
  assert.equal(location(done), "/account");
});

test("prefetches never start a sign-in", async () => {
  const t = setup();
  const response = await handlers.loginRoute(request("/account/login", null, {headers: {"sec-purpose": "prefetch"}}), t.deps);
  assert.equal(response.status, 204);
  assert.equal(response.headers.getSetCookie().length, 0);
});

test("successful callback creates an encrypted HttpOnly session and returns to the allowlisted page", async () => {
  const t = setup();
  const {jar, done, session} = await signIn(t, CUSTOMER_A, "/account/orders");
  assert.equal(done.status, 303);
  assert.equal(location(done), "/account/orders");
  assert.ok(!location(done).includes("code="));
  assert.equal(jar.cookies.has("__Host-iqb_ca_tx"), false, "transaction cookie cleared");
  const attrs = jar.attributes.get("__Host-iqb_ca.0")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(attrs.includes(flag), flag);
  const envelope = [...jar.cookies].filter(([k]) => k.startsWith("__Host-iqb_ca.")).map(([, v]) => v).join("");
  assert.ok(!/mockat_|mockrt_|eyJ/.test(envelope), "tokens are not readable from the session cookie");
  assert.equal(session.status, "signed_in");
  assert.equal(session.email, "avery.synthetic@example.test");
  const exchange = t.provider.ledger().find((e: {op: string; grant?: string}) => e.op === "token" && e.grant === "authorization_code");
  assert.equal(exchange.origin, ORIGIN, "token exchange sends the registered JavaScript origin");
  assert.equal(exchange.ua, true, "token exchange sends a User-Agent");
});

test("callback rejects tampered state, missing transaction, provider errors and replay", async () => {
  const t = setup();
  // Tampered state
  let jar = new Jar();
  let login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
  let callback = new URL(t.provider.authorize(location(login), CUSTOMER_A));
  callback.searchParams.set("state", "forged-state-value-forged-state-value-forg");
  let response = jar.take(await handlers.callbackRoute(request(callback.pathname + callback.search, jar), t.deps));
  assert.equal(location(response), "/account?signin=failed");
  assert.equal([...jar.cookies.keys()].some(k => k.startsWith("__Host-iqb_ca.")), false);

  // Callback without the browser's transaction cookie (login CSRF / injected code)
  jar = new Jar();
  login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
  callback = new URL(t.provider.authorize(location(login), CUSTOMER_B));
  response = await handlers.callbackRoute(request(callback.pathname + callback.search, new Jar()), t.deps);
  assert.equal(location(response), "/account?signin=expired");

  // Customer declined at Shopify
  const declined = new URL(`${ORIGIN}/account/callback`);
  declined.searchParams.set("error", "access_denied");
  declined.searchParams.set("state", new URL(location(login)).searchParams.get("state")!);
  response = await handlers.callbackRoute(request(declined.pathname + declined.search, jar), t.deps);
  assert.equal(location(response), "/account?signin=cancelled");

  // Replay: the same code + a captured transaction cookie cannot mint a second session.
  jar = new Jar();
  login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
  const captured = jar.clone();
  callback = new URL(t.provider.authorize(location(login), CUSTOMER_A));
  response = jar.take(await handlers.callbackRoute(request(callback.pathname + callback.search, jar), t.deps));
  assert.equal(location(response), "/account");
  const replay = captured.take(await handlers.callbackRoute(request(callback.pathname + callback.search, captured), t.deps));
  assert.equal(location(replay), "/account?signin=failed");
  assert.equal([...captured.cookies.keys()].some(k => k.startsWith("__Host-iqb_ca.")), false);

  // Expired transaction (older than 10 minutes)
  jar = new Jar();
  login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
  callback = new URL(t.provider.authorize(location(login), CUSTOMER_A));
  t.clock.now += 11 * 60 * 1000;
  response = await handlers.callbackRoute(request(callback.pathname + callback.search, jar), t.deps);
  assert.equal(location(response), "/account?signin=expired");
});

test("id_token must carry the transaction nonce, the shop issuer, this client and a valid signature", async () => {
  const cases: [string, (issued: Record<string, string>, provider: ReturnType<typeof setup>["provider"]) => Record<string, string>][] = [
    ["nonce", (_, p) => ({id_token: p.signIdToken(CUSTOMER_A, "other-nonce")})],
    ["audience", (_, p) => ({id_token: p.signIdToken(CUSTOMER_A, undefined, {aud: "someone-else"})})],
    ["issuer", (_, p) => ({id_token: p.signIdToken(CUSTOMER_A, undefined, {iss: "https://shopify.com/authentication/1"})})],
    ["expired", (_, p) => ({id_token: p.signIdToken(CUSTOMER_A, undefined, {exp: 1000})})],
    ["signature", issued => { const [h, , s] = issued.id_token.split("."); const forged = Buffer.from(JSON.stringify({sub: CUSTOMER_B})).toString("base64url"); return {id_token: `${h}.${forged}.${s}`}; }],
    ["alg none", issued => { const [, p] = issued.id_token.split("."); return {id_token: `${Buffer.from(JSON.stringify({alg: "none"})).toString("base64url")}.${p}.`}; }],
  ];
  for (const [name, override] of cases) {
    const t = setup();
    const jar = new Jar();
    const login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
    const url = new URL(location(login));
    const nonce = url.searchParams.get("nonce")!;
    t.provider.configure({tokenOverride: (issued: Record<string, string>) => {
      const patch = override(issued, t.provider);
      // Tests other than "nonce" keep the right nonce so only the named property is wrong.
      if (name !== "nonce" && name !== "signature" && name !== "alg none") patch.id_token = t.provider.signIdToken(CUSTOMER_A, nonce, JSON.parse(Buffer.from(patch.id_token.split(".")[1], "base64url").toString()));
      return patch;
    }});
    const callback = new URL(t.provider.authorize(url.href, CUSTOMER_A));
    const response = jar.take(await handlers.callbackRoute(request(callback.pathname + callback.search, jar), t.deps));
    assert.equal(location(response), "/account?signin=failed", name);
    assert.equal([...jar.cookies.keys()].some(k => k.startsWith("__Host-iqb_ca.")), false, name);
  }
});

test("provider outage during sign-in is reported as unavailable, not as a failed sign-in", async () => {
  const t = setup();
  const jar = new Jar();
  const login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
  const callback = new URL(t.provider.authorize(location(login), CUSTOMER_A));
  t.provider.configure({failToken: 1});
  const response = await handlers.callbackRoute(request(callback.pathname + callback.search, jar), t.deps);
  assert.equal(location(response), "/account?signin=unavailable");
});

test("tampered, foreign-secret and swapped cookies are treated as signed out and cleared", async () => {
  const t = setup();
  const {jar} = await signIn(t);
  const tampered = jar.clone();
  const value = tampered.cookies.get("__Host-iqb_ca.0")!;
  tampered.cookies.set("__Host-iqb_ca.0", value.slice(0, -4) + (value.endsWith("AAAA") ? "BBBB" : "AAAA"));
  let response = await handlers.overviewApi(request("/api/account/overview", tampered), t.deps);
  assert.equal(response.status, 401);
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith("__Host-iqb_ca.0=;") && c.includes("Max-Age=0")));

  const foreign = setup({env: {...env, CUSTOMER_ACCOUNT_SESSION_SECRET: Buffer.from("another-secret-another-secret-another-secret").toString("base64")}});
  response = await handlers.overviewApi(request("/api/account/overview", jar), foreign.deps);
  assert.equal(response.status, 401);

  // A sealed login transaction placed in the session cookie fails authentication (purpose-bound keys).
  const config = (await import("@/lib/customer-account/config")).customerAccountConfig(env)!;
  const swapped = new Jar();
  swapped.cookies.set("__Host-iqb_ca.0", await seal(config.secret, "transaction", {v: 1, sid: "x", sub: CUSTOMER_B, tokens: {}, expiresAt: Date.now() + 1e9}));
  response = await handlers.overviewApi(request("/api/account/overview", swapped), t.deps);
  assert.equal(response.status, 401);

  // No cookie at all is signed_out without a Set-Cookie.
  response = await handlers.overviewApi(request("/api/account/overview", null), t.deps);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "signed_out");
  assert.equal(response.headers.getSetCookie().length, 0);
});

test("session absolute lifetime ends the session even with a valid refresh token", async () => {
  const t = setup();
  const {jar} = await signIn(t);
  t.clock.now += 31 * 24 * 60 * 60 * 1000;
  const response = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(response.status, 401);
});

test("expired access tokens refresh once for concurrent requests and rotate the cookie", async () => {
  const t = setup();
  t.provider.configure({expiresIn: 120});
  const {jar} = await signIn(t);
  t.clock.now += 5 * 60 * 1000;
  // Make the provider consider the old access token expired too.
  t.provider.mutate((state: {access: Record<string, {exp: number}>}) => { for (const a of Object.values(state.access)) a.exp = 0; });
  const responses = await Promise.all(Array.from({length: 5}, () => handlers.overviewApi(request("/api/account/overview", jar), t.deps)));
  for (const response of responses) assert.equal(response.status, 200);
  const refreshes = t.provider.ledger().filter((e: {op: string}) => e.op === "refresh");
  assert.equal(refreshes.length, 1, "single-flight refresh");
  assert.ok(responses.every(r => r.headers.getSetCookie().some(c => c.startsWith("__Host-iqb_ca.0=") && !c.includes("Max-Age=0"))));
  jar.take(responses[0]);
  const after = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(after.status, 200);
  assert.equal(t.provider.ledger().filter((e: {op: string}) => e.op === "refresh").length, 1, "rotated cookie is reused without another refresh");
});

test("a revoked refresh token signs the customer out; a refresh outage does not", async () => {
  const t = setup();
  t.provider.configure({expiresIn: 120});
  const {jar} = await signIn(t);
  t.clock.now += 5 * 60 * 1000;
  t.provider.configure({failToken: 1});
  let response = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "unavailable");
  assert.equal(response.headers.getSetCookie().length, 0, "session kept during an outage");
  t.provider.mutate((state: {refresh: Record<string, {used: boolean}>}) => { for (const r of Object.values(state.refresh)) r.used = true; });
  response = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(response.status, 401);
  assert.equal(response.headers.getSetCookie().length, 0, "a data request never clears a cookie a concurrent request may have rotated");
  // The client then re-checks the session, which clears the dead session.
  response = await handlers.sessionApi(request("/api/account/session", jar), t.deps);
  assert.deepEqual(await response.json(), {status: "signed_out"});
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith("__Host-iqb_ca.0=;") && c.includes("Max-Age=0")));
});

test("an access token revoked before expiry gets exactly one refresh and retry", async () => {
  const t = setup();
  const {jar} = await signIn(t);
  t.provider.mutate((state: {access: Record<string, {exp: number}>}) => { for (const a of Object.values(state.access)) a.exp = 0; });
  const response = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(response.status, 200);
  assert.equal(t.provider.ledger().filter((e: {op: string}) => e.op === "refresh").length, 1);
});

test("logout is POST + same-origin only, clears the session and ends the Shopify session", async () => {
  const t = setup();
  const {jar} = await signIn(t);
  let response = await handlers.logoutRoute(request("/account/logout", jar, {method: "POST", headers: {origin: "https://evil.example"}}), t.deps);
  assert.equal(response.status, 403);
  response = await handlers.logoutRoute(request("/account/logout", jar, {method: "POST", headers: {origin: ORIGIN, "sec-fetch-site": "cross-site"}}), t.deps);
  assert.equal(response.status, 403);
  response = jar.take(await handlers.logoutRoute(request("/account/logout", jar, {method: "POST", headers: {origin: ORIGIN, "sec-fetch-site": "same-origin"}}), t.deps));
  assert.equal(response.status, 303);
  const url = new URL(location(response));
  assert.equal(url.origin + url.pathname, `https://shopify.com/authentication/${SHOP_ID}/logout`);
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), `${ORIGIN}/account/signed-out`);
  assert.ok(url.searchParams.get("id_token_hint"));
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal([...jar.cookies.keys()].some(k => k.startsWith("__Host-iqb_ca.")), false);
  const after = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(after.status, 401);
});

test("not configured and misconfigured states are distinct from signed out", async () => {
  const none = setup({env: {}});
  let response = await handlers.sessionApi(request("/api/account/session", null), none.deps);
  assert.deepEqual(await response.json(), {status: "not_configured"});
  response = await handlers.overviewApi(request("/api/account/overview", null), none.deps);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "not_configured");
  response = await handlers.loginRoute(request("/account/login", null), none.deps);
  assert.equal(location(response), "/account");
  const broken = setup({env: {...env, CUSTOMER_ACCOUNT_PUBLIC_ORIGIN: "http://www.iqonbody.com"}});
  const errors: unknown[] = [];
  const original = console.error; console.error = (...args: unknown[]) => errors.push(args);
  try { response = await handlers.sessionApi(request("/api/account/session", null), broken.deps); } finally { console.error = original; }
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {status: "unavailable"});
  assert.ok(!JSON.stringify(errors).includes(env.CUSTOMER_ACCOUNT_SESSION_SECRET));
  const signedOut = setup();
  response = await handlers.sessionApi(request("/api/account/session", null), signedOut.deps);
  assert.deepEqual(await response.json(), {status: "signed_out"});
});

test("cross-instance refresh race with strict rotation: the stale request is 401 but does not clobber the rotated cookie", async () => {
  const t = setup();
  t.provider.configure({expiresIn: 120, rotateRefresh: true});
  const {jar} = await signIn(t);
  t.clock.now += 5 * 60 * 1000;
  const stale = jar.clone();
  // Instance 1 refreshes and rotates.
  const first = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(first.status, 200);
  // Instance 2 (no shared memory) receives the same old cookie and tries the used refresh token.
  resetRefreshSingleFlight();
  const second = await handlers.overviewApi(request("/api/account/overview", stale), t.deps);
  assert.equal(second.status, 401);
  assert.equal(second.headers.getSetCookie().length, 0);
  // Out-of-order arrival: second response lands after the first; the browser keeps the rotated cookie.
  jar.take(second); jar.take(first);
  const order2 = jar.clone(); order2.take(first); order2.take(second);
  for (const browser of [jar, order2]) {
    const check = await handlers.sessionApi(request("/api/account/session", browser), t.deps);
    assert.equal((await check.json()).status, "signed_in");
  }
});

test("cross-instance refresh race where the provider tolerates reuse: both orders of Set-Cookie arrival stay signed in", async () => {
  const t = setup();
  t.provider.configure({expiresIn: 120, rotateRefresh: false});
  const {jar} = await signIn(t);
  t.clock.now += 5 * 60 * 1000;
  const a = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  resetRefreshSingleFlight();
  const b = await handlers.overviewApi(request("/api/account/overview", jar), t.deps);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  for (const [x, y] of [[a, b], [b, a]]) {
    const browser = jar.clone(); browser.take(x); browser.take(y);
    const check = await handlers.sessionApi(request("/api/account/session", browser), t.deps);
    assert.equal((await check.json()).status, "signed_in");
  }
  assert.equal(t.provider.ledger().filter((e: {op: string}) => e.op === "refresh").length, 2, "two instances each refreshed: not serialized server-wide");
});

test("chunked session cookies fail closed when incomplete, reordered, mixed or oversized", async () => {
  const t = setup();
  const {seal: sealValue} = await import("@/lib/customer-account/crypto");
  const {customerAccountConfig} = await import("@/lib/customer-account/config");
  const {writeChunked} = await import("@/lib/customer-account/cookies");
  const config = customerAccountConfig(env)!;
  const {jar} = await signIn(t);
  const {jar: other} = await signIn(t, CUSTOMER_B);
  // Re-seal A's real session padded to three chunks to exercise multi-chunk assembly.
  const {readSession} = await import("@/lib/customer-account/session");
  const sessionA = (await readSession(config, request("/", jar))).session!;
  const sealed = await sealValue(config.secret, "session", {...sessionA, pad: "p".repeat(7000)});
  const chunks = new Jar();
  for (const header of writeChunked(config, "__Host-iqb_ca", sealed, 3600)) chunks.take(new Response(null, {headers: {"set-cookie": header}}));
  assert.equal(chunks.cookies.size, 3);
  assert.equal((await handlers.overviewApi(request("/api/account/overview", chunks), t.deps)).status, 200, "complete chunks assemble");
  const variants: [string, (j: Jar) => void][] = [
    ["missing middle chunk", j => j.cookies.delete("__Host-iqb_ca.1")],
    ["missing last chunk", j => j.cookies.delete("__Host-iqb_ca.2")],
    ["reordered chunks", j => { const a = j.cookies.get("__Host-iqb_ca.0")!, b = j.cookies.get("__Host-iqb_ca.1")!; j.cookies.set("__Host-iqb_ca.0", b); j.cookies.set("__Host-iqb_ca.1", a); }],
    ["chunk from another session", j => j.cookies.set("__Host-iqb_ca.0", other.cookies.get("__Host-iqb_ca.0")!)],
    ["extra chunk beyond budget", j => { for (let i = 3; i <= 4; i++) j.cookies.set(`__Host-iqb_ca.${i}`, "x".repeat(3800)); }],
  ];
  for (const [name, mutate] of variants) {
    const broken = chunks.clone(); mutate(broken);
    const response = await handlers.overviewApi(request("/api/account/overview", broken), t.deps);
    assert.equal(response.status, 401, name);
    const cleared = response.headers.getSetCookie().filter(c => c.includes("Max-Age=0")).map(c => c.split("=")[0]);
    assert.deepEqual(cleared.sort(), ["__Host-iqb_ca.0", "__Host-iqb_ca.1", "__Host-iqb_ca.2", "__Host-iqb_ca.3"], `${name}: every chunk deleted`);
  }
  // Logout deletes every chunk too.
  const out = await handlers.logoutRoute(request("/account/logout", chunks, {method: "POST", headers: {origin: ORIGIN, "sec-fetch-site": "same-origin"}}), t.deps);
  assert.equal(out.headers.getSetCookie().filter(c => c.includes("Max-Age=0")).length, 4);
});

test("an attacker's authorization code injected into a victim's callback fails PKCE at the provider", async () => {
  const t = setup();
  // Attacker starts their own flow and obtains a code bound to the attacker's PKCE challenge.
  const attacker = new Jar();
  const attackerLogin = attacker.take(await handlers.loginRoute(request("/account/login", attacker), t.deps));
  const attackerCode = new URL(t.provider.authorize(location(attackerLogin), CUSTOMER_B)).searchParams.get("code")!;
  // Victim has their own transaction; even with the victim's real state the exchange uses the victim's verifier.
  const victim = new Jar();
  const victimLogin = victim.take(await handlers.loginRoute(request("/account/login", victim), t.deps));
  const state = new URL(location(victimLogin)).searchParams.get("state")!;
  const response = victim.take(await handlers.callbackRoute(request(`/account/callback?code=${attackerCode}&state=${state}`, victim), t.deps));
  assert.equal(location(response), "/account?signin=failed");
  assert.equal([...victim.cookies.keys()].some(k => k.startsWith("__Host-iqb_ca.")), false);
  const exchange = t.provider.ledger().filter((e: {op: string; grant?: string}) => e.op === "token" && e.grant === "authorization_code");
  assert.equal(exchange.length, 1, "the injected code reached the provider once and was refused (PKCE), not accepted");
});

test("logout and sign-in never write tokens or the id_token_hint to logs", async () => {
  const t = setup();
  const logs: string[] = [];
  const original = {log: console.log, info: console.info, warn: console.warn, error: console.error};
  for (const level of ["log", "info", "warn", "error"] as const) console[level] = (...args: unknown[]) => { logs.push(args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")); };
  let idToken = "";
  try {
    const {jar} = await signIn(t);
    const out = await handlers.logoutRoute(request("/account/logout", jar, {method: "POST", headers: {origin: ORIGIN, "sec-fetch-site": "same-origin"}}), t.deps);
    idToken = new URL(location(out)).searchParams.get("id_token_hint") || "";
    // Failure paths log too; exercise one.
    t.provider.configure({failToken: 1});
    const j2 = new Jar();
    const l2 = j2.take(await handlers.loginRoute(request("/account/login", j2), t.deps));
    const cb = new URL(t.provider.authorize(location(l2), CUSTOMER_A));
    await handlers.callbackRoute(request(cb.pathname + cb.search, j2), t.deps);
  } finally { Object.assign(console, original); }
  assert.ok(idToken.length > 100);
  const secrets = [idToken, idToken.split(".")[1], ...Object.keys(t.provider.load().access), ...Object.keys(t.provider.load().refresh), ...Object.keys(t.provider.load().codes)];
  for (const secret of secrets) assert.ok(!logs.some(line => line.includes(secret)), "secret leaked to logs");
});

test("an id_token with perfect claims but signed by a foreign key (same kid) is rejected", async () => {
  const {generateKeyPairSync, sign} = await import("node:crypto");
  const t = setup();
  const jar = new Jar();
  const login = jar.take(await handlers.loginRoute(request("/account/login", jar), t.deps));
  const nonce = new URL(location(login)).searchParams.get("nonce")!;
  const {privateKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
  t.provider.configure({tokenOverride: () => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({alg: "RS256", kid: "mock-key-1"})).toString("base64url");
    const payload = Buffer.from(JSON.stringify({iss: `https://shopify.com/authentication/${SHOP_ID}`, aud: CLIENT_ID, sub: CUSTOMER_B, nonce, iat: now, exp: now + 3600})).toString("base64url");
    return {id_token: `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url")}`};
  }});
  const callback = new URL(t.provider.authorize(location(login), CUSTOMER_A));
  const response = jar.take(await handlers.callbackRoute(request(callback.pathname + callback.search, jar), t.deps));
  assert.equal(location(response), "/account?signin=failed");
});
