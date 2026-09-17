"use client";
import { useLatestRead } from "@/lib/affiliates/use-latest-read";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ShoppingBag,
  ChevronDown,
  Tag,
  Repeat,
  Loader2,
  UserPlus,
  Lock,
  Sparkles,
  Undo2,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import { isMonthToken, isPresetRange } from "@/lib/affiliates/time-series";
import {
  PageHeader,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface OrderItem {
  name: string;
  quantity: number;
  total: string;
}

interface OrderAffiliate {
  affiliateId: string;
  name: string;
  promoCode: string;
  commission: number;
  matchType: string;
  locked: boolean;
}

interface AffiliateOption {
  id: string;
  name: string;
  promoCode: string;
}

interface AdminOrder {
  id: number;
  status: string;
  date: string;
  total: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  couponCodes: string[];
  customerType: "new" | "recurring";
  /** True when a refunded order's products were also returned (restocked). */
  returned: boolean;
  affiliate: OrderAffiliate | null;
}

function toNum(v: string | number | null | undefined): number {
  const n = parseFloat(String(v ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// "paid" (the default) = processing + completed, matching what this page
// showed before unpaid statuses were added.
type StatusFilter =
  | "paid"
  | "completed"
  | "processing"
  | "pending"
  | "on-hold"
  | "refunded";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "completed", label: "Completed" },
  { id: "processing", label: "Processing" },
  { id: "pending", label: "Pending payment" },
  { id: "on-hold", label: "On hold" },
  { id: "refunded", label: "Refunded" },
];

function matchesStatus(orderStatus: string, filter: StatusFilter): boolean {
  if (filter === "paid") {
    return orderStatus === "processing" || orderStatus === "completed";
  }
  return orderStatus === filter;
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={null}>
      <AdminOrdersPageInner />
    </Suspense>
  );
}

function AdminOrdersPageInner() {
  // Deep links from the overview (revenue number → orders of that range)
  // carry the selected range as ?range=…
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get("range");
  const initialPreset: Preset =
    isPresetRange(rangeParam) || isMonthToken(rangeParam) ? rangeParam : "30d";

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [affiliateOptions, setAffiliateOptions] = useState<AffiliateOption[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "affiliate" | "direct" | "new" | "recurring"
  >("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("paid");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Per-order attribution UI state: chosen affiliate in the picker + saving flag.
  const [attrChoice, setAttrChoice] = useState<Record<number, string>>({});
  const [attrSaving, setAttrSaving] = useState<Set<number>>(new Set());

  const beginRead = useLatestRead();
  const [readError, setReadError] = useState<string | null>(null);
  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    const request = beginRead();
    setReadError(null);
    setOrders([]); setTruncated(false);
    try {
      const res = await fetch(`/api/affiliates/admin/orders?range=${encodeURIComponent(p)}`, {
        credentials: "include", cache: "no-store", signal: request.signal,
      });
      if (!res.ok) throw new Error("Could not load data. Please retry.");
      if (res.ok) {
        const data = await res.json();
        if (!request.isCurrent()) return;
        setOrders(data.orders ?? []);
        setAffiliateOptions(data.affiliates ?? []);
        setTruncated(Boolean(data.truncated));
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

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSaving = (id: number, on: boolean) =>
    setAttrSaving((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const attributeOrder = useCallback(
    async (orderId: number, affiliateId: string) => {
      if (!affiliateId) {
        toast.error("Pick an affiliate first.");
        return;
      }
      setSaving(orderId, true);
      try {
        const res = await fetch(
          `/api/affiliates/admin/orders/${orderId}/attribute`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ affiliateId }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Could not attribute this order.");
          return;
        }
        const attr = data.attribution ?? {};
        const commissionText =
          typeof attr.commission === "number"
            ? ` · ${formatCurrency(attr.commission)} commission`
            : "";
        toast.success(
          `${attr.reassigned ? "Reassigned" : "Attributed"} to ${attr.affiliateName ?? "affiliate"}${commissionText}${
            attr.referralCredited ? " (network commission credited too)" : ""
          }`
        );
        await load(preset);
      } finally {
        setSaving(orderId, false);
      }
    },
    [load, preset]
  );

  const removeAttribution = useCallback(
    async (orderId: number) => {
      if (
        !window.confirm(
          "Remove this order's affiliate attribution? The pending commission will be deleted."
        )
      )
        return;
      setSaving(orderId, true);
      try {
        const res = await fetch(
          `/api/affiliates/admin/orders/${orderId}/attribute`,
          { method: "DELETE", credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Could not remove attribution.");
          return;
        }
        toast.success("Attribution removed.");
        await load(preset);
      } finally {
        setSaving(orderId, false);
      }
    },
    [load, preset]
  );

  const markRefund = useCallback(
    async (orderId: number, action: "refund" | "return") => {
      const confirmText =
        action === "return"
          ? `Mark order #${orderId} as refunded AND returned?\n\nIt will be removed from revenue, any pending commission is voided, and the units go back into inventory.`
          : `Mark order #${orderId} as refunded (customer keeps the products)?\n\nIt will be removed from revenue and any pending commission is voided. Stock stays deducted — use "returned" if the products came back.`;
      if (!window.confirm(confirmText)) return;
      setSaving(orderId, true);
      try {
        const res = await fetch(`/api/affiliates/admin/orders/${orderId}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Could not update this order.");
          return;
        }
        toast.success(
          action === "return"
            ? `Order #${orderId} marked returned — stock is back in inventory.`
            : `Order #${orderId} marked refunded.`
        );
        await load(preset);
      } finally {
        setSaving(orderId, false);
      }
    },
    [load, preset]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesStatus(o.status, statusFilter)) return false;
      if (filter === "affiliate" && !o.affiliate) return false;
      if (filter === "direct" && o.affiliate) return false;
      if (filter === "new" && o.customerType !== "new") return false;
      if (filter === "recurring" && o.customerType !== "recurring") return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        (o.affiliate?.promoCode.toLowerCase().includes(q) ?? false) ||
        (o.affiliate?.name.toLowerCase().includes(q) ?? false) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [orders, search, filter, statusFilter]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, o) => s + toNum(o.total), 0);
    const fromAffiliates = filtered
      .filter((o) => o.affiliate)
      .reduce((s, o) => s + toNum(o.total), 0);
    return { revenue, fromAffiliates, count: filtered.length };
  }, [filtered]);

  return (
    <>
      {readError && <p role="alert">{readError} <button type="button" onClick={() => load(preset)}>Retry</button></p>}
      <PageHeader
        eyebrow="Orders"
        title="All orders"
        description="Every order with products, totals, and the affiliate (if any) attributed to it. Defaults to paid orders (processing + completed); use the status filter for pending payment, on hold, or refunded. Open an order to flag it refunded or returned."
        actions={<RangePicker value={preset} onChange={setPreset} />}
      />

      {/* Summary line */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="glass-surface rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Orders
          </p>
          <p className="text-2xl font-medium font-sans tracking-tight mt-2">
            {totals.count}
          </p>
        </div>
        <div className="glass-surface rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Revenue
          </p>
          <p className="text-2xl font-medium font-sans tracking-tight mt-2">
            {formatCurrency(totals.revenue)}
          </p>
        </div>
        <div className="glass-surface rounded-lg p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            From affiliates
          </p>
          <p className="text-2xl font-medium font-sans tracking-tight mt-2">
            {formatCurrency(totals.fromAffiliates)}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
            <input
              type="text"
              placeholder="Search by customer, product, order #, or affiliate code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
            />
          </div>
          <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1 overflow-x-auto">
            {(["all", "affiliate", "direct", "new", "recurring"] as const).map((f) => (
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
            search || filter !== "all" || statusFilter !== "paid"
              ? "No matches"
              : "No paid orders yet"
          }
          description={
            search || filter !== "all" || statusFilter !== "paid"
              ? "Try a different filter or search term."
              : "Paid orders (processing or completed) will appear here."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[#242526]/8">
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  <Th>Items</Th>
                  <Th>Affiliate</Th>
                  <Th align="right">Total</Th>
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
                  return (
                    <FragmentRow key={o.id}>
                      <tr
                        onClick={() => toggle(o.id)}
                        className="border-b border-[#242526]/5 cursor-pointer hover:bg-[#242526]/[0.03] transition-colors"
                      >
                        <td className="py-4 px-5 font-sans text-xs text-[#64717a] whitespace-nowrap">
                          {formatShortDate(o.date)}
                        </td>
                        <td className="py-4 px-5">
                          <p className="font-medium leading-tight">{o.customerName || "—"}</p>
                          <p className="text-xs text-[#64717a] mt-0.5">{o.customerEmail}</p>
                        </td>
                        <td className="py-4 px-5">
                          {o.customerType === "recurring" ? (
                            <Pill tone="neutral" icon={Repeat}>
                              Recurring
                            </Pill>
                          ) : (
                            <Pill tone="success" icon={Sparkles}>
                              New
                            </Pill>
                          )}
                        </td>
                        <td className="py-4 px-5 max-w-[18rem]">
                          <p className="truncate text-[#20282c]">{summary || "—"}</p>
                          <p className="text-xs text-[#64717a] mt-0.5">
                            {itemCount} {itemCount === 1 ? "item" : "items"} · #{o.id}
                          </p>
                        </td>
                        <td className="py-4 px-5">
                          {o.affiliate ? (
                            <Pill
                              tone="dark"
                              icon={o.affiliate.matchType === "recurring" ? Repeat : Tag}
                            >
                              {o.affiliate.promoCode || o.affiliate.name}
                            </Pill>
                          ) : (
                            <span className="text-xs text-[#64717a]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right font-sans">
                          {formatCurrency(toNum(o.total), o.currency)}
                        </td>
                        <td className="py-4 px-5">
                          <Pill
                            tone={
                              o.status === "refunded"
                                ? "danger"
                                : o.status === "completed"
                                  ? "success"
                                  : o.status === "processing"
                                    ? "neutral"
                                    : "warn"
                            }
                          >
                            {o.status === "pending"
                              ? "pending payment"
                              : o.status === "refunded" && o.returned
                                ? "refunded · returned"
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
                          <td colSpan={8} className="px-5 py-5">
                            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
                                  Products
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
                                      <span className="font-sans text-[#20282c]">
                                        {formatCurrency(toNum(it.total), o.currency)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="space-y-3 text-sm">
                                <DetailRow label="Order total">
                                  <span className="font-sans">
                                    {formatCurrency(toNum(o.total), o.currency)}
                                  </span>
                                </DetailRow>
                                <DetailRow label="Coupons">
                                  {o.couponCodes.length > 0 ? (
                                    <span className="font-sans text-xs">
                                      {o.couponCodes.join(", ")}
                                    </span>
                                  ) : (
                                    <span className="text-[#64717a]">None</span>
                                  )}
                                </DetailRow>
                                <DetailRow label="Affiliate">
                                  {o.affiliate ? (
                                    <span>
                                      {o.affiliate.name}
                                      {o.affiliate.promoCode
                                        ? ` (${o.affiliate.promoCode})`
                                        : ""}
                                    </span>
                                  ) : (
                                    <span className="text-[#64717a]">None</span>
                                  )}
                                </DetailRow>
                                {o.affiliate && (
                                  <DetailRow label="Commission">
                                    <span className="font-sans">
                                      {formatCurrency(o.affiliate.commission, o.currency)}
                                    </span>
                                  </DetailRow>
                                )}
                                <AttributionControl
                                  order={o}
                                  affiliates={affiliateOptions}
                                  value={attrChoice[o.id] ?? o.affiliate?.affiliateId ?? ""}
                                  saving={attrSaving.has(o.id)}
                                  onChange={(v) =>
                                    setAttrChoice((prev) => ({ ...prev, [o.id]: v }))
                                  }
                                  onAttribute={() =>
                                    attributeOrder(
                                      o.id,
                                      attrChoice[o.id] ?? o.affiliate?.affiliateId ?? ""
                                    )
                                  }
                                  onRemove={() => removeAttribution(o.id)}
                                />
                                <RefundControl
                                  order={o}
                                  saving={attrSaving.has(o.id)}
                                  onRefund={() => markRefund(o.id, "refund")}
                                  onReturn={() => markRefund(o.id, "return")}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
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

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AttributionControl({
  order,
  affiliates,
  value,
  saving,
  onChange,
  onAttribute,
  onRemove,
}: {
  order: AdminOrder;
  affiliates: AffiliateOption[];
  value: string;
  saving: boolean;
  onChange: (v: string) => void;
  onAttribute: () => void;
  onRemove: () => void;
}) {
  const current = order.affiliate;
  const locked = Boolean(current?.locked);
  // The picker only enables the button when the selection differs from what's
  // already saved (or nothing is saved yet), so re-clicking is a no-op.
  const changed = value !== "" && value !== (current?.affiliateId ?? "");

  return (
    <div className="mt-2 pt-3 border-t border-[#242526]/10">
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
        {current ? "Change attribution" : "Attribute to affiliate"}
      </p>
      {locked ? (
        <p className="flex items-center gap-1.5 text-xs text-[#64717a]">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Commission already paid out — remove it from the payout to reassign.
        </p>
      ) : affiliates.length === 0 ? (
        <p className="text-xs text-[#64717a]">No active affiliates to attribute to.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={value}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 glass-surface rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#242526]/15 disabled:opacity-60"
            >
              <option value="">Select an affiliate…</option>
              {affiliates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.promoCode ? ` (${a.promoCode})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAttribute}
              disabled={saving || !changed}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#242526] px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-white transition-opacity disabled:opacity-40 hover:opacity-90 whitespace-nowrap"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {current ? "Reassign" : "Attribute"}
            </button>
          </div>
          {current && (
            <button
              type="button"
              onClick={onRemove}
              disabled={saving}
              className="mt-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-red-600 transition-colors disabled:opacity-40"
            >
              Remove attribution
            </button>
          )}
          <p className="mt-2 text-xs text-[#64717a] leading-relaxed">
            Credits the affiliate as if their code was used — first-order rate on
            the net product total (after discounts, before shipping &amp; tax).
          </p>
        </>
      )}
    </div>
  );
}

function RefundControl({
  order,
  saving,
  onRefund,
  onReturn,
}: {
  order: AdminOrder;
  saving: boolean;
  onRefund: () => void;
  onReturn: () => void;
}) {
  const isRefunded = order.status === "refunded";

  if (isRefunded && order.returned) {
    return (
      <div className="mt-2 pt-3 border-t border-[#242526]/10">
        <p className="flex items-center gap-1.5 text-xs text-[#64717a]">
          <PackageCheck className="h-3.5 w-3.5 shrink-0" />
          Refunded and returned — units are back in inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-3 border-t border-[#242526]/10">
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
        {isRefunded ? "Refunded" : "Refund / return"}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        {!isRefunded && (
          <button
            type="button"
            onClick={onRefund}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-red-600/25 bg-red-600/5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-red-700 transition-colors hover:bg-red-600/10 disabled:opacity-40 whitespace-nowrap"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Undo2 className="h-3.5 w-3.5" />
            )}
            Mark refunded
          </button>
        )}
        <button
          type="button"
          onClick={onReturn}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#242526]/15 bg-[#242526]/5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] transition-colors hover:bg-[#242526]/10 disabled:opacity-40 whitespace-nowrap"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PackageCheck className="h-3.5 w-3.5" />
          )}
          {isRefunded ? "Mark returned — restock" : "Refunded + returned"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#64717a] leading-relaxed">
        {isRefunded
          ? "This order is already out of revenue. Mark it returned when the products come back to put the units into inventory."
          : "Refunded removes the order from revenue (stock stays deducted). Refunded + returned also puts the units back into inventory."}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
        {label}
      </span>
      <span className="text-right text-[#20282c]">{children}</span>
    </div>
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
