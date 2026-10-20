// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.iqondaily.com/products/creatine-monohydrate"}
// Mounted integration: the real StorefrontGoogleTag and the real tracking library in
// jsdom, driving real location/history changes (address-bar hash, history traversal,
// pushState/replaceState), not synthetic events. Only Next's navigation hooks are mocked. Synthetic IDs; jsdom
// never fetches the gtag.js script, and its "Not implemented: navigation" report is
// how a requested reload/assign is observed (the document is not actually replaced).
import React from "react";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const nav = vi.hoisted(() => ({pathname: "/products/creatine-monohydrate", search: ""}));
vi.mock("next/navigation", () => ({usePathname: () => nav.pathname, useSearchParams: () => new URLSearchParams(nav.search)}));

import { StorefrontGoogleTag } from "../../app/google-tag";
import { configureGoogleTag, setGoogleConsent, trackGoogleCartAddition, trackGooglePageView, watchGoogleLocation } from "../../lib/google-tag";

const CREATINE = "/products/creatine-monohydrate";
const granted = {analytics: true, adStorage: true, adUserData: true};
const DENIED = {ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"};
const variant = "gid://shopify/ProductVariant/52086268985639";
const snapshot = {items: [{id: "creatine-monohydrate", variantId: variant, quantity: 1, amount: 35, currency: "USD", name: "Creatine", purchase: "once", frequency: "once"}]} as Parameters<typeof trackGoogleCartAddition>[0];
const navigations: string[] = [];
const record = (error: {message: string}) => { if (/navigation/.test(error.message)) navigations.push(error.message); };
const dom = (globalThis as unknown as {jsdom: {virtualConsole: {on(event: string, fn: typeof record): void; off(event: string, fn: typeof record): void}}}).jsdom;

const calls = () => (window.dataLayer || []).map(entry => Array.from(entry));
const pageViews = () => calls().filter(call => call[0] === "event" && call[1] === "page_view").length;
const scripts = () => document.querySelectorAll('script[src^="https://www.googletagmanager.com/"]').length;
// Fragment navigation and traversal queue their popstate/hashchange tasks.
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
async function mountGranted() {
  const view = render(React.createElement(StorefrontGoogleTag));
  act(() => setGoogleConsent(granted));
  expect(scripts()).toBe(1);
  expect(pageViews()).toBe(1);
  return view;
}

beforeEach(() => {
  history.replaceState(null, "", CREATINE);
  nav.pathname = CREATINE; nav.search = "";
  configureGoogleTag({ga4Id: "G-ABC123DEF4", adsId: "AW-123456789", hostnames: ["www.iqondaily.com"]});
  navigations.length = 0;
  dom.virtualConsole.on("jsdomError", record);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("no network in this test"); }));
});
afterEach(() => {
  cleanup();
  dom.virtualConsole.off("jsdomError", record);
  document.querySelectorAll("script").forEach(script => script.remove());
  vi.unstubAllGlobals();
});

it("reviewer sequence: an unknown fragment typed after load requests leaving and blocks later wrapper events", async () => {
  const view = await mountGranted();
  location.hash = "#token=synthetic-secret"; // address-bar style fragment navigation
  await settle();
  expect(navigations).toHaveLength(1);
  expect(calls().at(-1)).toEqual(["consent", "update", DENIED]);
  const count = calls().length;
  view.rerender(React.createElement(StorefrontGoogleTag));
  trackGooglePageView(CREATINE); trackGoogleCartAddition(snapshot, variant, 1); setGoogleConsent(granted);
  location.hash = "#token=another"; await settle();
  expect(calls().length).toBe(count);
  expect(navigations).toHaveLength(1);
  expect(JSON.stringify(calls())).not.toContain("synthetic-secret");
  expect(fetch).not.toHaveBeenCalled();
});

it("known section anchors and history traversal among them stay in-page with no duplicate page_view", async () => {
  await mountGranted();
  const count = calls().length;
  location.hash = "#reviews"; await settle();
  location.hash = "#product-formula"; await settle();
  history.back(); await settle();
  expect(location.hash).toBe("#reviews");
  history.back(); await settle();
  expect(location.hash).toBe("");
  history.forward(); await settle();
  expect(navigations).toEqual([]);
  expect(calls().length).toBe(count);
  expect(pageViews()).toBe(1);
  trackGoogleCartAddition(snapshot, variant, 1);
  expect(calls().filter(call => call[1] === "add_to_cart")).toHaveLength(1);
});

it("back/forward onto an unknown fragment leaves", async () => {
  await mountGranted();
  location.hash = "#token=synthetic-secret"; // first entry; leaves immediately
  expect(navigations).toHaveLength(0);
  await settle();
  expect(navigations).toHaveLength(1);

  configureGoogleTag({ga4Id: "G-ABC123DEF4", hostnames: ["www.iqondaily.com"]}); navigations.length = 0;
  setGoogleConsent(granted); // still on #token=…: ineligible, script-free
  expect(window.dataLayer).toBeUndefined();
  history.back(); await settle(); // back to the clean page; tag loads there
  expect(location.hash).toBe("");
  setGoogleConsent(granted);
  expect(scripts()).toBeGreaterThan(0);
  history.forward(); await settle(); // popstate onto #token=…
  expect(location.hash).toBe("#token=synthetic-secret");
  expect(navigations).toHaveLength(1);
});

for (const method of ["pushState", "replaceState"] as const) {
  it(`${method} onto an unknown fragment leaves immediately and blocks later events (Next-internal or third-party state)`, async () => {
    for (const state of [null, {__NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {}}]) {
      configureGoogleTag({ga4Id: "G-ABC123DEF4", adsId: "AW-123456789", hostnames: ["www.iqondaily.com"]}); navigations.length = 0;
      history.replaceState(null, "", CREATINE);
      document.querySelectorAll("script").forEach(script => script.remove());
      const view = await mountGranted();
      history[method](state, "", `${CREATINE}#token=synthetic-secret`);
      expect(navigations).toHaveLength(1); // synchronous: no event and no later wrapper call needed
      expect(calls().at(-1)).toEqual(["consent", "update", DENIED]);
      const count = calls().length;
      trackGooglePageView(CREATINE); trackGoogleCartAddition(snapshot, variant, 1); setGoogleConsent(granted);
      history[method](null, "", `${CREATINE}#token=another`);
      await settle();
      expect(calls().length).toBe(count);
      expect(navigations).toHaveLength(1);
      expect(JSON.stringify(calls())).not.toContain("synthetic-secret");
      view.unmount();
    }
  });
}

it("pushState/replaceState to known anchors, the same URL or another eligible product stay silent with no extra page_view", async () => {
  await mountGranted();
  const count = calls().length;
  history.pushState(null, "", `${CREATINE}#reviews`);
  history.replaceState({any: "state"}, "", `${CREATINE}#product-formula`);
  history.replaceState(history.state, "");
  history.pushState(null, "", `${CREATINE}?gclid=Abc_123&gad_source=1`);
  history.back(); await settle();
  expect(navigations).toEqual([]);
  expect(calls().length).toBe(count);
  expect(pageViews()).toBe(1);
  // The wrappers are transparent: same state, URL and return value as the platform.
  expect(history.pushState({k: 1}, "", `${CREATINE}#compare`)).toBeUndefined();
  expect(history.state).toEqual({k: 1});
  expect(location.hash).toBe("#compare");
  expect(() => history.pushState(null, "", "https://example.com/x")).toThrow(); // cross-origin: native SecurityError still surfaces
  expect(navigations).toEqual([]);
});

it("pushState to an ineligible path leaves at once (before the route effect)", async () => {
  await mountGranted();
  history.pushState(null, "", "/account/orders/1");
  expect(navigations).toHaveLength(1);
});

it("popstate alone (traversal between entries with equal fragments, no hashchange) leaves an ineligible entry", async () => {
  history.replaceState(null, "", "/products/glp-1-support");
  history.pushState(null, "", CREATINE); // before mount: nothing is loaded yet
  let hashchanges = 0;
  const count = () => { hashchanges++; };
  window.addEventListener("hashchange", count);
  await mountGranted();
  history.back(); await settle();
  window.removeEventListener("hashchange", count);
  expect(location.pathname).toBe("/products/glp-1-support");
  expect(hashchanges).toBe(0);
  expect(navigations).toHaveLength(1);
});

for (const type of ["hashchange", "popstate"] as const) {
  it(`the ${type} listener alone rechecks a URL changed without our history wrappers`, async () => {
    await mountGranted();
    // Calling the prototype bypasses any instance wrapper (Next's or ours) and fires no
    // event: nothing can notice until the next event or wrapper call (documented residual).
    History.prototype.pushState.call(history, null, "", `${CREATINE}#token=synthetic-secret`);
    expect(navigations).toEqual([]);
    window.dispatchEvent(type === "hashchange" ? new HashChangeEvent("hashchange") : new PopStateEvent("popstate"));
    expect(navigations).toHaveLength(1);
  });
}

it("installation is all-or-nothing: a failing history wrapper rolls back listeners and wrappers; the storefront keeps working", async () => {
  const push = history.pushState;
  Object.defineProperty(history, "replaceState", {value: history.replaceState, writable: false, configurable: true});
  try {
    expect(() => watchGoogleLocation()).toThrow(TypeError);
    expect(history.pushState).toBe(push);
    expect(() => render(React.createElement(StorefrontGoogleTag))).not.toThrow();
    act(() => setGoogleConsent(granted));
    expect(scripts()).toBe(1);
    expect(history.pushState).toBe(push);
    // No half-installed listener survives: neither event rechecks.
    History.prototype.pushState.call(history, null, "", `${CREATINE}#token=synthetic-secret`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(navigations).toEqual([]);
  } finally {
    delete (history as unknown as {replaceState?: unknown}).replaceState;
  }
  expect(history.replaceState).toBe(History.prototype.replaceState);
});

it("an unknown fragment before the script loads stays script-free, even after a later grant", async () => {
  render(React.createElement(StorefrontGoogleTag));
  location.hash = "#token=synthetic-secret"; await settle();
  act(() => setGoogleConsent(granted));
  expect(scripts()).toBe(0);
  expect(window.dataLayer).toBeUndefined();
  expect(navigations).toEqual([]);
  location.hash = "#reviews"; await settle(); // a known anchor: no reload loop, still nothing queued
  expect(navigations).toEqual([]);
  expect(window.dataLayer).toBeUndefined();
});

it("withdrawal leaves once; a later unknown fragment does not request a second navigation", async () => {
  await mountGranted();
  act(() => setGoogleConsent({analytics: false, adStorage: false, adUserData: false}));
  expect(navigations).toHaveLength(1);
  location.hash = "#token=synthetic-secret"; await settle();
  history.back(); await settle();
  expect(navigations).toHaveLength(1);
});

it("unmount detaches the hash/history listeners and restores pushState/replaceState", async () => {
  const push = history.pushState, replace = history.replaceState;
  const add = vi.spyOn(window, "addEventListener"), remove = vi.spyOn(window, "removeEventListener");
  const view = await mountGranted();
  expect(history.pushState).not.toBe(push);
  view.unmount();
  const pairs = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === "hashchange" || type === "popstate").map(([type, fn]) => [type, fn]);
  expect(pairs(add)).toHaveLength(2);
  expect(pairs(remove)).toEqual(expect.arrayContaining(pairs(add))); // same listeners released, nothing retained
  add.mockRestore(); remove.mockRestore();
  expect(history.pushState).toBe(push);
  expect(history.replaceState).toBe(replace);
  location.hash = "#token=synthetic-secret"; await settle();
  history.back(); await settle();
  history.pushState(null, "", `${CREATINE}#token=x`); history.replaceState(null, "", `${CREATINE}#token=y`);
  expect(navigations).toEqual([]);
});

it("if another script wrapped history after us (as Next's router does), unmount leaves its wrapper and ours becomes a pass-through", async () => {
  const push = history.pushState;
  const view = await mountGranted();
  const ours = history.pushState;
  const outer = function (this: History, ...args: Parameters<History["pushState"]>) { return ours.apply(this, args); };
  history.pushState = outer;
  view.unmount();
  expect(history.pushState).toBe(outer);
  history.pushState(null, "", `${CREATINE}#token=x`);
  expect(location.hash).toBe("#token=x");
  expect(navigations).toEqual([]);
  history.pushState = push;
});
