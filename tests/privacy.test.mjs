import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";

// Exercises the real consent model and privacy route handlers against the real ledger on
// PostgreSQL (scripts/privacy-test-db.sh). Each request carries the cookies the browser
// held when it was sent. Model tests run without a database.
const url = process.env.PRIVACY_TEST_DATABASE_URL;
const skip = url ? false : "PRIVACY_TEST_DATABASE_URL not set (run through scripts/privacy-test-db.sh)";
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022});
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const ledgerModule = dataUrl(compile("../lib/privacy-ledger.ts")
  .replace('"./db/prisma"', JSON.stringify(dataUrl("export const prisma = null;")))
  .replace('"./db/database"', JSON.stringify(dataUrl("export const isDatabaseConfigured = () => false;")))
  .replace('"./privacy"', JSON.stringify(privacyUrl)));
// The route's ledger can be swapped per test: real Postgres, unconfigured, or failing.
const harnessUrl = dataUrl(`
  import {AsyncLocalStorage} from "node:async_hooks";
  export const scope = new AsyncLocalStorage();
  export const cookies = async () => ({get: key => scope.getStore().sent.has(key) ? {value: scope.getStore().sent.get(key)} : undefined, set: (key, value) => scope.getStore().set.push(key)});
  export const headers = async () => scope.getStore().headers;
  export const state = {ledger: null, reads: 0};
  export const privacyLedger = new Proxy({}, {get: (_, name) => state.ledger ? (...args) => {if (name === "read") state.reads++; return state.ledger[name](...args);} : undefined});
`);
const harness = await import(harnessUrl);
const privacy = await import(privacyUrl);
const { prismaPrivacyLedger } = await import(ledgerModule);
const routes = await import(dataUrl(compile("../lib/privacy.server.ts")
  .replace('"next/headers"', JSON.stringify(harnessUrl)).replace('"./privacy-ledger"', JSON.stringify(harnessUrl)).replace('"./privacy"', JSON.stringify(privacyUrl))));

const origin = "https://www.iqon.example";
const ID = "__Host-iqon_privacy_id";
const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
let client; let realLedger;
before(() => {if (url) {client = new PrismaClient({datasourceUrl: url}); realLedger = prismaPrivacyLedger(client);}});
after(async () => {await client?.$disconnect();});
const token = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

// A browser: a cookie jar, written only by the page itself (the server sets no cookies).
function browser({host = "www.iqon.example", gpc = false, id = token()} = {}) {
  const jar = new Map(id ? [[host.startsWith("localhost") ? "iqon_privacy_id" : ID, id]] : []);
  const run = async (handler, request) => {
    const store = {sent: new Map(jar), set: [], headers: new Headers({host, ...(gpc ? {"Sec-GPC": "1"} : {})})};
    const response = await harness.scope.run(store, () => handler(request));
    assert.deepEqual(store.set, [], "privacy routes never set cookies");
    assert.equal(response.headers.get("set-cookie"), null);
    return {status: response.status, body: await response.json()};
  };
  const post = (body, headers = {}) => new Request(`${origin}/api/privacy`, {method: "POST", headers: {Origin: origin, "Content-Type": "application/json", ...(gpc ? {"Sec-GPC": "1"} : {}), ...headers}, body: typeof body === "string" ? body : JSON.stringify(body)});
  return {
    jar,
    save: body => run(routes.savePrivacyResponse, post(body)),
    raw: request => run(routes.savePrivacyResponse, request),
    post,
    async current() {return (await run(routes.getPrivacyResponse, new Request(`${origin}/api/privacy`))).body.privacy;},
    get: () => run(routes.getPrivacyResponse, new Request(`${origin}/api/privacy`)),
  };
}
const saveAll = async (b, value) => b.save({choices: all(value), expectedVersion: (await b.current()).version});

test("model: unknown stays unexpressed, GPC and restrictions only remove permissions", () => {
  assert.equal(privacy.visitorConsent(privacy.UNKNOWN_CHOICES, false), null);
  assert.deepEqual(privacy.visitorConsent({analytics: true, marketing: null, preferences: null, saleOfData: false}, false), {analytics: true, saleOfData: false});
  assert.deepEqual(privacy.visitorConsent(all(true), true), {analytics: true, preferences: true, marketing: false, saleOfData: false});
  assert.deepEqual(privacy.visitorConsent(privacy.UNKNOWN_CHOICES, true), {marketing: false, saleOfData: false});
  assert.deepEqual(privacy.restrictChoices(all(true), {marketing: false}), {...all(true), marketing: false});
  for (const value of [{marketing: true}, {marketing: null}, {ads: false}, [], "x", null]) assert.throws(() => privacy.validateRestriction(value), privacy.PrivacyInputError);
  for (const value of [[], ["ads"], ["marketing", "marketing"], "marketing", null]) assert.throws(() => privacy.validateWithdrawals(value), privacy.PrivacyInputError);
  for (const value of [undefined, null, {}, {...all(true), extra: true}, {...all(true), marketing: "true"}]) assert.throws(() => privacy.validateChoices(value), privacy.PrivacyInputError);
  assert.equal(privacy.validIdentity(token()), true);
  for (const value of [undefined, "", "short", token() + "x", "a".repeat(42) + "!"]) assert.equal(privacy.validIdentity(value), false);
  assert.deepEqual(privacy.parseVersion("abcdef012345.7"), {prefix: "abcdef012345", revision: 7});
  for (const value of ["7", "abc.7", "abcdef012345.x", 7, null]) assert.equal(privacy.parseVersion(value), null);
  assert.equal(privacy.gpcHeader(new Headers({"Sec-GPC": "1"})), true);
});

test("a visitor who never saved a choice needs no database", async () => {
  harness.state.ledger = {read: () => {throw new Error("must not be called");}, save: () => {throw new Error("must not be called");}};
  const b = browser({id: null});
  const snapshot = await b.current();
  assert.deepEqual(snapshot.choices, privacy.UNKNOWN_CHOICES);
  assert.equal(snapshot.status, "ready"); assert.equal(snapshot.version, privacy.UNSAVED_VERSION);
  const save = await b.save({withdraw: ["marketing"]});
  assert.equal(save.status, 400, "saving needs the identity the page creates first");
});

test("choices persist in the ledger and are read back by a new request", {skip}, async () => {
  harness.state.ledger = realLedger;
  const b = browser();
  assert.deepEqual((await b.current()).choices, privacy.UNKNOWN_CHOICES);
  assert.equal((await saveAll(b, true)).status, 200);
  const snapshot = await b.current();
  assert.deepEqual(snapshot.choices, all(true)); assert.equal(snapshot.status, "ready");
  assert.match(snapshot.version, /^[0-9a-f]{12}\.1$/);
  // Only the hash of the browser token is stored.
  const rows = await client.$queryRawUnsafe("SELECT visitor_key FROM storefront_privacy_consents");
  assert.ok(rows.every(row => !row.visitor_key.includes(b.jar.get(ID))));
});

test("review F3/R1-B: requests made from the same shown decision are ordered by the ledger, not by clocks", {skip}, async () => {
  harness.state.ledger = realLedger;
  const realNow = Date.now; Date.now = () => 1_800_000_000_000; // every request in the same millisecond
  try {
    const b = browser();
    await saveAll(b, true);
    const shown = (await b.current()).version;
    // Delivered in either order, the stale grant cannot follow the withdrawal.
    const [withdraw, regrant] = await Promise.all([b.save({withdraw: ["marketing", "saleOfData"]}), b.save({choices: all(true), expectedVersion: shown})]);
    assert.equal(withdraw.status, 200);
    assert.ok([200, 409].includes(regrant.status));
    const final = await b.current();
    assert.equal(final.choices.marketing, false); assert.equal(final.choices.saleOfData, false);
    // Replaying the old grant later is refused: its version is no longer current.
    assert.equal((await b.save({choices: all(true), expectedVersion: shown})).status, 409);
    assert.equal((await b.current()).choices.marketing, false);
  } finally {Date.now = realNow;}
});

test("a stale form cannot promote a grant, its withdrawals still apply, and a fresh regrant works", {skip}, async () => {
  harness.state.ledger = realLedger;
  const b = browser();
  await saveAll(b, true);
  const shown = (await b.current()).version;
  await b.save({withdraw: ["marketing", "saleOfData"]});
  const stale = await b.save({choices: {...all(true), analytics: false}, expectedVersion: shown});
  assert.equal(stale.status, 409);
  assert.deepEqual((await b.current()).choices, {analytics: false, marketing: false, preferences: true, saleOfData: false});
  assert.equal((await saveAll(b, true)).status, 200);
  assert.deepEqual((await b.current()).choices, all(true));
});

test("a version from another identity never authorizes a grant", {skip}, async () => {
  harness.state.ledger = realLedger;
  const a = browser(); const b = browser();
  await saveAll(a, false); await saveAll(b, false);
  const response = await b.save({choices: all(true), expectedVersion: (await a.current()).version});
  assert.equal(response.status, 409);
  assert.deepEqual((await b.current()).choices, all(false));
});

test("GPC requests cannot newly grant advertising or sharing, and GPC overrides stored grants", {skip}, async () => {
  harness.state.ledger = realLedger;
  const gpc = browser({gpc: true});
  assert.equal((await saveAll(gpc, true)).status, 422);
  assert.notEqual((await gpc.current()).choices.marketing, true);
  assert.equal((await gpc.save({choices: {...all(true), marketing: false, saleOfData: false}, expectedVersion: (await gpc.current()).version})).status, 200);
  const plain = browser(); await saveAll(plain, true);
  const withGpc = browser({gpc: true, id: plain.jar.get(ID)});
  const snapshot = await withGpc.current();
  assert.deepEqual(snapshot.choices, all(true));
  assert.equal(snapshot.effective.marketing, false); assert.equal(snapshot.effective.saleOfData, false);
});

test("forged, cross origin and malformed saves are rejected without changing the decision", {skip}, async () => {
  harness.state.ledger = realLedger;
  const b = browser();
  await saveAll(b, false);
  const before = await b.current();
  const cases = [
    b.post({choices: all("true"), expectedVersion: before.version}),
    b.post({choices: {...all(true), extra: true}, expectedVersion: before.version}),
    b.post({choices: all(true), expectedVersion: 1}),
    b.post({choices: all(true), expectedVersion: "latest"}),
    b.post({choices: all(true)}),
    b.post({choices: all(true), expectedVersion: before.version, revision: 99}),
    b.post({withdraw: ["ads"]}), b.post({withdraw: ["marketing"], choices: all(true)}),
    b.post([all(true)]), b.post("not json"), b.post("x".repeat(2000)),
    b.post({choices: all(true), expectedVersion: before.version}, {Origin: "https://evil.example"}),
    b.post({choices: all(true), expectedVersion: before.version}, {"Content-Type": "text/plain"}),
  ];
  for (const request of cases) assert.ok([400, 403, 413, 415].includes((await b.raw(request)).status));
  const badId = browser({id: "not-a-token"});
  assert.equal((await badId.save({withdraw: ["marketing"]})).status, 400);
  assert.deepEqual(await b.current(), before);
});

test("ledger outage: reads report unavailable, saves fail, nothing is reported as granted", async () => {
  harness.state.ledger = {read: async () => {throw new Error("connection refused");}, save: async () => {throw new Error("connection refused");}};
  const b = browser();
  const read = await b.get();
  assert.equal(read.status, 503);
  assert.equal(read.body.privacy.status, "unavailable");
  assert.deepEqual(read.body.privacy.choices, privacy.UNKNOWN_CHOICES);
  assert.equal((await b.save({withdraw: ["marketing"]})).status, 503);
  harness.state.ledger = null; // no database configured for this deployment
  assert.equal((await b.get()).status, 503);
  assert.equal((await b.save({withdraw: ["marketing"]})).status, 503);
  assert.equal((await browser({id: null}).get()).status, 200, "visitors without saved choices are unaffected");
});

test("privacy links point at Shopify's published policy and opt out pages", () => {
  const previous = process.env.SHOPIFY_STORE_DOMAIN;
  process.env.SHOPIFY_STORE_DOMAIN = "https://evil.example";
  assert.deepEqual(routes.privacyLinks(), {policy: "https://nr9zd0-t5.myshopify.com/policies/privacy-policy", optOut: "https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"});
  process.env.SHOPIFY_STORE_DOMAIN = "iqon-test.myshopify.com";
  assert.equal(routes.privacyLinks().optOut, "https://iqon-test.myshopify.com/pages/data-sharing-opt-out");
  previous === undefined ? delete process.env.SHOPIFY_STORE_DOMAIN : process.env.SHOPIFY_STORE_DOMAIN = previous;
});
