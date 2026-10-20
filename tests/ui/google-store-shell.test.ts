// @vitest-environment jsdom
// Integration: the real StoreShell owns Google page views and calls Google cart
// tracking only after a successful add response. Google itself is mocked.
import React from "react";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({pathname: "/products/creatine-monohydrate", search: "", push: vi.fn()}));
const google = vi.hoisted(() => ({trackGooglePageView: vi.fn(), trackGoogleCartAddition: vi.fn(), guardGoogleNavigation: vi.fn()}));
vi.mock("next/navigation", () => ({usePathname: () => nav.pathname, useSearchParams: () => new URLSearchParams(nav.search), useRouter: () => ({push: nav.push})}));
vi.mock("@/lib/google-tag", () => google);
vi.mock("../../app/meta-pixel", () => ({StorefrontMetaPixel: () => null}));
vi.mock("@/lib/meta-pixel", () => ({trackCartAddition: vi.fn()}));
vi.mock("../../app/store-navigation", () => ({StoreNavigation: () => null}));

import { StoreShell, useStore } from "../../app/store-shell";
import { products, type StoreCatalog } from "../../lib/catalog";

const variantId = "gid://shopify/ProductVariant/52086268985639";
const product = {...products.find(p => p.id === "creatine-monohydrate")!, available: true, price: 35, currency: "USD", pricePending: false,
  requiresSellingPlan: false, variants: [{id: variantId, title: "Default Title", price: 35, currency: "USD", available: true, sellingPlans: []}]};
const catalog = {mode: "live", currency: "USD", products: [product]} as unknown as StoreCatalog;
const empty = {items: [], subtotal: 0, currency: "USD", count: 0, discountCodes: []};
const added = {...empty, items: [{id: product.id, variantId, quantity: 1, amount: 35, currency: "USD", purchase: "once", frequency: "once"}], subtotal: 35, count: 1};
let addResponse: () => Promise<Response>;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}}));

function Adder() {
  const {add, ready, openBag} = useStore();
  return React.createElement(React.Fragment, null,
    React.createElement("button", {disabled: !ready, onClick: () => add(product.id, 1, "once", "once", variantId)}, "add"),
    React.createElement("button", {onClick: openBag}, "open bag"));
}
const shell = () => React.createElement(StoreShell, {catalog}, React.createElement(Adder));
async function addOnce() {
  render(shell());
  const button = await screen.findByRole("button", {name: "add"});
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { fireEvent.click(button); });
}

beforeEach(() => {
  nav.pathname = "/products/creatine-monohydrate"; nav.search = "";
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => init?.method === "POST" && url === "/api/cart" ? addResponse() : json(empty)));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("tracks a successful (200) add with the returned snapshot", async () => {
  addResponse = () => json(added);
  await addOnce();
  await waitFor(() => expect(google.trackGoogleCartAddition).toHaveBeenCalledTimes(1));
  expect(google.trackGoogleCartAddition).toHaveBeenCalledWith(expect.objectContaining({items: added.items}), variantId, 1, undefined);
});

it("passes a 200 stock-warning snapshot through with its notice (the library declines it)", async () => {
  addResponse = () => json({...added, notice: "Only 1 item was added due to availability."});
  await addOnce();
  await waitFor(() => expect(google.trackGoogleCartAddition).toHaveBeenCalledTimes(1));
  expect(google.trackGoogleCartAddition.mock.calls[0][0]).toMatchObject({notice: expect.stringContaining("availability")});
});

it("never tracks a rejected (422) add, even when it returns a cart", async () => {
  addResponse = () => json({error: "This option is currently unavailable.", cart: added}, 422);
  await addOnce();
  await screen.findAllByText("This option is currently unavailable.");
  expect(google.trackGoogleCartAddition).not.toHaveBeenCalled();
});

it("never tracks when the add request throws", async () => {
  addResponse = () => Promise.reject(new TypeError("network"));
  await addOnce();
  await waitFor(() => expect((fetch as unknown as {mock: {calls: unknown[]}}).mock.calls.length).toBeGreaterThanOrEqual(2));
  await act(async () => {});
  expect(google.trackGoogleCartAddition).not.toHaveBeenCalled();
});

it("mounts one page_view owner and the click guard; SPA navigation reports each route once", async () => {
  const view = render(shell());
  await waitFor(() => expect(google.trackGooglePageView).toHaveBeenCalledWith("/products/creatine-monohydrate"));
  view.rerender(shell());
  nav.pathname = "/products/colostrum-powder"; nav.search = "gclid=abc";
  view.rerender(shell());
  nav.pathname = "/account";  nav.search = "";
  view.rerender(shell());
  expect(google.trackGooglePageView.mock.calls.map(call => call[0])).toEqual(["/products/creatine-monohydrate", "/products/colostrum-powder?gclid=abc", "/account"]);
  fireEvent.click(document.body);
  expect(google.guardGoogleNavigation).toHaveBeenCalledTimes(1);
  view.unmount();
  fireEvent.click(document.body);
  expect(google.guardGoogleNavigation).toHaveBeenCalledTimes(1);
});

it("affiliate portal shell still mounts the owner (so a loaded tag can leave the page)", async () => {
  nav.pathname = "/affiliates/dashboard";
  render(shell());
  await waitFor(() => expect(google.trackGooglePageView).toHaveBeenCalledWith("/affiliates/dashboard"));
});

it("checkout redirect proceeds even when every Google call throws", async () => {
  for (const fn of Object.values(google)) fn.mockImplementation(() => { throw new Error("blocked"); });
  const assign = vi.fn();
  const original = window.location;
  Object.defineProperty(window, "location", {configurable: true, value: {...original, assign, origin: original.origin, href: original.href}});
  addResponse = () => json(added);
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => url === "/api/checkout" ? json({checkoutUrl: "https://checkout.example/c/1"})
    : init?.method === "POST" ? addResponse() : json(added)));
  render(shell());
  await act(async () => { fireEvent.click(await screen.findByRole("button", {name: "open bag"})); });
  const checkout = await screen.findByRole("button", {name: /Secure checkout/});
  await waitFor(() => expect((checkout as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { fireEvent.click(checkout); });
  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.example/c/1"));
  Object.defineProperty(window, "location", {configurable: true, value: original});
});
