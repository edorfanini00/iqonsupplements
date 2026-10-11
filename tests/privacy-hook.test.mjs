import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

// Runs the real usePrivacy hook in jsdom against the real privacy route and the real
// ledger on PostgreSQL (scripts/privacy-test-db.sh). Several hooks in one document stand in
// for tabs: they share cookies, while their memory is separate. Each fetch carries the
// cookies the browser held when it was sent.
const url = process.env.PRIVACY_TEST_DATABASE_URL;
const skip = url ? false : "PRIVACY_TEST_DATABASE_URL not set (run through scripts/privacy-test-db.sh)";
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React}}).outputText;
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const harnessUrl = dataUrl(`
  import {AsyncLocalStorage} from "node:async_hooks";
  export const scope = new AsyncLocalStorage();
  export const cookies = async () => ({get: key => scope.getStore().sent.has(key) ? {value: scope.getStore().sent.get(key)} : undefined, set: () => {throw new Error("privacy routes never set cookies");}});
  export const headers = async () => scope.getStore().headers;
  export const state = {ledger: null};
  export const privacyLedger = {read: (...a) => state.ledger.read(...a), save: (...a) => state.ledger.save(...a)};
`);
const harness = await import(harnessUrl);
const { prismaPrivacyLedger } = await import(dataUrl(compile("../lib/privacy-ledger.ts")
  .replace('"./db/prisma"', JSON.stringify(dataUrl("export const prisma = null;")))
  .replace('"./db/database"', JSON.stringify(dataUrl("export const isDatabaseConfigured = () => false;")))
  .replace('"./privacy"', JSON.stringify(privacyUrl))));
const routes = await import(dataUrl(compile("../lib/privacy.server.ts")
  .replace('"next/headers"', JSON.stringify(harnessUrl)).replace('"./privacy-ledger"', JSON.stringify(harnessUrl)).replace('"./privacy"', JSON.stringify(privacyUrl))));

const { JSDOM } = await import("jsdom");
const origin = "https://www.iqon.example";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {url: origin});
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "StorageEvent", "location"]) Object.defineProperty(globalThis, key, {configurable: true, value: dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { renderHook, act, cleanup } = await import("@testing-library/react");
const reactUrl = pathToFileURL(fs.realpathSync(new URL("../node_modules/react/index.js", import.meta.url))).href;
const stub = dataUrl("export const Sheet=()=>null; export const SheetContent=()=>null; export const SheetTitle=()=>null; export const SheetDescription=()=>null; export const Switch=()=>null;");
const hooks = await import(dataUrl(compile("../app/privacy-choices.tsx").replace('"react"', JSON.stringify(reactUrl)).replace('"@/lib/privacy"', JSON.stringify(privacyUrl))
  .replace('"@/components/ui/sheet"', JSON.stringify(stub)).replace('"@/components/ui/switch"', JSON.stringify(stub))));

const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
const ID = "__Host-iqon_privacy_id";
const network = {down: false, posts: [], duringPost: null};
const browserCookies = () => new Map(document.cookie.split("; ").filter(Boolean).map(part => [part.slice(0, part.indexOf("=")), part.slice(part.indexOf("=") + 1)]));
async function serve(request) {
  const store = {sent: browserCookies(), headers: new Headers({host: "www.iqon.example"})};
  return harness.scope.run(store, () => request.method === "POST" ? routes.savePrivacyResponse(request) : routes.getPrivacyResponse());
}
globalThis.fetch = async (path, options = {}) => {
  const request = new Request(new URL(path, origin), {...options, headers: {...options.headers, Origin: origin}});
  if (options.method === "POST") {
    network.posts.push(JSON.parse(options.body));
    if (network.down) throw new TypeError("Failed to fetch");
    if (network.duringPost) {const during = network.duringPost; network.duringPost = null; await during();}
  }
  return serve(request);
};
const current = async () => (await (await serve(new Request(`${origin}/api/privacy`))).json()).privacy;
const settle = () => act(async () => {for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 5));});
const clearCookies = () => {for (const name of browserCookies().keys()) document.cookie = `${name}=; Path=/; Max-Age=0; Secure`;};
let client;
before(() => {if (url) {client = new PrismaClient({datasourceUrl: url}); harness.state.ledger = prismaPrivacyLedger(client);}});
after(async () => {cleanup(); await client?.$disconnect();});

async function tab() {
  const initial = await current();
  const hook = renderHook(() => hooks.usePrivacy(initial));
  await settle();
  return hook;
}
async function fresh() {
  cleanup(); clearCookies(); localStorage.clear(); network.down = false; network.posts.length = 0; network.duringPost = null;
  return tab();
}
const saveFrom = (hook, choices) => act(async () => {await hook.result.current.save(choices, {version: hook.result.current.snapshot.version, basedAt: Date.now()});});

test("a first save creates the browser identity; the server never sets it", {skip}, async () => {
  const a = await fresh();
  assert.equal(browserCookies().has(ID), false, "no identity until the visitor saves");
  await saveFrom(a, all(true));
  assert.match(browserCookies().get(ID), /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual((await current()).choices, all(true));
  assert.equal(a.result.current.notice.text, "Your privacy choices are saved.");
});

test("identity bootstrap: two first tabs saving at once share one identity and lose nothing", {skip}, async () => {
  const a = await fresh(); const b = await tab();
  // Neither tab has an identity yet; both save in the same turn.
  await act(async () => {await Promise.all([
    a.result.current.save(all(false), {version: a.result.current.snapshot.version, basedAt: Date.now()}),
    b.result.current.save(all(true), {version: b.result.current.snapshot.version, basedAt: Date.now()}),
  ]);});
  await settle();
  assert.equal([...browserCookies().keys()].filter(name => name === ID).length, 1, "one identity cookie");
  // Whichever request the ledger orders first, a grant made from the same unknown state
  // can never follow the withdrawal: the decline stands and nothing is left pending.
  assert.deepEqual((await current()).choices, all(false));
  assert.equal([...browserCookies().keys()].some(name => name.includes("pending")), false);
});

test("review F1/S2: a pending withdrawal from another tab restricts this tab's checkout at once", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const b = await tab();
  const before = b.result.current.epoch();
  network.down = true;
  await saveFrom(a, {...all(true), marketing: false, saleOfData: false});
  // No notification is delivered to B; it rereads the shared pending cookies itself.
  assert.notEqual(b.result.current.epoch(), before, "an in flight checkout in B is discarded");
  assert.deepEqual(b.result.current.checkoutContext().restrict, {marketing: false, saleOfData: false});
});

test("a pending withdrawal counts at checkout even if no notification reached this tab", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const before = a.result.current.epoch();
  // Another tab (or a tab whose BroadcastChannel and storage events never arrive) wrote it.
  document.cookie = `__Host-iqon_privacy_pending_saleOfData=${Date.now()}-peer; Path=/; Secure`;
  assert.notEqual(a.result.current.epoch(), before, "checkout's freshness check sees the change");
  assert.deepEqual(a.result.current.checkoutContext().restrict, {saleOfData: false});
});

test("review R1-C: full page storage plus a failed save still restricts every tab", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const b = await tab();
  const original = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = function () {throw new dom.window.DOMException("quota", "QuotaExceededError");};
  try {
    network.down = true;
    await saveFrom(a, all(false));
    assert.match(a.result.current.notice.text, /stays off in this browser/);
    assert.deepEqual(b.result.current.checkoutContext().restrict, all(false));
    // A third tab opened later also sees it, and retries the save once the network is back.
    network.down = false;
    await tab();
    await settle();
    assert.deepEqual((await current()).choices, all(false));
    assert.equal([...browserCookies().keys()].some(name => name.includes("pending")), false, "cleared once the ledger shows it");
  } finally {dom.window.Storage.prototype.setItem = original;}
});

test("if the browser refuses the pending cookie, the message says the withdrawal holds in this tab only", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.Document.prototype, "cookie");
  Object.defineProperty(document, "cookie", {configurable: true, get: () => descriptor.get.call(document), set: value => {if (!value.includes("pending")) descriptor.set.call(document, value);}});
  try {
    network.down = true;
    await saveFrom(a, {...all(true), marketing: false});
    assert.match(a.result.current.notice.text, /stays off in this tab only/);
    assert.equal(a.result.current.checkoutContext().restrict.marketing, false);
  } finally {delete document.cookie;}
});

test("clearing a pending withdrawal never removes a newer one recorded by another tab", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, {...all(true), marketing: false});
  document.cookie = `__Host-iqon_privacy_pending_marketing=${Date.now() - 5000}-older; Path=/; Secure`;
  network.duringPost = async () => {document.cookie = `__Host-iqon_privacy_pending_marketing=${Date.now()}-newer; Path=/; Secure`;};
  await act(async () => {await a.result.current.save(all(true), {version: a.result.current.snapshot.version, basedAt: Date.now() - 1000});});
  assert.match(browserCookies().get("__Host-iqon_privacy_pending_marketing") || "", /-newer$/);
  assert.equal(a.result.current.checkoutContext().restrict.marketing, false);
});

test("review F2/S3: switches from an older decision cannot restore a grant withdrawn elsewhere", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const formBase = {version: a.result.current.snapshot.version, basedAt: Date.now()};
  const b = await tab(); await saveFrom(b, all(false));
  await act(async () => {await a.result.current.refresh();});
  assert.equal(a.result.current.displayed.marketing, false);
  await act(async () => {await a.result.current.save({...all(true), analytics: false}, formBase);});
  assert.equal(network.posts.at(-1).expectedVersion, formBase.version);
  assert.match(a.result.current.notice.text, /changed in another window/);
  assert.deepEqual((await current()).choices, all(false));
  await saveFrom(a, all(true));
  assert.deepEqual((await current()).choices, all(true), "a fresh informed regrant works");
});

test("an older privacy read answered last never replaces a newer one", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const realFetch = globalThis.fetch;
  let releaseOld;
  globalThis.fetch = async (path, options = {}) => {
    if (!options.method && !releaseOld) {const snapshot = await realFetch(path, options); await new Promise(resolve => {releaseOld = resolve;}); return snapshot;}
    return realFetch(path, options);
  };
  try {
    const old = a.result.current.refresh();
    await new Promise(resolve => setTimeout(resolve, 20));
    await saveFrom(a, all(false));
    await act(async () => {releaseOld(); await old;});
    assert.deepEqual(a.result.current.snapshot.choices, all(false));
  } finally {globalThis.fetch = realFetch;}
});

test("an unavailable ledger keeps the last choices shown, marks them unavailable, and keeps withdrawals pending", {skip}, async () => {
  const a = await fresh(); await saveFrom(a, all(true));
  const real = harness.state.ledger;
  harness.state.ledger = {read: async () => {throw new Error("down");}, save: async () => {throw new Error("down");}};
  try {
    await act(async () => {await a.result.current.refresh();});
    assert.equal(a.result.current.snapshot.status, "unavailable");
    assert.deepEqual(a.result.current.snapshot.choices, all(true));
    await saveFrom(a, {...all(true), marketing: false});
    assert.match(a.result.current.notice.text, /right now.*stays off in this browser/);
    assert.equal(a.result.current.checkoutContext().restrict.marketing, false);
    assert.equal("version" in a.result.current.checkoutContext(), false, "no version binding while the ledger is down");
  } finally {harness.state.ledger = real;}
  await act(async () => {await a.result.current.refresh(); window.dispatchEvent(new dom.window.Event("online"));});
  await settle();
  assert.equal((await current()).choices.marketing, false);
});
