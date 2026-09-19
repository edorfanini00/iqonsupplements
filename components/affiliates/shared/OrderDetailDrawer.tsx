"use client";
import {providerMutationFetch} from '@/lib/affiliates/provider-mutation-fetch';

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Package,
  ShoppingBag,
  Repeat,
  Users,
  Gift,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Pill, bonusKindLabel, formatCurrency, formatShortDate } from "./ui";

interface OrderItem {
  productId?: number;
  name: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
  total?: number;
  imageUrl?: string;
  sku?: string;
}

interface OrderDetail {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring" | "referral" | "bonus";
  status: "pending" | "paid";
  createdAt: string;
  shopifyOrderId?: number;
  items?: OrderItem[];
  subtotal?: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  currency?: string;
  couponCode?: string;
  itemsSyncedAt?: string;
}

interface AffiliateRef {
  id: string;
  name: string;
  promoCode: string;
  commissionRate?: number;
}

interface RefreshState {
  enabled: boolean;
  attempted: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

interface ApiPayload {
  order: OrderDetail;
  affiliate: AffiliateRef | null;
  sourceAffiliate: AffiliateRef | null;
  refresh: RefreshState;
}

interface Props {
  orderId: string | null;
  onClose: () => void;
  /** When true, render the affiliate badge (admin viewing any order). */
  showAffiliate?: boolean;
}

export function OrderDetailDrawer({
  orderId,
  onClose,
  showAffiliate = false,
}: Props) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (id: string, refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await (refresh ? providerMutationFetch : fetch)(
          `/api/affiliates/orders/${id}${refresh ? "?refresh=1" : ""}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Failed to load order.");
          return;
        }
        const payload = (await res.json()) as ApiPayload;
        setData(payload);
      } catch {
        setError("Network error. Please retry.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (orderId) {
      setData(null);
      load(orderId);
    }
  }, [orderId, load]);

  // Lock body scroll while open
  useEffect(() => {
    if (!orderId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [orderId]);

  if (!orderId) return null;

  const order = data?.order;
  const cur = order?.currency ?? "USD";
  const fmt = (n: number) => formatCurrency(n, cur);
  // Bonus rows are synthetic (no Shopify order behind them): the "customer name"
  // carries the payment reason and only the commission amount is real money.
  const isBonus = order?.matchType === "bonus";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        className="absolute inset-0 bg-[#20282c]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative w-full max-w-xl glass-surface-strong h-full overflow-y-auto border-l border-[#242526]/10 shadow-2xl">
        <header className="sticky top-0 z-10 px-6 md:px-7 py-5 bg-[#fafbfb]/85 backdrop-blur-md border-b border-[#242526]/8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              {isBonus ? "Bonus detail" : "Order detail"}
            </p>
            <h2 className="text-xl font-medium tracking-tight truncate mt-0.5">
              {isBonus
                ? bonusKindLabel(order?.orderId ?? "")
                : `#${order?.orderId ?? orderId.slice(0, 8)}`}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data?.refresh.enabled && (
              <button
                type="button"
                onClick={() => orderId && load(orderId, true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 hover:bg-[#242526]/10 transition-colors disabled:opacity-50"
                title="Re-pull this order from Shopify"
              >
                <RefreshCw
                  className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Syncing…" : "Refresh"}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#242526]/8 hover:bg-[#242526]/15 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="px-6 md:px-7 py-6 space-y-7">
          {loading && !data && (
            <div className="space-y-3">
              {[60, 90, 75].map((w, i) => (
                <div
                  key={i}
                  className="h-4 bg-[#242526]/5 rounded animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )}

          {error && !data && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex gap-2 items-start text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {order && (
            <>
              {/* Top meta row */}
              <section className="flex flex-wrap items-center gap-2">
                <Pill
                  tone={order.matchType === "code" ? "dark" : "neutral"}
                  icon={
                    order.matchType === "code"
                      ? ShoppingBag
                      : order.matchType === "recurring"
                        ? Repeat
                        : order.matchType === "bonus"
                          ? Gift
                          : Users
                  }
                >
                  {order.matchType === "code"
                    ? "Code"
                    : order.matchType === "recurring"
                      ? "Recurring"
                      : order.matchType === "bonus"
                        ? bonusKindLabel(order.orderId)
                        : "Referral"}
                </Pill>
                <Pill tone={order.status === "paid" ? "success" : "warn"}>
                  {order.status}
                </Pill>
                <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                  {formatShortDate(order.createdAt)}
                </span>
                {order.couponCode && (
                  <span className="font-sans text-[11px] px-2 py-1 rounded-full bg-[#20282c]/5 text-[#20282c]">
                    {order.couponCode}
                  </span>
                )}
              </section>

              {/* Customer (or payment reason for bonus rows) */}
              <section>
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
                  {isBonus ? "Reason for payment" : "Customer"}
                </p>
                <p className="text-sm font-medium leading-tight">
                  {order.customerName}
                </p>
                {!isBonus && (
                  <p className="text-sm text-[#64717a]">{order.customerEmail}</p>
                )}
              </section>

              {/* Affiliate (admin context) */}
              {showAffiliate && data?.affiliate && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
                    Affiliate
                  </p>
                  <p className="text-sm font-medium leading-tight">
                    {data.affiliate.name}
                  </p>
                  <p className="text-xs text-[#64717a] font-sans">
                    {data.affiliate.promoCode}
                    {typeof data.affiliate.commissionRate === "number"
                      ? ` · ${data.affiliate.commissionRate}%`
                      : ""}
                  </p>
                </section>
              )}

              {/* Source affiliate (referral context) */}
              {data?.sourceAffiliate && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
                    Earned via referral of
                  </p>
                  <p className="text-sm font-medium leading-tight">
                    {data.sourceAffiliate.name}
                  </p>
                  <p className="text-xs text-[#64717a] font-sans">
                    {data.sourceAffiliate.promoCode}
                  </p>
                </section>
              )}

              {/* Cart breakdown (bonus rows have no cart) */}
              {!isBonus && (
              <section>
                <div className="flex items-end justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    Cart
                  </p>
                  {order.itemsSyncedAt && (
                    <p className="text-[10px] text-[#64717a] font-sans">
                      synced {formatShortDate(order.itemsSyncedAt)}
                    </p>
                  )}
                </div>

                {!order.items || order.items.length === 0 ? (
                  <div className="glass-surface rounded-lg p-5 text-center">
                    <Package className="h-5 w-5 text-[#64717a] mx-auto mb-2" />
                    <p className="text-sm text-[#64717a]">
                      No line items on file for this order yet.
                    </p>
                    {data.refresh.enabled && (
                      <button
                        type="button"
                        onClick={() => orderId && load(orderId, true)}
                        disabled={refreshing}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#20282c] text-white hover:bg-[#242526] disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${
                            refreshing ? "animate-spin" : ""
                          }`}
                        />
                        Pull from Shopify
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="glass-surface rounded-lg overflow-hidden divide-y divide-[#242526]/6">
                    {order.items.map((it, idx) => (
                      <li
                        key={`${it.sku ?? it.productId ?? idx}-${idx}`}
                        className="flex gap-3 px-4 py-3"
                      >
                        <div className="shrink-0 w-12 h-12 rounded-xl bg-[#242526]/5 overflow-hidden flex items-center justify-center">
                          {it.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-[#64717a]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {it.name}
                          </p>
                          <p className="text-xs text-[#64717a] mt-0.5 font-sans">
                            qty {it.quantity}
                            {typeof it.unitPrice === "number"
                              ? ` · ${fmt(it.unitPrice)} ea`
                              : ""}
                            {it.sku ? ` · ${it.sku}` : ""}
                          </p>
                        </div>
                        <div className="text-right font-sans text-sm tabular-nums shrink-0">
                          {typeof it.total === "number"
                            ? fmt(it.total)
                            : typeof it.subtotal === "number"
                              ? fmt(it.subtotal)
                              : "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              )}

              {/* Totals */}
              {isBonus ? (
                <section className="rounded-lg bg-[#20282c]/[0.03] border border-[#242526]/8 p-4 text-sm font-sans tabular-nums">
                  <Row label="Bonus amount" value={fmt(order.commission)} bold accent />
                </section>
              ) : (
              <section className="rounded-lg bg-[#20282c]/[0.03] border border-[#242526]/8 p-4 text-sm font-sans tabular-nums">
                <Row label="Subtotal" value={fmt(order.subtotal ?? 0)} />
                {(order.discountTotal ?? 0) > 0 && (
                  <Row
                    label={
                      order.couponCode
                        ? `Discount (${order.couponCode})`
                        : "Discount"
                    }
                    value={`−${fmt(order.discountTotal ?? 0)}`}
                    tone="negative"
                  />
                )}
                {(order.shippingTotal ?? 0) > 0 && (
                  <Row label="Shipping" value={fmt(order.shippingTotal ?? 0)} />
                )}
                {(order.taxTotal ?? 0) > 0 && (
                  <Row label="Tax" value={fmt(order.taxTotal ?? 0)} />
                )}
                <Row
                  label="Order total"
                  value={fmt(order.orderTotal)}
                  bold
                  divider
                />
                {(() => {
                  // Commission is earned on the net product revenue: order
                  // total minus shipping and taxes. Surface that explicitly so
                  // the percentage is transparent.
                  const base = Math.max(
                    0,
                    order.orderTotal -
                      (order.shippingTotal ?? 0) -
                      (order.taxTotal ?? 0)
                  );
                  const hasExclusions = base < order.orderTotal;
                  const pct =
                    base > 0
                      ? (Math.round((order.commission / base) * 1000) / 10)
                          .toString()
                          .replace(/\.0$/, "")
                      : null;
                  return (
                    <>
                      {hasExclusions && (
                        <Row
                          label="Commissionable (excl. shipping & tax)"
                          value={fmt(base)}
                        />
                      )}
                      <Row
                        label={
                          pct != null
                            ? `Your commission (${pct}%)`
                            : "Your commission"
                        }
                        value={fmt(order.commission)}
                        bold
                        accent
                      />
                    </>
                  );
                })()}
              </section>
              )}
              {!isBonus && (
                <p className="text-[11px] text-[#64717a] -mt-4">
                  Commissions are calculated on the order total after shipping and
                  taxes.
                </p>
              )}

              {/* Refresh error inline */}
              {data.refresh.error && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex gap-2 items-start text-xs text-amber-900">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Refresh from Shopify failed: {data.refresh.error}
                  </span>
                </div>
              )}

              {/* Footer link to shopify */}
              {order.shopifyOrderId && (
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] flex items-center gap-1.5">
                  <ExternalLink className="h-3 w-3" />
                  Shopify order #{order.shopifyOrderId}
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
  tone,
  divider,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  tone?: "negative";
  divider?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${
        divider ? "mt-1.5 pt-3 border-t border-[#242526]/10" : ""
      }`}
    >
      <span
        className={`${bold ? "text-[#20282c]" : "text-[#64717a]"} ${
          bold ? "font-medium" : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`${
          accent
            ? "text-[#20282c] font-medium"
            : tone === "negative"
              ? "text-[#64717a]"
              : "text-[#20282c]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
