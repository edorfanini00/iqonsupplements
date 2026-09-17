"use client";
import { useLatestRead } from "@/lib/affiliates/use-latest-read";
import { resolveRange, parseOrderTimestamp } from "@/lib/affiliates/time-series";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Search, ShoppingBag, Repeat, Gift } from "lucide-react";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import {
  PageHeader,
  Pill,
  EmptyState,
  bonusKindLabel,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import { OrderDetailDrawer } from "@/components/affiliates/shared/OrderDetailDrawer";

interface OrderRow {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring" | "bonus";
  status: "pending" | "paid";
  createdAt: string;
}

export default function AffiliateOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("90d");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "code" | "recurring" | "pending" | "paid">("all");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const beginRead = useLatestRead();
  const [readError, setReadError] = useState<string | null>(null);
  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    const request = beginRead();
    setReadError(null);
    setOrders([]);
    try {
      const res = await fetch(`/api/affiliates/dashboard?range=${encodeURIComponent(p)}`, {
        credentials: "include", cache: "no-store", signal: request.signal,
      });
      if (!res.ok) throw new Error("Could not load data. Please retry.");
      if (res.ok) {
        const data = await res.json();
        if (!request.isCurrent()) return;
        setOrders(data.orders ?? []);
      }
    } catch {
      if (request.isCurrent()) setReadError("Could not load data. Please retry.");
    } finally {
      if (!request.isCurrent()) return;
      setLoading(false);
    }
  }, [beginRead]);

  useEffect(() => {
    load(preset);
  }, [preset, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const range = resolveRange(preset);
    return orders.filter((o) => {
      const at = parseOrderTimestamp(o.createdAt).getTime();
      if (at < range.start.getTime() || at > range.end.getTime()) return false;
      if (filter === "code" || filter === "recurring") {
        if (o.matchType !== filter) return false;
      }
      if (filter === "pending" || filter === "paid") {
        if (o.status !== filter) return false;
      }
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.orderId.toLowerCase().includes(q)
      );
    });
  }, [orders, search, filter, preset]);

  return (
    <>
      {readError && <p role="alert">{readError} <button type="button" onClick={() => load(preset)}>Retry</button></p>}
      <PageHeader
        eyebrow="Orders"
        title="Attributed orders"
        description="Every order tied to your code, plus recurring customer orders."
        actions={<RangePicker value={preset} onChange={setPreset} />}
      />

      <section className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
          <input
            type="text"
            placeholder="Search orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
        </div>
        <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1 overflow-x-auto">
          {(["all", "code", "recurring", "pending", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-sans transition-colors whitespace-nowrap ${
                filter === f
                  ? "bg-[#242526] text-white"
                  : "text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={search || filter !== "all" ? "No matches" : "No orders yet"}
          description={
            search || filter !== "all"
              ? "Try a different filter or search term."
              : "Share your code to start attracting orders."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#242526]/8">
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Order</Th>
                  <Th>Type</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Commission</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setActiveOrderId(o.id)}
                    className="border-b border-[#242526]/5 last:border-0 cursor-pointer hover:bg-[#242526]/[0.03] transition-colors"
                  >
                    <td className="py-4 px-5 font-sans text-xs text-[#64717a]">
                      {formatShortDate(o.createdAt)}
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-medium leading-tight">
                        {o.customerName}
                      </p>
                      <p className="text-xs text-[#64717a] mt-0.5">
                        {o.customerEmail}
                      </p>
                    </td>
                    <td className="py-4 px-5 font-sans text-xs text-[#64717a]">
                      {o.matchType === "bonus" ? "—" : `#${o.orderId}`}
                    </td>
                    <td className="py-4 px-5">
                      <Pill
                        tone={o.matchType === "code" ? "dark" : "neutral"}
                        icon={
                          o.matchType === "code"
                            ? ShoppingBag
                            : o.matchType === "bonus"
                              ? Gift
                              : Repeat
                        }
                      >
                        {o.matchType === "code"
                          ? "Code"
                          : o.matchType === "bonus"
                          ? bonusKindLabel(o.orderId)
                          : "Recurring"}
                      </Pill>
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {o.matchType === "bonus" ? "—" : formatCurrency(o.orderTotal)}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {formatCurrency(o.commission)}
                    </td>
                    <td className="py-4 px-5">
                      <Pill tone={o.status === "paid" ? "success" : "warn"}>
                        {o.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderDetailDrawer
        orderId={activeOrderId}
        onClose={() => setActiveOrderId(null)}
      />
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium text-${align}`}
    >
      {children}
    </th>
  );
}
