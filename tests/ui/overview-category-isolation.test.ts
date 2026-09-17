// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Overview from "@/app/affiliates/admin/page";
vi.mock("@/components/affiliates/charts/AreaChart", () => ({ AreaChart: () => null }));
vi.mock("@/components/affiliates/charts/BarChart", () => ({ BarChart: () => null }));
vi.mock("@/components/affiliates/charts/Donut", () => ({ Donut: () => null }));
vi.mock("@/components/affiliates/shared/useCalendarDay", () => ({ useCalendarDay: () => "2026-09-17" }));
const payload = (preset: string, revenue: number) => ({ preset,
  stats: { totalRevenue: revenue, affiliateRevenue: revenue, affiliateOrders: 1, totalOrders: 1, totalAffiliates: 34, activeAffiliates: 34, totalCommissions: revenue / 10, totalPaid: 0, totalPending: 17 },
  storeStats: { totalRevenue: revenue, totalOrders: 1 }, appRevenue: 5,
  chartOrders: [], recentOrders: [], ranking: [] });
const response = (p: string, n: number) => new Response(JSON.stringify(payload(p,n)));
function month(label: string) {
  fireEvent.click(screen.getByRole("button", { name: /^(Month|September 2026|August 2026)$/ }));
  fireEvent.click(screen.getAllByRole("button", { name: label }).at(-1)!);
}
beforeEach(() => { vi.stubGlobal("React", React); vi.setSystemTime(new Date("2026-09-17T12:00:00Z")); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("only commits the latest month when requests finish out of order and Shopify independently fails", async () => {
  let finishSeptember!: (r: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(response("30d",100))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishSeptember = resolve; }))
    .mockResolvedValueOnce(response("m:2026-08",800));
  vi.stubGlobal("fetch", (url:string,...args:unknown[])=>url.includes("category-revenue")?Promise.resolve(new Response("{}",{status:503})):fetcher(url,...args));
  render(React.createElement(Overview));
  await screen.findByText("$105.00");
  month("September 2026"); month("August 2026");
  await screen.findByText("$805.00");
  await act(async () => { finishSeptember(response("m:2026-09",900)); });
  expect(screen.queryByText("$905.00")).toBeNull();
  expect(screen.getByText("$805.00")).toBeTruthy();
  expect(screen.getByText("$17.00")).toBeTruthy(); // lifetime balance stays lifetime
  fireEvent.click(screen.getByRole("button", { name: "Peptides" }));
  expect(screen.getByRole("link", { name: "$800.00" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "App" }));
  expect(screen.getByText("$5.00")).toBeTruthy();
});

it("does not relabel successful September totals as August after a rejected request", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response("30d",100)).mockResolvedValueOnce(response("m:2026-09",900)).mockResolvedValueOnce(new Response('{}',{status:401}));
  vi.stubGlobal("fetch", (url:string,...args:unknown[])=>url.includes("category-revenue")?Promise.resolve(new Response("{}",{status:503})):fetcher(url,...args));
  render(React.createElement(Overview));
  await screen.findByText("$105.00");
  month("September 2026"); await screen.findByText("$905.00");
  month("August 2026");
  await waitFor(() => expect(screen.queryByText("$905.00")).toBeNull());
  expect(await screen.findByText("Your session could not be verified. Please sign in again.", {exact:false})).toBeTruthy();
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/affiliates/admin/dashboard?range=m%3A2026-08");
});
