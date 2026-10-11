import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Exercises the real consent model and privacy route handlers. Each request runs with its
// own copy of the browser's cookies taken when it was sent, and its Set-Cookie headers are
// applied to the browser only when its response "arrives", so overlapping and delayed
// requests behave as they do over a real network.
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
});
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const bindingsUrl = dataUrl(`
  import {AsyncLocalStorage} from "node:async_hooks";
  export const scope = new AsyncLocalStorage();
  export const cookies = async () => ({
    get: key => scope.getStore().sent.has(key) ? {value: scope.getStore().sent.get(key)} : undefined,
    set: (key, value, options) => scope.getStore().received.set(key, {value, options}),
  });
  export const headers = async () => scope.getStore().headers;
`);
const { scope } = await import(bindingsUrl);
const privacy = await import(privacyUrl);
const routes = await import(dataUrl(compile("../lib/privacy.server.ts")
  .replace('"next/headers"', JSON.stringify(bindingsUrl)).replace('"./privacy"', JSON.stringify(privacyUrl))));

const origin = "https://www.iqon.example";
const COOKIE = "__Host-iqon_privacy";
const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
const tick = () => new Promise(resolve => setTimeout(resolve, 3));

// A browser cookie jar. send() snapshots the jar; arrive() applies that response's cookies.
function browser(host = "www.iqon.example", extraHeaders = {}) {
  const jar = new Map();
  const run = async (handler, request) => {
    const store = {sent: new Map(jar), received: new Map(), headers: new Headers({host, ...extraHeaders})};
    const response = await scope.run(store, () => handler(request));
    return {status: response.status, body: await response.json(), cookies: store.received, arrive() {for (const [key, {value}] of store.received) jar.set(key, value);}};
  };
  const post = body => new Request(`${origin}/api/privacy`, {method: "POST", headers: {Origin: origin, "Content-Type": "application/json", ...extraHeaders}, body: typeof body === "string" ? body : JSON.stringify(body)});
  return {
    jar,
    send: body => run(routes.savePrivacyResponse, post(body)),
    async save(body) {const result = await this.send(body); result.arrive(); await tick(); return result;},
    async current() {return (await run(routes.getPrivacyResponse, new Request(`${origin}/api/privacy`))).body.privacy;},
    raw: request => run(routes.savePrivacyResponse, request),
  };
}
const grantAll = async b => b.save({choices: all(true), expectedVersion: (await b.current()).version});

test("unknown is never treated as granted, and malformed or expired decisions read as unknown", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  for (const value of [undefined, "", "granted", "v1.1111.1.1760000000", "v2.1111", "v2.11x1.1.1.1", "v2.1111.1.0.0", "v3.1111.1.5.5"])
    assert.equal(privacy.parseDecision(value, now), null);
  assert.equal(privacy.parseDecision(`v2.1111.4.${now - privacy.PRIVACY_MAX_AGE * 1000 - 1}.0`, now), null);
  assert.equal(privacy.parseDecision(`v2.1111.4.${now + 3600_000}.0`, now), null);
  assert.equal(privacy.parseDecision(`v2.1111.4.${now - 10}.${now}`, now), null, "basis cannot be later than the decision");
  const unknown = privacy.combinePrivacy(null, {});
  assert.deepEqual(unknown.choices, privacy.UNKNOWN_CHOICES);
  assert.equal(privacy.visitorConsent(unknown.choices, false), null);
  const decision = {choices: {analytics: true, marketing: false, preferences: null, saleOfData: true}, revision: 7, decidedAt: now - 10, basis: now - 20};
  assert.deepEqual(privacy.parseDecision(privacy.encodeDecision(decision), now), decision);
  assert.equal(privacy.parseWithdrawal("v1.0", now), null);
  assert.equal(privacy.parseWithdrawal(`v1.${now - 5}`, now), now - 5);
});

test("a withdrawal outranks any grant whose saving request had not seen it", () => {
  const grant = {choices: all(true), revision: 3, decidedAt: 2000, basis: 1000};
  assert.deepEqual(privacy.combinePrivacy(grant, {marketing: 1500}).choices, {...all(true), marketing: false});
  assert.deepEqual(privacy.combinePrivacy(grant, {marketing: 1000}).choices, all(true), "a grant made after seeing the withdrawal stands");
  assert.deepEqual(privacy.combinePrivacy(null, {saleOfData: 5}).choices, {...privacy.UNKNOWN_CHOICES, saleOfData: false});
  const state = privacy.combinePrivacy(grant, {marketing: 1500, analytics: 900});
  assert.equal(state.horizon, 2000);
  assert.equal(state.version, "3.2000.1500");
});

test("granted, denied, partial and GPC decisions map faithfully to Shopify VisitorConsent", () => {
  assert.deepEqual(privacy.visitorConsent(all(true), false), all(true));
  assert.deepEqual(privacy.visitorConsent(all(false), false), all(false));
  // Only expressed choices are sent; no preference is omitted rather than invented.
  assert.deepEqual(privacy.visitorConsent({analytics: true, marketing: null, preferences: null, saleOfData: false}, false), {analytics: true, saleOfData: false});
  // GPC is an expressed opt out of advertising and sale or sharing, and overrides a stored grant.
  assert.deepEqual(privacy.visitorConsent(all(true), true), {analytics: true, preferences: true, marketing: false, saleOfData: false});
  assert.deepEqual(privacy.visitorConsent(privacy.UNKNOWN_CHOICES, true), {marketing: false, saleOfData: false});
  assert.equal(privacy.gpcHeader(new Headers({"Sec-GPC": "1"})), true);
  assert.equal(privacy.gpcHeader(new Headers({"Sec-GPC": "0"})), false);
  assert.equal(privacy.gpcHeader(new Headers()), false);
});

test("restrictions and withdrawal lists can only withdraw", () => {
  assert.deepEqual(privacy.restrictChoices(all(true), {marketing: false}), {...all(true), marketing: false});
  for (const value of [{marketing: true}, {marketing: null}, {marketing: "false"}, {ads: false}, [], "x", null])
    assert.throws(() => privacy.validateRestriction(value), privacy.PrivacyInputError);
  assert.deepEqual(privacy.validateRestriction(undefined), {});
  for (const value of [[], ["ads"], ["marketing", "marketing"], "marketing", null, {marketing: false}, ["analytics", "marketing", "preferences", "saleOfData", "x"]])
    assert.throws(() => privacy.validateWithdrawals(value), privacy.PrivacyInputError);
  for (const value of [undefined, null, [], {}, {...all(true), extra: true}, {...all(true), marketing: "true"}, {...all(true), marketing: 1}, {analytics: true}])
    assert.throws(() => privacy.validateChoices(value), privacy.PrivacyInputError);
});

test("choices persist in host only, httpOnly, secure cookies and survive a new request", async () => {
  const b = browser();
  assert.deepEqual((await b.current()).choices, privacy.UNKNOWN_CHOICES);
  const saved = await grantAll(b);
  assert.equal(saved.status, 200);
  for (const [name, {options}] of saved.cookies) {
    assert.ok(name.startsWith(COOKIE));
    assert.equal(options.httpOnly, true); assert.equal(options.secure, true); assert.equal(options.path, "/");
    assert.equal(options.sameSite, "lax"); assert.equal(options.domain, undefined); assert.equal(options.maxAge, privacy.PRIVACY_MAX_AGE);
  }
  assert.ok(!b.jar.has("iqon_privacy"));
  assert.deepEqual((await b.current()).choices, all(true));
  await b.save({withdraw: ["marketing"]});
  assert.ok(b.jar.has(`${COOKIE}_w_marketing`));
  assert.deepEqual((await b.current()).choices, {...all(true), marketing: false});
});

test("unprefixed cookies planted on the production host are ignored", async () => {
  const b = browser();
  b.jar.set("iqon_privacy", `v2.1111.9.${Date.now()}.0`);
  assert.deepEqual((await b.current()).choices, privacy.UNKNOWN_CHOICES);
  const local = browser("localhost:3000");
  local.jar.set("iqon_privacy", `v2.1111.9.${Date.now()}.0`);
  assert.deepEqual((await local.current()).choices, all(true));
});

// Review finding F3 / S1: two requests sent from the same cookies, answered in either order.
for (const order of ["grant arrives last", "grant arrives first"]) {
  test(`overlapping grant and withdrawal: ${order}, the withdrawal stands`, async () => {
    const b = browser();
    await b.save({choices: {...all(true), marketing: false, saleOfData: false}, expectedVersion: (await b.current()).version});
    const version = (await b.current()).version;
    await tick();
    const [grant, withdraw] = await Promise.all([
      b.send({choices: all(true), expectedVersion: version}),
      (async () => {await tick(); return b.send({choices: all(false), expectedVersion: version});})(),
    ]);
    assert.equal(grant.status, 200); assert.equal(withdraw.status, 200);
    if (order === "grant arrives first") {grant.arrive(); withdraw.arrive();} else {withdraw.arrive(); grant.arrive();}
    const final = await b.current();
    assert.equal(final.choices.marketing, false); assert.equal(final.choices.saleOfData, false);
    assert.deepEqual(privacy.visitorConsent(final.choices, false), all(false));
  });
}

test("a delayed request carrying pre withdrawal cookies cannot restore the grant (review repro)", async () => {
  const b = browser();
  await grantAll(b);
  const captured = new Map(b.jar);
  const capturedVersion = (await b.current()).version;
  await tick();
  await b.save({choices: all(false), expectedVersion: capturedVersion});
  assert.deepEqual((await b.current()).choices, all(false));
  // Replay the earlier legitimate request with its original cookies.
  const replay = browser();
  for (const [key, value] of captured) replay.jar.set(key, value);
  const late = await replay.send({choices: all(true), expectedVersion: capturedVersion});
  // The server cannot see cookies the request did not carry, so it answers. Its response,
  // delivered to the browser after the withdrawal, must still not grant anything.
  assert.equal(late.status, 200);
  for (const [key, {value}] of late.cookies) b.jar.set(key, value);
  assert.deepEqual((await b.current()).choices, all(false));
  // A grant made later by a visitor who has seen the withdrawal does take effect.
  await tick();
  await grantAll(b);
  assert.deepEqual((await b.current()).choices, all(true));
});

test("a stale window cannot promote a grant, but its withdrawals still apply", async () => {
  const b = browser();
  await grantAll(b);
  const shown = (await b.current()).version;
  await tick();
  await b.save({withdraw: ["marketing", "saleOfData"]});
  const stale = await b.save({choices: {...all(true), analytics: false}, expectedVersion: shown});
  assert.equal(stale.status, 409);
  assert.deepEqual((await b.current()).choices, {analytics: false, marketing: false, preferences: true, saleOfData: false});
  const fresh = await b.save({choices: all(true), expectedVersion: (await b.current()).version});
  assert.equal(fresh.status, 200);
  assert.deepEqual((await b.current()).choices, all(true));
});

test("withdraw only requests apply to the current decision without a version", async () => {
  const b = browser();
  await grantAll(b);
  assert.equal((await b.save({withdraw: ["analytics"]})).status, 200);
  assert.deepEqual((await b.current()).choices, {...all(true), analytics: false});
  assert.equal((await b.save({withdraw: ["analytics"]})).status, 200, "repeating a withdrawal is harmless");
  assert.equal((await b.save({withdraw: ["analytics"], choices: all(true)})).status, 400);
});

test("GPC requests cannot save advertising or sharing grants, and GPC overrides stored grants", async () => {
  const gpc = browser("www.iqon.example", {"Sec-GPC": "1"});
  const blocked = await gpc.save({choices: all(true), expectedVersion: (await gpc.current()).version});
  assert.equal(blocked.status, 422);
  assert.deepEqual((await gpc.current()).choices, privacy.UNKNOWN_CHOICES);
  assert.equal((await gpc.save({choices: {...all(true), marketing: false, saleOfData: false}, expectedVersion: (await gpc.current()).version})).status, 200);
  const b = browser(); await grantAll(b);
  const overridden = browser("www.iqon.example", {"Sec-GPC": "1"});
  for (const [key, value] of b.jar) overridden.jar.set(key, value);
  const snapshot = await overridden.current();
  assert.deepEqual(snapshot.choices, all(true));
  assert.equal(snapshot.effective.marketing, false); assert.equal(snapshot.effective.saleOfData, false); assert.equal(snapshot.gpc, true);
});

test("forged, cross origin and malformed saves are rejected without changing the decision", async () => {
  const b = browser();
  await b.save({choices: all(false), expectedVersion: (await b.current()).version});
  const before = new Map(b.jar);
  const version = (await b.current()).version;
  const post = (body, headers = {}) => new Request(`${origin}/api/privacy`, {method: "POST", headers: {Origin: origin, "Content-Type": "application/json", ...headers}, body: typeof body === "string" ? body : JSON.stringify(body)});
  const cases = [
    post({choices: all("true"), expectedVersion: version}),
    post({choices: {...all(true), extra: true}, expectedVersion: version}),
    post({choices: all(true), expectedVersion: 1}),
    post({choices: all(true), expectedVersion: "latest"}),
    post({choices: all(true)}),
    post({choices: all(true), expectedVersion: version, revision: 99}),
    post({withdraw: ["ads"]}),
    post([all(true)]),
    post("not json"),
    post("x".repeat(2000)),
    post({choices: all(true), expectedVersion: version}, {Origin: "https://evil.example"}),
    post({choices: all(true), expectedVersion: version}, {"Content-Type": "text/plain"}),
  ];
  for (const request of cases) {
    const response = await b.raw(request);
    assert.ok([400, 403, 413, 415].includes(response.status), `unexpected ${response.status}`);
    assert.equal(response.cookies.size, 0);
  }
  assert.deepEqual(b.jar, before);
});

test("privacy links point at Shopify's published policy and opt out pages", () => {
  const previous = process.env.SHOPIFY_STORE_DOMAIN;
  process.env.SHOPIFY_STORE_DOMAIN = "https://evil.example";
  assert.deepEqual(routes.privacyLinks(), {policy: "https://nr9zd0-t5.myshopify.com/policies/privacy-policy", optOut: "https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"});
  process.env.SHOPIFY_STORE_DOMAIN = "iqon-test.myshopify.com";
  assert.equal(routes.privacyLinks().optOut, "https://iqon-test.myshopify.com/pages/data-sharing-opt-out");
  previous === undefined ? delete process.env.SHOPIFY_STORE_DOMAIN : process.env.SHOPIFY_STORE_DOMAIN = previous;
});
