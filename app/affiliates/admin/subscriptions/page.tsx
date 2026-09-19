"use client";
import {providerMutationFetch} from '@/lib/affiliates/provider-mutation-fetch';

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Repeat,
  AlertCircle,
  Pause,
  Play,
  X,
  Zap,
  Ban,
  Loader2,
  CreditCard,
  Tag,
  CheckCircle2,
  DollarSign,
  Wallet,
  Percent,
  Package,
  Users,
  ChevronRight,
  Truck,
  CalendarClock,
  Plus,
  Minus,
  Trash2,
  Search,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import {
  subscriptionIntervalLabel,
  SUBSCRIPTION_INTERVAL_OPTIONS,
} from "@/lib/subscriptions/config";

interface SubscriptionLine {
  productId: number;
  name: string;
  quantity: number;
}

interface CatalogProduct {
  id: number;
  name: string;
  price: number;
}

interface AdminSubscription {
  id: string;
  status: string;
  customerName: string;
  customerEmail: string;
  provider: string;
  items: SubscriptionLine[];
  total: number | null;
  intervalDays: number;
  discountPercent: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
  firstOrderId: number | null;
  lastOrderId: number | null;
  nextBillingAt: string;
  lastChargedAt: string | null;
  failedAttempts: number;
  lastError: string | null;
  couponCode: string | null;
  shipping: { city: string; state: string; postcode: string; country: string };
  affiliate: { name: string; code: string } | null;
  /** Timed pause: cron auto-resumes after this date. Null = indefinite pause. */
  pausedUntil: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface Summary {
  total: number;
  active: number;
  pastDue: number;
  paused: number;
  cancelled: number;
}

interface ProductForecastCustomer {
  name: string;
  email: string;
  quantity: number;
}

interface ProductForecast {
  productId: number;
  name: string;
  unitsPerMonth: number;
  monthlyRevenue: number;
  subscriberCount: number;
  customers: ProductForecastCustomer[];
}

interface AffiliateCommissionLine {
  subscriptionId: string;
  customerName: string;
  affiliateName: string;
  affiliateCode: string;
  ratePercent: number;
  commissionBase: number;
  monthlyCommission: number;
}

interface Metrics {
  currency: string;
  billingCount: number;
  monthlyGross: number;
  monthlyFees: number;
  monthlyAffiliate: number;
  affiliateAttributedCount: number;
  affiliateLines: AffiliateCommissionLine[];
  monthlyNet: number;
  monthlyNetAfterAffiliate: number;
  annualNet: number;
  feePercent: number;
  feeFixed: number;
  missingPriceItems: number;
  cashThisMonth: number;
  cashThisMonthCharges: number;
  cashMonthLabel: string;
  products: ProductForecast[];
}

const ACTIVE_STATUSES = new Set(["active", "charging", "past_due", "paused"]);
type Filter = "all" | "active" | "past_due" | "paused" | "cancelled";

function statusTone(status: string): "dark" | "neutral" | "success" | "warn" {
  if (status === "active") return "success";
  if (status === "past_due" || status === "paused" || status === "refunded")
    return "warn";
  if (status === "charging") return "dark";
  return "neutral";
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    charging: "Processing",
    past_due: "Payment retrying",
    paused: "Paused",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

function itemsLabel(items: { name: string; quantity: number }[]): string {
  if (!items.length) return "—";
  return items
    .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
    .join(", ");
}

function cardLabel(sub: AdminSubscription): string {
  if (!sub.cardBrand && !sub.cardLast4) return "—";
  return `${sub.cardBrand ?? "Card"} •••• ${sub.cardLast4 ?? ""}`.trim();
}

/**
 * Time of day (Eastern) a subscription bills. The renewal cron runs daily at
 * 5:00 AM ET, so a plan due later in the day is actually charged the next
 * morning's run.
 */
function formatChargeTime(iso: string): string {
  return (
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }) + " ET"
  );
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"overview" | "upcoming">("overview");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(
    () => new Set()
  );
  const [showNetDetail, setShowNetDetail] = useState(false);
  const [showAffiliateDetail, setShowAffiliateDetail] = useState(false);

  const toggleProduct = useCallback((productId: number) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/subscriptions", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions ?? []);
        setSummary(data.summary ?? null);
        setMetrics(data.metrics ?? null);
        setCatalog(data.catalog ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    const searched = q
      ? subscriptions.filter(
          (s) =>
            s.customerName.toLowerCase().includes(q) ||
            s.customerEmail.toLowerCase().includes(q)
        )
      : subscriptions;
    if (filter === "all") return searched;
    const matching = searched.filter((s) => s.status === filter);
    if (filter === "cancelled") {
      // Most recently cancelled first, so fresh churn is easy to spot.
      return [...matching].sort(
        (a, b) =>
          new Date(b.cancelledAt ?? b.createdAt).getTime() -
          new Date(a.cancelledAt ?? a.createdAt).getTime()
      );
    }
    return matching;
  }, [subscriptions, filter, query]);

  // Renewals due in the next 3 days (or overdue) — the "about to ship" window.
  const comingUp = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() + 4); // includes today + 3 full days
    return subscriptions
      .filter(
        (s) =>
          UPCOMING_STATUSES.has(s.status) && new Date(s.nextBillingAt) < cutoff
      )
      .sort(
        (a, b) =>
          new Date(a.nextBillingAt).getTime() - new Date(b.nextBillingAt).getTime()
      );
  }, [subscriptions]);

  const active = useMemo(
    () => subscriptions.find((s) => s.id === activeId) ?? null,
    [subscriptions, activeId]
  );

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: summary?.total ?? subscriptions.length },
    { key: "active", label: "Active", count: summary?.active ?? 0 },
    { key: "past_due", label: "Retrying", count: summary?.pastDue ?? 0 },
    { key: "paused", label: "Paused", count: summary?.paused ?? 0 },
    { key: "cancelled", label: "Cancelled", count: summary?.cancelled ?? 0 },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Recurring"
        title="Subscriptions"
        description="Every Subscribe & Save plan. Renewals auto-charge the saved card and create real WooCommerce orders, so affiliate commissions are credited automatically. Failed charges retry, then pause and email the customer."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard icon={RefreshCw} label="Total" value={summary ? String(summary.total) : "—"} />
        <StatCard icon={Repeat} label="Active" value={summary ? String(summary.active) : "—"} accent />
        <StatCard icon={AlertCircle} label="Payment retrying" value={summary ? String(summary.pastDue) : "—"} />
        <StatCard icon={Pause} label="Paused" value={summary ? String(summary.paused) : "—"} />
      </section>

      <div className="flex flex-wrap gap-2 mb-5">
        {(["overview", "upcoming"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
              view === v
                ? "bg-[#242526] text-white"
                : "glass-surface text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            {v === "overview" ? (
              <>
                <Repeat className="h-3.5 w-3.5" /> Overview
              </>
            ) : (
              <>
                <CalendarClock className="h-3.5 w-3.5" /> Upcoming
              </>
            )}
          </button>
        ))}
      </div>

      {view === "upcoming" && (
        <UpcomingView
          subscriptions={subscriptions}
          loading={loading}
          onSelect={setActiveId}
        />
      )}

      {view === "overview" && (
        <>
      {metrics && metrics.billingCount > 0 && (
        <section className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard
              icon={DollarSign}
              label="Monthly recurring revenue"
              value={formatCurrency(metrics.monthlyGross)}
              hint={`${metrics.billingCount} billing ${
                metrics.billingCount === 1 ? "plan" : "plans"
              } · smoothed run rate`}
            />
            <StatCard
              icon={CalendarClock}
              label={`Cash expected in ${metrics.cashMonthLabel}`}
              value={formatCurrency(metrics.cashThisMonth)}
              hint={`${metrics.cashThisMonthCharges} charge${
                metrics.cashThisMonthCharges === 1 ? "" : "s"
              } still due by month end · real billing dates`}
            />
            <button
              type="button"
              onClick={() => setShowNetDetail((v) => !v)}
              className="text-left w-full rounded-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-expanded={showNetDetail}
            >
              <StatCard
                icon={Wallet}
                label="Net income / month"
                value={formatCurrency(metrics.monthlyNetAfterAffiliate)}
                hint={`${formatCurrency(metrics.annualNet)}/yr · ${
                  showNetDetail ? "Hide" : "Tap for"
                } breakdown`}
                accent
              />
            </button>
          </div>

          {showNetDetail && (
            <div className="glass-surface rounded-lg p-6 md:p-7 mt-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    Net income breakdown
                  </p>
                  <h2 className="text-lg font-medium tracking-tight mt-1">
                    Monthly line items
                  </h2>
                </div>
                <Wallet className="h-4 w-4 text-[#64717a]" />
              </div>
              <dl className="text-sm">
                <div className="flex items-center justify-between py-2.5 border-t border-[#242526]/5">
                  <dt className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-[#64717a]" />
                    Monthly recurring revenue
                    <span className="text-[11px] text-[#64717a]">
                      ({metrics.billingCount} billing{" "}
                      {metrics.billingCount === 1 ? "plan" : "plans"})
                    </span>
                  </dt>
                  <dd className="font-sans">
                    {formatCurrency(metrics.monthlyGross)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5 border-t border-[#242526]/5">
                  <dt className="flex items-center gap-2">
                    <Percent className="h-3.5 w-3.5 text-[#64717a]" />
                    Processing fees
                    <span className="text-[11px] text-[#64717a]">
                      ({metrics.feePercent}% + {formatCurrency(metrics.feeFixed)}{" "}
                      / charge)
                    </span>
                  </dt>
                  <dd className="font-sans text-red-600">
                    − {formatCurrency(metrics.monthlyFees)}
                  </dd>
                </div>
                <div className="border-t border-[#242526]/5">
                  <button
                    type="button"
                    onClick={() => setShowAffiliateDetail((v) => !v)}
                    className="w-full flex items-center justify-between py-2.5 text-left hover:bg-[#242526]/[0.03] rounded-lg transition-colors"
                    aria-expanded={showAffiliateDetail}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-[#64717a] transition-transform ${
                          showAffiliateDetail ? "rotate-90" : ""
                        }`}
                      />
                      <Users className="h-3.5 w-3.5 text-[#64717a]" />
                      Affiliate commissions
                      <span className="text-[11px] text-[#64717a]">
                        ({metrics.affiliateAttributedCount} of{" "}
                        {metrics.billingCount} plans)
                      </span>
                    </span>
                    <span className="font-sans text-red-600">
                      − {formatCurrency(metrics.monthlyAffiliate)}
                    </span>
                  </button>
                  {showAffiliateDetail && (
                    <div className="pb-2 pl-5">
                      {metrics.affiliateLines.length === 0 ? (
                        <p className="text-[11px] text-[#64717a] py-1.5">
                          No billing subscriptions are attributed to an affiliate
                          right now, so no recurring commission is owed.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[#242526]/5">
                          {metrics.affiliateLines.map((line) => (
                            <li
                              key={line.subscriptionId}
                              className="flex items-center justify-between gap-3 py-1.5"
                            >
                              <span className="min-w-0">
                                <span className="block truncate">
                                  {line.customerName}
                                </span>
                                <span className="block truncate text-[11px] text-[#64717a]">
                                  {line.affiliateName}
                                  {line.affiliateCode
                                    ? ` · ${line.affiliateCode}`
                                    : ""}{" "}
                                  · {line.ratePercent}% of{" "}
                                  {formatCurrency(line.commissionBase)}/charge
                                </span>
                              </span>
                              <span className="shrink-0 font-sans text-red-600">
                                − {formatCurrency(line.monthlyCommission)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between py-3 border-t-2 border-[#242526]/10 mt-1">
                  <dt className="flex items-center gap-2 font-medium">
                    <Wallet className="h-3.5 w-3.5 text-[#64717a]" />
                    Net income / month
                  </dt>
                  <dd className="font-sans font-medium">
                    {formatCurrency(metrics.monthlyNetAfterAffiliate)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <dt className="text-[11px] text-[#64717a]">
                    Annual run-rate (× 12)
                  </dt>
                  <dd className="font-sans text-[11px] text-[#64717a]">
                    {formatCurrency(metrics.annualNet)}
                  </dd>
                </div>
              </dl>
              {metrics.missingPriceItems > 0 && (
                <p className="text-[11px] text-[#64717a] mt-3">
                  Some items couldn&apos;t be priced from the catalog, so these
                  figures may be understated.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Coming up: renewals within 3 days — what's about to ship. */}
      {!loading && (
        <section
          className={`glass-surface rounded-lg p-6 md:p-7 mb-6 ${
            comingUp.length > 0 ? "border border-amber-300/60" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                Coming up
              </p>
              <h2 className="text-lg font-medium tracking-tight mt-1">
                Shipping in the next 3 days
              </h2>
            </div>
            <span className="inline-flex items-center gap-2">
              {comingUp.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-sans bg-amber-100 border border-amber-300 text-amber-900">
                  {comingUp.length}
                </span>
              )}
              <Truck className="h-4 w-4 text-[#64717a]" />
            </span>
          </div>
          {comingUp.length === 0 ? (
            <p className="text-sm text-[#64717a]">
              Nothing renews in the next 3 days. Plans show up here 3 days before
              their charge so you can prepare the shipment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    <th className="px-3 py-2 font-normal">When</th>
                    <th className="px-3 py-2 font-normal">Customer</th>
                    <th className="px-3 py-2 font-normal">Items to ship</th>
                    <th className="px-3 py-2 font-normal text-right">Total</th>
                    <th className="px-3 py-2 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comingUp.map((sub) => {
                    const overdue = relativeDayLabel(sub.nextBillingAt).includes("overdue");
                    const today = relativeDayLabel(sub.nextBillingAt) === "Today";
                    return (
                      <tr
                        key={sub.id}
                        onClick={() => setActiveId(sub.id)}
                        className="border-t border-[#242526]/5 align-top cursor-pointer hover:bg-[#242526]/[0.03] transition-colors"
                      >
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p
                            className={`font-medium ${
                              overdue || today ? "text-amber-700" : ""
                            }`}
                          >
                            {relativeDayLabel(sub.nextBillingAt)}
                          </p>
                          <p className="text-[11px] text-[#64717a]">
                            {formatShortDate(sub.nextBillingAt)} ·{" "}
                            {formatChargeTime(sub.nextBillingAt)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{sub.customerName}</p>
                          <p className="text-[11px] text-[#64717a]">
                            {sub.customerEmail}
                          </p>
                        </td>
                        <td className="px-3 py-3 max-w-[260px]">
                          <p className="leading-snug">{itemsLabel(sub.items)}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-sans whitespace-nowrap">
                          {sub.total != null ? formatCurrency(sub.total) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Pill tone={statusTone(sub.status)}>
                            {statusLabel(sub.status)}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {metrics && metrics.products.length > 0 && (
        <section className="glass-surface rounded-lg p-6 md:p-7 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                Fulfilment
              </p>
              <h2 className="text-lg font-medium tracking-tight mt-1">
                Ships every month
              </h2>
            </div>
            <Package className="h-4 w-4 text-[#64717a]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                  <th className="px-3 py-2 font-normal">Peptide</th>
                  <th className="px-3 py-2 font-normal text-right">Units / mo</th>
                  <th className="px-3 py-2 font-normal text-right">Subscribers</th>
                  <th className="px-3 py-2 font-normal text-right">Revenue / mo</th>
                </tr>
              </thead>
              <tbody>
                {metrics.products.map((p) => {
                  const expanded = expandedProducts.has(p.productId);
                  const hasCustomers = p.customers.length > 0;
                  return (
                    <Fragment key={p.productId}>
                      <tr
                        className={`border-t border-[#242526]/5 ${
                          hasCustomers
                            ? "cursor-pointer hover:bg-[#242526]/[0.03]"
                            : ""
                        }`}
                        onClick={
                          hasCustomers
                            ? () => toggleProduct(p.productId)
                            : undefined
                        }
                      >
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            {hasCustomers && (
                              <ChevronRight
                                className={`h-3.5 w-3.5 text-[#64717a] transition-transform ${
                                  expanded ? "rotate-90" : ""
                                }`}
                              />
                            )}
                            {p.name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-sans">
                          {p.unitsPerMonth.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-right font-sans text-[#64717a]">
                          {p.subscriberCount}
                        </td>
                        <td className="px-3 py-3 text-right font-sans">
                          {formatCurrency(p.monthlyRevenue)}
                        </td>
                      </tr>
                      {expanded && hasCustomers && (
                        <tr className="border-t border-[#242526]/5 bg-[#242526]/[0.02]">
                          <td colSpan={4} className="px-3 py-2">
                            <ul className="divide-y divide-[#242526]/5">
                              {p.customers.map((c, i) => (
                                <li
                                  key={`${c.email || c.name}-${i}`}
                                  className="flex items-center justify-between gap-3 py-1.5 pl-5"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate">
                                      {c.name}
                                    </span>
                                    {c.email && (
                                      <span className="block truncate text-[11px] text-[#64717a]">
                                        {c.email}
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0 font-sans text-[#64717a]">
                                    {c.quantity} / charge
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {metrics.missingPriceItems > 0 && (
            <p className="text-[11px] text-[#64717a] mt-3">
              Some items couldn&apos;t be priced from the catalog, so revenue
              may be understated.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a] pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="glass-surface rounded-full pl-9 pr-4 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#242526]/15 placeholder:text-[#64717a]/70"
          />
        </div>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
              filter === f.key
                ? "bg-[#242526] text-white"
                : "glass-surface text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            {f.label}
            <span
              className={`px-1.5 py-0.5 rounded-full leading-none ${
                filter === f.key ? "bg-white/15 text-white" : "bg-[#242526]/8 text-[#64717a]"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={query ? Search : RefreshCw}
          title={query ? `No matches for “${query}”` : "No subscriptions"}
          description={
            query
              ? "Try a different name or email, or clear the search."
              : "Subscribe & Save plans will appear here as customers sign up."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg p-2 md:p-3 overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Items</th>
                <th className="px-4 py-3 font-normal text-right">Total</th>
                <th className="px-4 py-3 font-normal">Frequency</th>
                <th className="px-4 py-3 font-normal">Affiliate</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Next order</th>
                <th className="px-4 py-3 font-normal">Last charge</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => setActiveId(sub.id)}
                  className="border-t border-[#242526]/5 align-top cursor-pointer hover:bg-[#242526]/[0.03] transition-colors"
                >
                  <td className="px-4 py-4">
                    <p className="font-medium">{sub.customerName}</p>
                    <p className="text-[11px] text-[#64717a]">{sub.customerEmail}</p>
                  </td>
                  <td className="px-4 py-4 max-w-[220px]">
                    <p className="leading-snug">{itemsLabel(sub.items)}</p>
                    <p className="text-[11px] text-[#64717a] mt-1">Save {Math.round(sub.discountPercent)}%</p>
                  </td>
                  <td className="px-4 py-4 text-right font-sans whitespace-nowrap">
                    {sub.total != null ? (
                      <>
                        {formatCurrency(sub.total)}
                        <span className="block text-[11px] text-[#64717a]">
                          / charge
                        </span>
                      </>
                    ) : (
                      <span className="text-[#64717a]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">{subscriptionIntervalLabel(sub.intervalDays)}</td>
                  <td className="px-4 py-4">
                    {sub.affiliate ? (
                      <>
                        <p className="leading-snug">{sub.affiliate.name}</p>
                        {sub.affiliate.code && (
                          <p className="text-[11px] text-[#64717a] mt-1 font-sans uppercase">
                            {sub.affiliate.code}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-[#64717a]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Pill tone={statusTone(sub.status)}>{statusLabel(sub.status)}</Pill>
                    {(sub.status === "cancelled" || sub.status === "refunded") &&
                      sub.cancelledAt && (
                        <p className="text-[11px] text-[#64717a] mt-1 whitespace-nowrap">
                          {formatShortDate(sub.cancelledAt)}
                        </p>
                      )}
                    {sub.failedAttempts > 0 && sub.status !== "active" && (
                      <p className="text-[11px] text-[#64717a] mt-1">
                        {sub.failedAttempts} failed{" "}
                        {sub.failedAttempts === 1 ? "attempt" : "attempts"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-[#64717a]">
                    {ACTIVE_STATUSES.has(sub.status) ? (
                      <>
                        {formatShortDate(sub.nextBillingAt)}
                        <span className="block text-[11px]">
                          {formatChargeTime(sub.nextBillingAt)}
                        </span>
                      </>
                    ) : sub.status === "paused" && sub.pausedUntil ? (
                      <>
                        {formatShortDate(sub.pausedUntil)}
                        <span className="block text-[11px]">resumes</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <LastChargeCell sub={sub} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {active && (
        <SubscriptionDrawer
          sub={active}
          catalog={catalog}
          onClose={() => setActiveId(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

/** Statuses that will actually bill going forward (so they have an upcoming order). */
const UPCOMING_STATUSES = new Set(["active", "charging", "past_due"]);

/** Human "Today / Tomorrow / in 3d / 2d overdue" label from an ISO date. */
function relativeDayLabel(iso: string): string {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - t0.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}

/**
 * Upcoming renewals view: pulls the current date and buckets active plans by
 * their next charge — overdue, today (what to ship), next 7 days, later — and
 * shows whether the last charge went through.
 */
function UpcomingView({
  subscriptions,
  loading,
  onSelect,
}: {
  subscriptions: AdminSubscription[];
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const t1 = new Date(t0);
    t1.setDate(t1.getDate() + 1);
    const week = new Date(t0);
    week.setDate(week.getDate() + 7);

    const buckets: Record<"overdue" | "today" | "week" | "later", AdminSubscription[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
    };
    for (const s of subscriptions) {
      if (!UPCOMING_STATUSES.has(s.status)) continue;
      const d = new Date(s.nextBillingAt);
      if (d < t0) buckets.overdue.push(s);
      else if (d < t1) buckets.today.push(s);
      else if (d < week) buckets.week.push(s);
      else buckets.later.push(s);
    }
    const byDate = (a: AdminSubscription, b: AdminSubscription) =>
      new Date(a.nextBillingAt).getTime() - new Date(b.nextBillingAt).getTime();
    buckets.overdue.sort(byDate);
    buckets.today.sort(byDate);
    buckets.week.sort(byDate);
    buckets.later.sort(byDate);
    return buckets;
  }, [subscriptions]);

  if (loading) {
    return (
      <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
        Loading…
      </div>
    );
  }

  const total =
    groups.overdue.length +
    groups.today.length +
    groups.week.length +
    groups.later.length;

  if (total === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing upcoming"
        description="Active plans and their next charge dates will appear here."
      />
    );
  }

  const sections: { key: string; label: string; items: AdminSubscription[] }[] = [
    { key: "overdue", label: "Overdue", items: groups.overdue },
    { key: "today", label: "Ship today", items: groups.today },
    { key: "week", label: "Next 7 days", items: groups.week },
    { key: "later", label: "Later", items: groups.later },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard
          icon={Truck}
          label="Ship today"
          value={String(groups.today.length + groups.overdue.length)}
          hint={
            groups.overdue.length > 0
              ? `${groups.overdue.length} overdue included`
              : "due today"
          }
          accent
        />
        <StatCard
          icon={CalendarClock}
          label="Next 7 days"
          value={String(groups.week.length)}
        />
        <StatCard icon={Repeat} label="Upcoming total" value={String(total)} />
      </section>

      {sections
        .filter((s) => s.items.length > 0)
        .map((section) => (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              {section.label}
              <span className="px-1.5 py-0.5 rounded-full leading-none bg-[#242526]/8">
                {section.items.length}
              </span>
            </div>
            <div className="glass-surface rounded-lg p-2 md:p-3 overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    <th className="px-4 py-3 font-normal">Customer</th>
                    <th className="px-4 py-3 font-normal">Items</th>
                    <th className="px-4 py-3 font-normal text-right">Total</th>
                    <th className="px-4 py-3 font-normal">Next order</th>
                    <th className="px-4 py-3 font-normal">Last payment</th>
                    <th className="px-4 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((sub) => (
                    <tr
                      key={sub.id}
                      onClick={() => onSelect(sub.id)}
                      className="border-t border-[#242526]/5 align-top cursor-pointer hover:bg-[#242526]/[0.03] transition-colors"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium">{sub.customerName}</p>
                        <p className="text-[11px] text-[#64717a]">
                          {sub.customerEmail}
                        </p>
                      </td>
                      <td className="px-4 py-4 max-w-[220px]">
                        <p className="leading-snug">{itemsLabel(sub.items)}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-sans whitespace-nowrap">
                        {sub.total != null ? formatCurrency(sub.total) : "—"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="font-medium">
                          {formatShortDate(sub.nextBillingAt)}
                        </p>
                        <p className="text-[11px] text-[#64717a]">
                          {relativeDayLabel(sub.nextBillingAt)} ·{" "}
                          {formatChargeTime(sub.nextBillingAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <LastChargeCell sub={sub} />
                      </td>
                      <td className="px-4 py-4">
                        <Pill tone={statusTone(sub.status)}>
                          {statusLabel(sub.status)}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}

/**
 * Last renewal outcome. A failed last charge (status past_due/paused) shows in
 * red; a successful one shows the date in green; otherwise "Never".
 */
function LastChargeCell({ sub }: { sub: AdminSubscription }) {
  if (sub.status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-600">
        <Ban className="h-3.5 w-3.5" /> Refunded
      </span>
    );
  }
  const failed = sub.status === "past_due" || sub.status === "paused";
  if (failed) {
    return (
      <span className="inline-flex flex-col">
        <span className="inline-flex items-center gap-1 font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> Failed
        </span>
        {sub.lastChargedAt && (
          <span className="text-[11px] text-[#64717a] mt-0.5">
            last ok {formatShortDate(sub.lastChargedAt)}
          </span>
        )}
      </span>
    );
  }
  if (sub.status === "charging") {
    return <span className="text-[#64717a]">Processing…</span>;
  }
  if (sub.lastChargedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {formatShortDate(sub.lastChargedAt)}
      </span>
    );
  }
  return <span className="text-[#64717a]">Never</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[#242526]/6">
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[#20282c] text-right">{value}</span>
    </div>
  );
}

/**
 * Edit the products a plan ships each cycle without cancelling it. Changes only
 * take effect on the next renewal (nothing is charged on save); prices come
 * from the live catalog at charge time.
 */
function ItemsEditor({
  sub,
  catalog,
  busy,
  onSave,
}: {
  sub: AdminSubscription;
  catalog: CatalogProduct[];
  busy: string | null;
  onSave: (items: { productId: number; quantity: number }[]) => void;
}) {
  const [items, setItems] = useState<SubscriptionLine[]>(() =>
    sub.items.map((i) => ({ ...i }))
  );
  const [addId, setAddId] = useState("");

  // Re-sync with the saved list after a reload (e.g. right after saving).
  const savedKey = JSON.stringify(sub.items.map((i) => [i.productId, i.quantity]));
  useEffect(() => {
    setItems(sub.items.map((i) => ({ ...i })));
    setAddId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.id, savedKey]);

  const dirty =
    savedKey !== JSON.stringify(items.map((i) => [i.productId, i.quantity]));

  const inList = new Set(items.map((i) => i.productId));
  const addable = catalog.filter((p) => !inList.has(p.id));
  const priceById = useMemo(
    () => new Map(catalog.map((p) => [p.id, p.price])),
    [catalog]
  );

  // Estimated discounted product subtotal (shipping excluded — it's stored
  // separately on the plan). Only shown when every line can be priced.
  const estimate = useMemo(() => {
    let subtotal = 0;
    for (const item of items) {
      const price = priceById.get(item.productId);
      if (price == null || price <= 0) return null;
      subtotal += price * item.quantity;
    }
    return subtotal * (1 - (sub.discountPercent || 0) / 100);
  }, [items, priceById, sub.discountPercent]);

  const setQty = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(50, Math.max(1, i.quantity + delta)) }
          : i
      )
    );
  };

  const addProduct = () => {
    const id = parseInt(addId, 10);
    const product = catalog.find((p) => p.id === id);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      { productId: product.id, name: product.name, quantity: 1 },
    ]);
    setAddId("");
  };

  return (
    <div className="mt-6">
      <label className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2 block">
        Products per delivery
      </label>
      <div className="rounded-lg border border-[#242526]/10 bg-white/50 divide-y divide-[#242526]/6">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug truncate">{item.name}</p>
              {priceById.get(item.productId) != null && (
                <p className="text-[11px] text-[#64717a] font-sans">
                  {formatCurrency(priceById.get(item.productId) ?? 0)} each
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setQty(item.productId, -1)}
                disabled={item.quantity <= 1}
                className="p-1.5 rounded-full bg-[#242526]/5 hover:bg-[#242526]/10 disabled:opacity-30 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-7 text-center text-sm font-sans">{item.quantity}</span>
              <button
                onClick={() => setQty(item.productId, 1)}
                className="p-1.5 rounded-full bg-[#242526]/5 hover:bg-[#242526]/10 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={() =>
                setItems((prev) => prev.filter((i) => i.productId !== item.productId))
              }
              disabled={items.length <= 1}
              className="p-1.5 rounded-full text-red-600 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label="Remove product"
              title={items.length <= 1 ? "A plan needs at least one product" : "Remove"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-3.5 py-3 text-sm text-[#64717a]">
            Add at least one product below.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-[#242526]/12 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#242526]/40"
        >
          <option value="">Add a product…</option>
          {addable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.price > 0 ? ` — ${formatCurrency(p.price)}` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={addProduct}
          disabled={!addId}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-[#64717a]">
          {estimate != null && items.length > 0 ? (
            <>
              ≈ {formatCurrency(estimate)}/charge after {Math.round(sub.discountPercent)}%
              discount, + shipping.{" "}
            </>
          ) : null}
          Applies from the next renewal — nothing is charged now.
        </p>
        <button
          onClick={() =>
            onSave(items.map((i) => ({ productId: i.productId, quantity: i.quantity })))
          }
          disabled={busy != null || !dirty || items.length === 0}
          className="shrink-0 rounded-xl px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "set_items" ? "Saving…" : "Save products"}
        </button>
      </div>
    </div>
  );
}

function SubscriptionDrawer({
  sub,
  catalog,
  onClose,
  onChanged,
}: {
  sub: AdminSubscription;
  catalog: CatalogProduct[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [freq, setFreq] = useState(sub.intervalDays);
  const [pauseDays, setPauseDays] = useState(0);

  const runAction = useCallback(
    async (action: string, extra?: Record<string, unknown>, confirmMsg?: string) => {
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      setBusy(action);
      setError(null);
      setNotice(null);
      try {
        const res = await providerMutationFetch(`/api/affiliates/admin/subscriptions/${sub.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          setError(data?.error || "Action failed.");
          return;
        }
        if (action === "charge_now") {
          setNotice(`Charged successfully — order #${data.wooOrderId} ($${data.total}).`);
        }
        if (action === "set_items") {
          setNotice("Products updated — the next renewal will ship the new items.");
        }
        if (action === "pause") {
          setNotice(
            data.pausedUntil
              ? `Paused — automatically resumes ${formatShortDate(data.pausedUntil)}.`
              : "Paused until you resume it manually."
          );
        }
        if (action === "refund") {
          const n = Number(data.commissionsVoided ?? 0);
          setNotice(
            n > 0
              ? `Marked refunded — removed ${n} unpaid affiliate commission${
                  n === 1 ? "" : "s"
                }.`
              : "Marked refunded. No unpaid affiliate commission to remove."
          );
        }
        await onChanged();
      } catch {
        setError("Action failed. Please try again.");
      } finally {
        setBusy(null);
      }
    },
    [sub.id, onChanged]
  );

  const isCancelled = sub.status === "cancelled";
  const isEnded = sub.status === "cancelled" || sub.status === "refunded";
  const canPause = ["active", "past_due", "charging"].includes(sub.status);
  const canResume = ["paused", "past_due"].includes(sub.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#20282c]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface-strong rounded-lg p-7 md:p-9 max-w-xl w-full max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#242526]/5"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1">
          Subscription · {subscriptionIntervalLabel(sub.intervalDays)}
        </p>
        <h3 className="text-2xl font-medium tracking-tight">{sub.customerName}</h3>
        <p className="text-sm text-[#64717a] mt-0.5">{sub.customerEmail}</p>

        <div className="mt-3 flex items-center gap-2">
          <Pill tone={statusTone(sub.status)}>{statusLabel(sub.status)}</Pill>
          <Pill tone="neutral">{sub.provider === "stripe" ? "Stripe" : "Square"}</Pill>
        </div>

        {/* Charge health */}
        <div
          className={`mt-5 rounded-lg border p-4 ${
            sub.status === "past_due" || sub.status === "paused"
              ? "bg-amber-500/10 border-amber-600/20"
              : "bg-emerald-500/8 border-emerald-600/15"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[#20282c]">
            {sub.status === "past_due" || sub.status === "paused" ? (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            {sub.status === "paused"
              ? sub.pausedUntil
                ? `Paused — resumes ${formatShortDate(sub.pausedUntil)}`
                : sub.failedAttempts > 0
                  ? "Paused after failed charges"
                  : "Paused until manually resumed"
              : sub.status === "past_due"
                ? "Last charge failed — retrying automatically"
                : sub.lastChargedAt
                  ? "Last charge went through"
                  : "Awaiting first renewal"}
          </div>
          {sub.lastError && (sub.status === "past_due" || sub.status === "paused") && (
            <p className="text-[12px] text-[#64717a] mt-1.5">{sub.lastError}</p>
          )}
          {sub.failedAttempts > 0 && (
            <p className="text-[11px] text-[#64717a] mt-1">
              {sub.failedAttempts} failed {sub.failedAttempts === 1 ? "attempt" : "attempts"}
            </p>
          )}
        </div>

        <div className="mt-5">
          {isEnded && <Row label="Items" value={itemsLabel(sub.items)} />}
          <Row label="Discount" value={`${Math.round(sub.discountPercent)}% (Subscribe & Save)`} />
          <Row label="Frequency" value={subscriptionIntervalLabel(sub.intervalDays)} />
          <Row
            label="Next order"
            value={
              ACTIVE_STATUSES.has(sub.status)
                ? `${formatShortDate(sub.nextBillingAt)} · ${formatChargeTime(sub.nextBillingAt)}`
                : sub.status === "paused" && sub.pausedUntil
                  ? `Paused — resumes ${formatShortDate(sub.pausedUntil)}`
                  : "—"
            }
          />
          <Row
            label="Last charged"
            value={sub.lastChargedAt ? formatShortDate(sub.lastChargedAt) : "Never"}
          />
          <Row
            label="Affiliate"
            value={
              sub.affiliate ? (
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[#64717a]" />
                  {sub.affiliate.name}
                  {sub.affiliate.code ? (
                    <span className="font-sans uppercase text-[#64717a]">
                      ({sub.affiliate.code})
                    </span>
                  ) : null}
                </span>
              ) : (
                "None"
              )
            }
          />
          <Row
            label="Card"
            value={
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-[#64717a]" />
                {cardLabel(sub)}
              </span>
            }
          />
          <Row
            label="Ships to"
            value={
              [sub.shipping.city, sub.shipping.state, sub.shipping.postcode, sub.shipping.country]
                .filter(Boolean)
                .join(", ") || "—"
            }
          />
          <Row label="First order" value={sub.firstOrderId ? `#${sub.firstOrderId}` : "—"} />
          <Row label="Latest order" value={sub.lastOrderId ? `#${sub.lastOrderId}` : "—"} />
          <Row label="Started" value={formatShortDate(sub.createdAt)} />
          {sub.cancelledAt && (
            <Row
              label={sub.status === "refunded" ? "Refunded" : "Cancelled"}
              value={formatShortDate(sub.cancelledAt)}
            />
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {notice && <p className="mt-4 text-sm text-emerald-700">{notice}</p>}

        {!isEnded && (
          <>
            {/* Edit products */}
            <ItemsEditor
              sub={sub}
              catalog={catalog}
              busy={busy}
              onSave={(items) => runAction("set_items", { items })}
            />

            {/* Change frequency */}
            <div className="mt-6">
              <label className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2 block">
                Delivery frequency
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={freq}
                  onChange={(e) => setFreq(parseInt(e.target.value, 10))}
                  className="flex-1 rounded-xl border border-[#242526]/12 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-[#242526]/40"
                >
                  {SUBSCRIPTION_INTERVAL_OPTIONS.map((o) => (
                    <option key={o.days} value={o.days}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => runAction("set_interval", { intervalDays: freq })}
                  disabled={busy != null || freq === sub.intervalDays}
                  className="rounded-xl px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === "set_interval" ? "Saving…" : "Update"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  runAction(
                    "charge_now",
                    undefined,
                    "Charge this subscription's saved card right now and create a new order?"
                  )
                }
                disabled={busy != null}
                className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
              >
                {busy === "charge_now" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Charging…
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" /> Charge now
                  </>
                )}
              </button>

              {canPause && (
                <div className="inline-flex items-center rounded-full bg-[#242526]/5 pl-1 pr-1 py-1 gap-1">
                  <select
                    value={pauseDays}
                    onChange={(e) => setPauseDays(parseInt(e.target.value, 10))}
                    disabled={busy != null}
                    className="rounded-full bg-transparent px-3 py-2 text-[10px] uppercase tracking-[0.14em] font-sans text-[#20282c] outline-none cursor-pointer"
                    aria-label="Pause length"
                  >
                    <option value={0}>Until resumed</option>
                    <option value={7}>1 week</option>
                    <option value={14}>2 weeks</option>
                    <option value={30}>1 month</option>
                    <option value={60}>2 months</option>
                    <option value={90}>3 months</option>
                  </select>
                  <button
                    onClick={() =>
                      runAction("pause", pauseDays > 0 ? { pauseDays } : undefined)
                    }
                    disabled={busy != null}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white text-[#20282c] hover:bg-[#242526]/10 transition-colors disabled:opacity-50"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                </div>
              )}
              {canResume && (
                <button
                  onClick={() => runAction("resume")}
                  disabled={busy != null}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" /> Resume
                </button>
              )}
              <button
                onClick={() =>
                  runAction(
                    "cancel",
                    undefined,
                    "Cancel this subscription permanently? This stops all future orders."
                  )
                }
                disabled={busy != null}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-red-500/10 text-red-600 hover:bg-red-500/15 transition-colors disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </>
        )}

        {sub.status !== "refunded" && (
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={() =>
                runAction(
                  "refund",
                  undefined,
                  "Mark this subscription as refunded? This stops billing and removes any unpaid affiliate commission for its orders."
                )
              }
              disabled={busy != null}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-red-500/10 text-red-600 hover:bg-red-500/15 transition-colors disabled:opacity-50"
            >
              {busy === "refund" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Refunding…
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" /> Mark refunded
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
