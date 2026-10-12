// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import Page from "../../app/affiliates/admin/payouts/page";


// Synthetic fixtures only; every network call is intercepted.
const pendingByAffiliate = [
  { id: "aff-alpha", name: "Alpha Synthetic", promoCode: "ALPHA", pendingCommission: 40, pendingOrders: 2, bankInfoOnFile: true, orders: [] },
  { id: "aff-bravo", name: "Bravo Synthetic", promoCode: "BRAVO", pendingCommission: 25, pendingOrders: 1, bankInfoOnFile: false, orders: [] },
];
const profiles: Record<string, Record<string, unknown>> = {
  "aff-alpha": {
    id: "aff-alpha", firstName: "Alpha", lastName: "Synthetic", email: "alpha@example.invalid", phone: "+1 555 0100", promoCode: "ALPHA",
    bankInfo: { accountHolder: "Alpha Synthetic", routingNumber: "011000015", accountNumber: "000123456789", paypalEmail: "alpha-pay@example.invalid", zelle: "alpha-zelle@example.invalid" },
  },
  "aff-bravo": { id: "aff-bravo", firstName: "Bravo", lastName: "Synthetic", email: "bravo@example.invalid", phone: "", promoCode: "BRAVO", bankInfo: null },
};

type Handler = (id: string) => Promise<Response>;
function setup(profile?: Handler) {
  const calls: { url: string; method: string }[] = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: (init?.method ?? "GET").toUpperCase() });
    const m = /^\/api\/affiliates\/admin\/affiliates\/([^/?]+)$/.exec(url);
    if (m) {
      const id = decodeURIComponent(m[1]);
      return profile ? profile(id) : Response.json({ ok: true, affiliate: profiles[id] });
    }
    if (url === "/api/affiliates/admin/payouts") return Response.json({ payouts: [], pendingByAffiliate });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return { calls };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openContact(name: string) {
  const trigger = await screen.findByRole("button", { name });
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: /Synthetic/ }) };
}

it("opens the clicked affiliate's contact details in place without any payout mutation", async () => {
  const { calls } = setup();
  render(React.createElement(Page));
  const { trigger, dialog } = await openContact("Alpha Synthetic");
  await within(dialog).findByText("alpha@example.invalid");
  expect(within(dialog).getByText("+1 555 0100").closest("a")?.getAttribute("href")).toBe("tel:+15550100");
  expect(within(dialog).getByText("alpha-pay@example.invalid")).toBeTruthy();
  expect(within(dialog).getByText("alpha-zelle@example.invalid")).toBeTruthy();
  expect(within(dialog).getByText("On file")).toBeTruthy();
  // Never render bank account or routing numbers.
  expect(dialog.textContent).not.toContain("000123456789");
  expect(dialog.textContent).not.toContain("011000015");

  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
  // Same payout table remains in place.
  expect(screen.getByText("Pending balances")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bravo Synthetic" })).toBeTruthy();
  // Exact request list: no session/command/payout calls, only the two reads.
  expect(calls).toEqual([
    { url: "/api/affiliates/admin/payouts", method: "GET" },
    { url: "/api/affiliates/admin/affiliates/aff-alpha", method: "GET" },
  ]);
});

it("states plainly when a phone is not provided", async () => {
  setup();
  render(React.createElement(Page));
  const { dialog } = await openContact("Bravo Synthetic");
  await within(dialog).findByText("bravo@example.invalid");
  const phoneRow = within(dialog).getByText("Phone").parentElement!;
  expect(within(phoneRow).getByText("Not provided")).toBeTruthy();
  expect(within(dialog).getByText("Not on file")).toBeTruthy();
  expect(within(dialog).queryByText("PayPal")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Back to payouts" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("shows an error with retry, then loads on retry", async () => {
  let n = 0;
  setup(async (id) => (++n === 1 ? Response.json({ ok: false, error: "down" }, { status: 503 }) : Response.json({ ok: true, affiliate: profiles[id] })));
  render(React.createElement(Page));
  const { dialog } = await openContact("Alpha Synthetic");
  await within(dialog).findByText("Couldn't load contact details.");
  expect(within(dialog).queryByText("alpha@example.invalid")).toBeNull();
  // Real clicks focus the button; the dialog must keep focus once it unmounts.
  const retry = within(dialog).getByRole("button", { name: "Retry" });
  retry.focus();
  fireEvent.click(retry);
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close contact details" }));
  await within(dialog).findByText("alpha@example.invalid");
  expect(within(dialog).queryByText("Couldn't load contact details.")).toBeNull();
});

it("never shows a mismatched affiliate's details", async () => {
  setup(async () => Response.json({ ok: true, affiliate: profiles["aff-bravo"] }));
  render(React.createElement(Page));
  const { dialog } = await openContact("Alpha Synthetic");
  await within(dialog).findByText("Couldn't load contact details.");
  expect(dialog.textContent).not.toContain("bravo@example.invalid");
});

it("a late response for a previously opened affiliate cannot replace the current one", async () => {
  let releaseAlpha!: () => void;
  setup((id) =>
    id === "aff-alpha"
      ? new Promise<Response>((resolve) => {
          releaseAlpha = () => resolve(Response.json({ ok: true, affiliate: profiles["aff-alpha"] }));
        })
      : Promise.resolve(Response.json({ ok: true, affiliate: profiles[id] }))
  );
  render(React.createElement(Page));
  let { dialog } = await openContact("Alpha Synthetic");
  expect(within(dialog).getByText("Loading contact details…")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close contact details" }));
  ({ dialog } = await openContact("Bravo Synthetic"));
  await within(dialog).findByText("bravo@example.invalid");
  releaseAlpha();
  await new Promise((r) => setTimeout(r, 20));
  expect(dialog.textContent).not.toContain("alpha@example.invalid");
  expect(within(dialog).getByRole("heading").textContent).toBe("Bravo Synthetic");
});

it("keeps keyboard focus inside the dialog", async () => {
  setup();
  render(React.createElement(Page));
  const { dialog } = await openContact("Alpha Synthetic");
  await within(dialog).findByText("alpha@example.invalid");
  const close = within(dialog).getByRole("button", { name: "Close contact details" });
  const back = within(dialog).getByRole("button", { name: "Back to payouts" });
  expect(document.activeElement).toBe(close);
  back.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(back);
});

it("explains a permission failure without showing any details", async () => {
  setup(async () => Response.json({ ok: false, error: "Forbidden" }, { status: 403 }));
  render(React.createElement(Page));
  const { dialog } = await openContact("Alpha Synthetic");
  await within(dialog).findByText("You don't have access to this affiliate's contact details.");
  expect(dialog.textContent).not.toContain("alpha@example.invalid");
});

it("shows a phone with an extension as saved but does not build a misleading tel link", async () => {
  setup(async (id) => Response.json({ ok: true, affiliate: { ...profiles[id], phone: "+1 555 0100 ext 12" } }));
  render(React.createElement(Page));
  const { dialog } = await openContact("Alpha Synthetic");
  const phone = await within(dialog).findByText("+1 555 0100 ext 12");
  expect(phone.closest("a")).toBeNull();
});
