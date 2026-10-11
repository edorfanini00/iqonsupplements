import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Exercises the real consent model and privacy route handlers with an in memory cookie jar.
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
});
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const bindingsUrl = dataUrl(`
  export const jar = new Map();
  export const cookieOptions = new Map();
  export const requestHeaders = new Headers();
  export const cookies = async () => ({
    get: key => jar.has(key) ? {value: jar.get(key)} : undefined,
    set: (key, value, options) => {jar.set(key, value); cookieOptions.set(key, options);}
  });
  export const headers = async () => requestHeaders;
`);
const { jar, cookieOptions, requestHeaders } = await import(bindingsUrl);
const privacy = await import(privacyUrl);
const routes = await import(dataUrl(compile("../lib/privacy.server.ts")
  .replace('"next/headers"', JSON.stringify(bindingsUrl)).replace('"./privacy"', JSON.stringify(privacyUrl))));

const origin = "https://www.iqon.example";
const COOKIE = "__Host-iqon_privacy";
const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
function reset(host = "www.iqon.example") {
  jar.clear(); cookieOptions.clear();
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
  requestHeaders.set("host", host);
}
const post = (body, extra = {}) => new Request(`${origin}/api/privacy`, {
  method: "POST", headers: {Origin: origin, "Content-Type": "application/json", ...extra}, body: typeof body === "string" ? body : JSON.stringify(body),
});
async function save(choices, expectedRevision, extra) {
  const response = await routes.savePrivacyResponse(post({choices, expectedRevision}, extra));
  return {status: response.status, body: await response.json()};
}
const current = async () => (await (await routes.getPrivacyResponse()).json()).privacy;

test("unknown is never treated as granted, and malformed or expired cookies read as unknown", () => {
  const now = Date.parse("2026-10-11T12:00:00Z"); const seconds = now / 1000;
  for (const value of [undefined, "", "granted", "v1.1111", "v1.1111.1", "v1.11x1.1.1760000000", "v2.1111.1.1760000000", "v1.1111.1.0"]) {
    const state = privacy.parsePrivacyCookie(value, now);
    assert.deepEqual(state.choices, privacy.UNKNOWN_CHOICES);
    assert.equal(privacy.advertisingAllowed(state.choices, false), false);
    assert.equal(privacy.visitorConsent(state.choices, false), null);
  }
  assert.deepEqual(privacy.parsePrivacyCookie(`v1.1111.4.${seconds - privacy.PRIVACY_MAX_AGE - 1}`, now).choices, privacy.UNKNOWN_CHOICES);
  assert.deepEqual(privacy.parsePrivacyCookie(`v1.1111.4.${seconds + 3600}`, now).choices, privacy.UNKNOWN_CHOICES);
  const state = {choices: {analytics: true, marketing: false, preferences: null, saleOfData: true}, revision: 7, decidedAt: seconds - 10};
  assert.deepEqual(privacy.parsePrivacyCookie(privacy.encodePrivacyCookie(state), now), state);
});

test("granted, denied, partial and GPC decisions map faithfully to Shopify VisitorConsent", () => {
  assert.deepEqual(privacy.visitorConsent(all(true), false), all(true));
  assert.equal(privacy.advertisingAllowed(all(true), false), true);
  assert.deepEqual(privacy.visitorConsent(all(false), false), all(false));
  assert.equal(privacy.advertisingAllowed(all(false), false), false);
  // Only expressed choices are sent; no preference is omitted rather than invented.
  assert.deepEqual(privacy.visitorConsent({analytics: true, marketing: null, preferences: null, saleOfData: false}, false), {analytics: true, saleOfData: false});
  assert.equal(privacy.advertisingAllowed({...all(true), saleOfData: null}, false), false);
  // GPC is an expressed opt out of advertising and sale or sharing, and overrides a stored grant.
  assert.deepEqual(privacy.visitorConsent(all(true), true), {analytics: true, preferences: true, marketing: false, saleOfData: false});
  assert.deepEqual(privacy.visitorConsent(privacy.UNKNOWN_CHOICES, true), {marketing: false, saleOfData: false});
  assert.equal(privacy.advertisingAllowed(all(true), true), false);
  assert.equal(privacy.gpcHeader(new Headers({"Sec-GPC": "1"})), true);
  assert.equal(privacy.gpcHeader(new Headers({"Sec-GPC": "0"})), false);
  assert.equal(privacy.gpcHeader(new Headers()), false);
});

test("restrictions can only withdraw and reject any attempt to grant", () => {
  assert.deepEqual(privacy.restrictChoices(all(true), {marketing: false}), {...all(true), marketing: false});
  assert.deepEqual(privacy.restrictChoices(all(null), {marketing: false}), {...all(null), marketing: false});
  for (const value of [{marketing: true}, {marketing: null}, {marketing: "false"}, {ads: false}, [], "x", null])
    assert.throws(() => privacy.validateRestriction(value), privacy.PrivacyInputError);
  assert.deepEqual(privacy.validateRestriction(undefined), {});
  for (const value of [undefined, null, [], {}, {...all(true), extra: true}, {...all(true), marketing: "true"}, {...all(true), marketing: 1}, {analytics: true}])
    assert.throws(() => privacy.validateChoices(value), privacy.PrivacyInputError);
  assert.deepEqual(privacy.grantsAdded(all(false), {...all(false), marketing: true}), ["marketing"]);
  assert.deepEqual(privacy.grantsAdded(all(true), all(false)), []);
});

test("privacy choices persist in a host only, httpOnly, secure cookie and survive a new request", async () => {
  reset();
  assert.deepEqual((await current()).choices, privacy.UNKNOWN_CHOICES);
  const saved = await save(all(true), 0);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.privacy.revision, 1); assert.equal(saved.body.privacy.advertisingAllowed, true);
  const options = cookieOptions.get(COOKIE);
  assert.equal(options.httpOnly, true); assert.equal(options.secure, true); assert.equal(options.path, "/");
  assert.equal(options.sameSite, "lax"); assert.equal(options.domain, undefined);
  assert.equal(options.maxAge, privacy.PRIVACY_MAX_AGE);
  assert.ok(!jar.has("iqon_privacy"));
  const reread = await current();
  assert.deepEqual(reread.choices, all(true)); assert.equal(reread.revision, 1);
});

test("an unprefixed cookie planted on the production host is ignored", async () => {
  reset();
  jar.set("iqon_privacy", `v1.1111.9.${Math.floor(Date.now() / 1000)}`);
  assert.deepEqual((await current()).choices, privacy.UNKNOWN_CHOICES);
  reset("localhost:3000");
  jar.set("iqon_privacy", `v1.1111.9.${Math.floor(Date.now() / 1000)}`);
  assert.deepEqual((await current()).choices, all(true));
});

test("granted to withdrawn always applies, even from an outdated window", async () => {
  reset();
  await save(all(true), 0);
  await save({...all(true), analytics: false}, 1);
  // This window still shows analytics on. That stale grant is refused; the withdrawal applies.
  const withdrawn = await save({...all(true), marketing: false, saleOfData: false}, 0);
  assert.equal(withdrawn.status, 409);
  assert.deepEqual(withdrawn.body.privacy.choices, {analytics: false, marketing: false, preferences: true, saleOfData: false});
  assert.equal(withdrawn.body.privacy.advertisingAllowed, false);
  assert.deepEqual((await current()).choices, withdrawn.body.privacy.choices);
  const plain = await save(all(false), 0);
  assert.equal(plain.status, 200);
  assert.deepEqual((await current()).choices, all(false));
});

test("a stale window cannot promote a grant over a newer withdrawal", async () => {
  reset();
  await save(all(true), 0);                 // revision 1, both windows see it
  await save(all(false), 1);                // window B withdraws: revision 2
  const stale = await save(all(true), 1);   // window A still believes revision 1
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body.privacy.choices, all(false));
  assert.deepEqual((await current()).choices, all(false));
  const fresh = await save(all(true), 2);
  assert.equal(fresh.status, 200);
});

test("GPC requests cannot save advertising or sharing grants", async () => {
  reset();
  const blocked = await save(all(true), 0, {"Sec-GPC": "1"});
  assert.equal(blocked.status, 422);
  assert.deepEqual((await current()).choices, privacy.UNKNOWN_CHOICES);
  await save(all(true), 0);
  const withdrawal = await save({...all(true), analytics: false, marketing: true}, 1, {"Sec-GPC": "1"});
  assert.equal(withdrawal.status, 200);
  reset();
  await save({...all(true), marketing: false}, 0);
  const mixed = await save({...all(true), analytics: false}, 1, {"Sec-GPC": "1"});
  assert.equal(mixed.status, 422);
  assert.deepEqual((await current()).choices, {...all(true), marketing: false, analytics: false});
  reset();
  const allowed = await save({...all(true), marketing: false, saleOfData: false}, 0, {"Sec-GPC": "1"});
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.privacy.gpc, true);
  // A grant saved without GPC is overridden while the signal is present.
  reset(); await save(all(true), 0);
  requestHeaders.set("sec-gpc", "1");
  const overridden = await current();
  assert.deepEqual(overridden.choices, all(true));
  assert.equal(overridden.effective.marketing, false); assert.equal(overridden.effective.saleOfData, false);
  assert.equal(overridden.advertisingAllowed, false);
});

test("forged, cross origin and malformed saves are rejected without changing the decision", async () => {
  reset();
  await save(all(false), 0);
  const before = jar.get(COOKIE);
  const cases = [
    post({choices: all("true"), expectedRevision: 1}),
    post({choices: {...all(true), extra: true}, expectedRevision: 1}),
    post({choices: all(true), expectedRevision: "1"}),
    post({choices: all(true), expectedRevision: 1.5}),
    post({choices: all(true), expectedRevision: -1}),
    post({choices: all(true)}),
    post({choices: all(true), expectedRevision: 1, revision: 99}),
    post([all(true)]),
    post("not json"),
    post("x".repeat(2000)),
    new Request(`${origin}/api/privacy`, {method: "POST", headers: {Origin: "https://evil.example", "Content-Type": "application/json"}, body: JSON.stringify({choices: all(true), expectedRevision: 1})}),
    new Request(`${origin}/api/privacy`, {method: "POST", headers: {Origin: origin, "Content-Type": "text/plain"}, body: JSON.stringify({choices: all(true), expectedRevision: 1})}),
  ];
  for (const request of cases) {
    const response = await routes.savePrivacyResponse(request);
    assert.ok([400, 403, 413, 415].includes(response.status), `unexpected ${response.status}`);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  assert.equal(jar.get(COOKIE), before);
});

test("privacy links point at Shopify's published policy and opt out pages", () => {
  const previous = process.env.SHOPIFY_STORE_DOMAIN;
  process.env.SHOPIFY_STORE_DOMAIN = "https://evil.example";
  assert.deepEqual(routes.privacyLinks(), {policy: "https://nr9zd0-t5.myshopify.com/policies/privacy-policy", optOut: "https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"});
  process.env.SHOPIFY_STORE_DOMAIN = "iqon-test.myshopify.com";
  assert.equal(routes.privacyLinks().optOut, "https://iqon-test.myshopify.com/pages/data-sharing-opt-out");
  previous === undefined ? delete process.env.SHOPIFY_STORE_DOMAIN : process.env.SHOPIFY_STORE_DOMAIN = previous;
});
