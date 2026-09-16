"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ShoppingBag,
  ChevronDown,
  MapPin,
  Package,
  Truck,
  Phone,
  Mail,
} from "lucide-react";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import { isMonthToken, isPresetRange } from "@/lib/affiliates/time-series";
import {
  PageHeader,
  Pill,
  EmptyState,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface OrderItem {
  name: string;
  quantity: number;
}

interface OrderTracking {
  number: string | null;
  provider: string | null;
  url: string | null;
}

interface FulfillmentOrder {
  id: number;
  status: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingName: string;
  shippingAddress: string;
  shippingMethod: string | null;
  items: OrderItem[];
  tracking: OrderTracking | null;
}

type StatusFilter = "to-fulfill" | "processing" | "completed" | "pending" | "on-hold";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "to-fulfill", label: "To fulfill" },
  { id: "processing", label: "Processing" },
  { id: "completed", label: "Completed" },
  { id: "pending", label: "Pending payment" },
  { id: "on-hold", label: "On hold" },
];

function matchesStatus(orderStatus: string, filter: StatusFilter): boolean {
  if (filter === "to-fulfill") {
    return orderStatus === "processing";
  }
  return orderStatus === filter;
}

export default function ShopManagerOrdersPage() {
  return (
    <Suspense fallback={null}>
      <ShopManagerOrdersPageInner />
    </Suspense>
  );
}

function ShopManagerOrdersPageInner() {
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get("range");
  const initialPreset: Preset =
    isPresetRange(rangeParam) || isMonthToken(rangeParam) ? rangeParam : "30d";

  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("to-fulfill");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/affiliates/shop-manager/orders?range=${p}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        setTruncated(Boolean(data.truncated));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(preset);
  }, [preset, load]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesStatus(o.status, statusFilter)) return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.shippingName.toLowerCase().includes(q) ||
        o.shippingAddress.toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [orders, search, statusFilter]);

  const toFulfillCount = useMemo(
    () => orders.filter((o) => o.status === "processing").length,
    [orders]
  );

  return (
    <>
      <PageHeader
        title="Orders to ship"
        description="Paid orders waiting to be packed and shipped. Expand an order to see the full shipping address and line items."
        actions={<RangePicker value={preset} onChange={setPreset} />}
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="glass-surface rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            To fulfill
          </p>
          <p className="text-2xl font-medium font-sans tracking-tight mt-2">
            {toFulfillCount}
          </p>
        </div>
        <div className="glass-surface rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Showing
          </p>
          <p className="text-2xl font-medium font-sans tracking-tight mt-2">
            {filtered.length}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
          <input
            type="text"
            placeholder="Search by customer, address, product, or order #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
        </div>
        <div className="inline-flex items-center self-start glass-surface rounded-full p-1 gap-1 overflow-x-auto max-w-full">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-sans transition-colors whitespace-nowrap ${
                statusFilter === s.id
                  ? "bg-[#242526] text-white"
                  : "text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {truncated && (
        <div className="mb-4 glass-surface rounded-lg px-5 py-3 text-xs text-[#64717a]">
          Showing the most recent orders for this range; older orders were
          truncated. Narrow the date range to see the rest.
        </div>
      )}

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={
            search || statusFilter !== "to-fulfill"
              ? "No matches"
              : "No orders to fulfill"
          }
          description={
            search || statusFilter !== "to-fulfill"
              ? "Try a different filter or search term."
              : "Processing orders will appear here when they are ready to ship."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-[#242526]/8">
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Ship to</Th>
                  <Th>Items</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const isOpen = expanded.has(o.id);
                  const itemCount = o.items.reduce((s, it) => s + it.quantity, 0);
                  const summary = o.items
                    .map((it) => `${it.name}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`)
                    .join(", ");
                  const addressPreview = o.shippingAddress.split("\n").slice(0, 2).join(", ");
                  return (
                    <Fragment key={o.id}>
                      <tr
                        data-shop-delay-click
                        onClick={() => toggle(o.id)}
                        className="border-b border-[#242526]/5 cursor-pointer hover:bg-[#242526]/[0.03] transition-colors"
                      >
                        <td className="py-4 px-5 font-sans text-xs text-[#64717a] whitespace-nowrap">
                          {formatShortDate(o.date)}
                        </td>
                        <td className="py-4 px-5">
                          <p className="font-medium leading-tight">
                            {o.customerName || "—"}
                          </p>
                          <p className="text-xs text-[#64717a] mt-0.5">#{o.id}</p>
                        </td>
                        <td className="py-4 px-5 max-w-[16rem]">
                          <p className="truncate">{o.shippingName || o.customerName || "—"}</p>
                          <p className="text-xs text-[#64717a] mt-0.5 truncate">
                            {addressPreview || "—"}
                          </p>
                        </td>
                        <td className="py-4 px-5 max-w-[16rem]">
                          <p className="truncate text-[#20282c]">{summary || "—"}</p>
                          <p className="text-xs text-[#64717a] mt-0.5">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </p>
                        </td>
                        <td className="py-4 px-5">
                          <Pill
                            tone={
                              o.status === "completed"
                                ? "success"
                                : o.status === "processing"
                                  ? "neutral"
                                  : "warn"
                            }
                          >
                            {o.status === "pending"
                              ? "pending payment"
                              : o.status.replace(/-/g, " ")}
                          </Pill>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <ChevronDown
                            className={`h-4 w-4 text-[#64717a] inline-block transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-[#242526]/5 bg-[#242526]/[0.02]">
                          <td colSpan={6} className="px-5 py-5">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3 flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5" />
                                  Items to pack
                                </p>
                                <ul className="space-y-2">
                                  {o.items.map((it, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-center justify-between gap-4 text-sm"
                                    >
                                      <span className="text-[#20282c]">
                                        {it.name}
                                        <span className="text-[#64717a]">
                                          {" "}
                                          × {it.quantity}
                                        </span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {o.shippingMethod && (
                                  <p className="mt-4 text-xs text-[#64717a]">
                                    Shipping method: {o.shippingMethod}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2 flex items-center gap-2">
                                    <MapPin className="h-3.5 w-3.5" />
                                    Shipping address
                                  </p>
                                  <pre className="whitespace-pre-wrap font-sans text-sm text-[#20282c] leading-relaxed">
                                    {o.shippingAddress || "No shipping address on file."}
                                  </pre>
                                </div>
                                <div className="space-y-2 text-sm">
                                  {o.customerEmail && (
                                    <p className="flex items-center gap-2 text-[#20282c]">
                                      <Mail className="h-3.5 w-3.5 text-[#64717a]" />
                                      {o.customerEmail}
                                    </p>
                                  )}
                                  {o.customerPhone && (
                                    <p className="flex items-center gap-2 text-[#20282c]">
                                      <Phone className="h-3.5 w-3.5 text-[#64717a]" />
                                      {o.customerPhone}
                                    </p>
                                  )}
                                </div>
                                {o.tracking && (o.tracking.number || o.tracking.url) && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2 flex items-center gap-2">
                                      <Truck className="h-3.5 w-3.5" />
                                      Tracking
                                    </p>
                                    {o.tracking.provider && (
                                      <p className="text-sm text-[#20282c]">
                                        {o.tracking.provider}
                                      </p>
                                    )}
                                    {o.tracking.number && (
                                      <p className="text-sm font-sans text-[#20282c]">
                                        {o.tracking.number}
                                      </p>
                                    )}
                                    {o.tracking.url && (
                                      <a
                                        href={o.tracking.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[#20282c] underline hover:no-underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Track shipment
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
