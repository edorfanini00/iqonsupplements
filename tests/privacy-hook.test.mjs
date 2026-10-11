import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { pathToFileURL } from "node:url";

// Runs the real usePrivacy hook in jsdom against the real privacy route. Every fetch gets
// the cookies the browser held when it was sent, as over a real network.
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React}}).outputText;
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const bindingsUrl = dataUrl(`
  import {AsyncLocalStorage} from "node:async_hooks";
  export const scope = new AsyncLocalStorage();
  export const cookies = async () => ({get: key => scope.getStore().sent.has(key) ? {value: scope.getStore().sent.get(key)} : undefined, set: (key, value) => scope.getStore().received.set(key, value)});
  export const headers = async () => scope.getStore().headers;
`);
const { scope } = await import(bindingsUrl);
const routes = await import(dataUrl(compile("../lib/privacy.server.ts").replace('"next/headers"', JSON.stringify(bindingsUrl)).replace('"./privacy"', JSON.stringify(privacyUrl))));

const { JSDOM } = await import("jsdom");
const origin = "https://www.iqon.example";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {url: origin});
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "StorageEvent"]) Object.defineProperty(globalThis, key, {configurable: true, value: dom.window[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { renderHook, act, cleanup } = await import("@testing-library/react");
const reactUrl = pathToFileURL(fs.realpathSync(new URL("../node_modules/react/index.js", import.meta.url))).href;
const stub = dataUrl("export const Sheet=()=>null; export const SheetContent=()=>null; export const SheetTitle=()=>null; export const SheetDescription=()=>null; export const Switch=()=>null;");
const hooks = await import(dataUrl(compile("../app/privacy-choices.tsx").replace('"react"', JSON.stringify(reactUrl)).replace('"@/lib/privacy"', JSON.stringify(privacyUrl))
  .replace('"@/components/ui/sheet"', JSON.stringify(stub)).replace('"@/components/ui/switch"', JSON.stringify(stub))));

const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
const jar = new Map();
const network = {down: false, posts: [], duringPost: null};
async function serve(request) {
  const store = {sent: new Map(jar), received: new Map(), headers: new Headers({host: "www.iqon.example"})};
  const response = await scope.run(store, () => request.method === "POST" ? routes.savePrivacyResponse(request) : routes.getPrivacyResponse());
  for (const [key, value] of store.received) jar.set(key, value);
  return response;
}
globalThis.fetch = async (url, options = {}) => {
  if (options.method === "POST") {
    network.posts.push(JSON.parse(options.body));
    if (network.down) throw new TypeError("Failed to fetch");
    if (network.duringPost) {const during = network.duringPost; network.duringPost = null; await during();}
  }
  return serve(new Request(new URL(url, origin), {...options, headers: {...options.headers, Origin: origin}}));
};
const current = async () => (await (await serve(new Request(`${origin}/api/privacy`))).json()).privacy;
// Another tab saving directly, then announcing it the way the hook does.
async function otherTab(body) {
  await serve(new Request(`${origin}/api/privacy`, {method: "POST", headers: {Origin: origin, "Content-Type": "application/json"}, body: JSON.stringify(body)}));
  const saved = await current();
  localStorage.setItem("iqon-privacy-sync", `${saved.version}:${Date.now()}`);
  window.dispatchEvent(new StorageEvent("storage", {key: "iqon-privacy-sync"}));
  return saved;
}
const settle = () => act(async () => {for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 5));});
async function fresh(start) {
  cleanup(); localStorage.clear(); jar.clear(); network.down = false; network.posts.length = 0; network.duringPost = null;
  if (start) await otherTab(start);
  const initial = await current();
  const hook = renderHook(() => hooks.usePrivacy(initial));
  await settle();
  return hook;
}

test("review F1/S2: a pending withdrawal from another tab restricts this tab's checkout at once", async () => {
  const {result} = await fresh({choices: all(true), expectedVersion: "0.0.0"});
  const before = result.current.epoch();
  assert.deepEqual(result.current.checkoutContext().restrict, {});
  // The other tab could not save its withdrawal; it is only in shared storage.
  await act(async () => {
    localStorage.setItem("iqon-privacy-pending:marketing", `${Date.now()}:peer`);
    localStorage.setItem("iqon-privacy-pending:saleOfData", `${Date.now()}:peer`);
    window.dispatchEvent(new StorageEvent("storage", {key: "iqon-privacy-pending:marketing"}));
  });
  assert.notEqual(result.current.epoch(), before, "an in flight checkout is discarded");
  assert.deepEqual(result.current.checkoutContext().restrict, {marketing: false, saleOfData: false});
  assert.equal(result.current.displayed.marketing, false);
});

test("checkout reads shared pending withdrawals even if no storage event arrived", async () => {
  const {result} = await fresh({choices: all(true), expectedVersion: "0.0.0"});
  localStorage.setItem("iqon-privacy-pending:analytics", `${Date.now()}:peer`);
  assert.deepEqual(result.current.checkoutContext().restrict, {analytics: false});
});

test("a failed withdrawal stays pending across tabs and is saved by whichever tab retries", async () => {
  const {result} = await fresh({choices: all(true), expectedVersion: "0.0.0"});
  network.down = true;
  const shown = result.current.snapshot.version;
  await act(async () => {await result.current.save(all(false), {version: shown, basedAt: Date.now()});});
  assert.match(result.current.notice.text, /couldn’t save.*stays off in this browser/);
  assert.deepEqual((await current()).choices, all(true), "server still holds the grant");
  assert.ok(localStorage.getItem("iqon-privacy-pending:marketing"), "shared with other tabs");
  assert.deepEqual(result.current.checkoutContext().restrict, all(false));
  // A second tab opens while the network is back and replays the withdrawal.
  network.down = false;
  const second = renderHook(() => hooks.usePrivacy(result.current.snapshot));
  await settle();
  assert.deepEqual((await current()).choices, all(false));
  assert.equal(localStorage.getItem("iqon-privacy-pending:marketing"), null, "cleared once the saved decision shows it");
  second.unmount();
});

test("clearing a pending withdrawal never removes a newer one recorded by another tab", async () => {
  const {result} = await fresh({choices: all(true), expectedVersion: "0.0.0"});
  // This tab's form showed an older pending withdrawal of marketing, and the visitor grants
  // marketing again. While that save is in flight another tab records a newer withdrawal.
  localStorage.setItem("iqon-privacy-pending:marketing", `${Date.now() - 5000}:older`);
  network.duringPost = async () => {localStorage.setItem("iqon-privacy-pending:marketing", `${Date.now()}:newer`);};
  await act(async () => {await result.current.save(all(true), {version: result.current.snapshot.version, basedAt: Date.now() - 1000});});
  assert.equal((await current()).choices.marketing, true);
  assert.match(localStorage.getItem("iqon-privacy-pending:marketing") || "", /:newer$/, "only the older withdrawal the visitor saw is cleared");
  assert.equal(result.current.checkoutContext().restrict.marketing, false, "the newer one still restricts checkout");
});

test("a deliberate grant from a form that showed the pending withdrawal clears it", async () => {
  const {result} = await fresh({choices: all(true), expectedVersion: "0.0.0"});
  localStorage.setItem("iqon-privacy-pending:marketing", `${Date.now() - 5000}:seen`);
  await act(async () => {await result.current.save(all(true), {version: result.current.snapshot.version, basedAt: Date.now() - 1000});});
  assert.equal(localStorage.getItem("iqon-privacy-pending:marketing"), null);
  assert.deepEqual(result.current.checkoutContext().restrict, {});
});

test("review F2/S3: switches from an older decision cannot restore a grant withdrawn elsewhere", async () => {
  const {result} = await fresh({choices: all(true), expectedVersion: "0.0.0"});
  const formBase = {version: result.current.snapshot.version, basedAt: Date.now()};
  const staleDraft = all(true);
  await act(async () => {await otherTab({withdraw: ["analytics", "marketing", "preferences", "saleOfData"]});});
  await settle();
  assert.equal(result.current.displayed.marketing, false, "the hook has refreshed to the withdrawal");
  // The open form still holds its old switches and the version it was filled from.
  await act(async () => {await result.current.save({...staleDraft, analytics: false}, formBase);});
  assert.equal(network.posts.at(-1).expectedVersion, formBase.version, "the form's own version is sent, not the refreshed one");
  assert.match(result.current.notice.text, /changed in another window/);
  assert.deepEqual((await current()).choices, all(false));
  // Once the form shows the new decision, a deliberate grant is accepted.
  await act(async () => {await result.current.save(all(true), {version: result.current.snapshot.version, basedAt: Date.now()});});
  assert.deepEqual((await current()).choices, all(true));
  cleanup();
});
