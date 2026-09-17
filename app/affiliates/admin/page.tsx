"use client";
// BODY CATEGORY ADDITION
import { CategoryRevenue } from "@/components/affiliates/shared/CategoryRevenue";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Users,
  ShoppingBag,
  Trophy,
  Repeat,
  Download,
  ArrowRight,
  RefreshCw,
  Mail,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { AreaChart } from "@/components/affiliates/charts/AreaChart";
import { BarChart } from "@/components/affiliates/charts/BarChart";
import { Donut } from "@/components/affiliates/charts/Donut";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import { useCalendarDay } from "@/components/affiliates/shared/useCalendarDay";
import {
  buildTimeSeries,
  formatRangeCaption,
  rangeLabel,
  resolveRange,
} from "@/lib/affiliates/time-series";
import type { Granularity } from "@/lib/affiliates/types";
import {
  PageHeader,
  StatCard,
  SectionTitle,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface AdminStats {
  totalAffiliates: number;
  activeAffiliates: number;
  totalOrders: number;
  totalRevenue: number;
  /** Affiliate-attributed sales, deduped (excludes referral mirror rows). */
  affiliateRevenue: number;
  affiliateOrders: number;
  totalCommissions: number;
  totalPaid: number;
  totalPending: number;
}

/** Store-wide totals across all processing + completed orders (from WooCommerce). */
interface StoreStats {
  totalRevenue: number;
  totalOrders: number;
  truncated: boolean;
}

interface RankingRow {
  id: string;
  name: string;
  promoCode: string;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  orderCount: number;
}

interface OrderRow {
  id: string;
  affiliateId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring" | "referral" | "bonus";
  status: "pending" | "paid";
  createdAt: string;
}

interface ChartOrder {
  createdAt: string;
  orderTotal: number;
  commission: number;
}

/** Store-wide (all paid Woo orders) date+total pairs for the total revenue line. */
interface StoreChartOrder {
  createdAt: string;
  total: number;
}

export default function AdminOverviewPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [chartOrders, setChartOrders] = useState<ChartOrder[]>([]);
  const [storeChartOrders, setStoreChartOrders] = useState<StoreChartOrder[]>([]);
  // IQONIC app revenue for the selected range (RevenueCat) — null when the app
  // integration isn't configured, in which case the breakdown is hidden.
  const [appRevenue, setAppRevenue] = useState<number | null>(null);
  const [appRevenueSeries, setAppRevenueSeries] = useState<
    { date: string; value: number }[]
  >([]);
  // Which revenue the hero number and total-revenue chart line show.
  const [revenueView, setRevenueView] = useState<"combined" | "store" | "app">(
    "combined"
  );
  const hasLoadedOnce = useRef(false);
  const calendarDay = useCalendarDay();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [couponSyncing, setCouponSyncing] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  async function handleTestEmail() {
    const to = window.prompt(
      "Send a test email to which address?\n(Tip: while your sending domain isn't verified in Resend, only your own Resend account email will actually arrive.)"
    );
    if (to === null) return;
    setTestingEmail(true);
    setEmailMessage(null);
    try {
      const res = await fetch("/api/affiliates/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: to.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailMessage(data.error || "Test email failed.");
      } else if (!data.apiKeyConfigured) {
        setEmailMessage(
          "RESEND_API_KEY is NOT set in this environment — nothing was sent (email was only logged). Add the key in Vercel and redeploy."
        );
      } else if (data.mode === "resend" && !data.error) {
        setEmailMessage(
          `Sent via Resend to ${data.to} from "${data.from}". If it doesn't arrive, check spam and that this domain is verified in Resend.`
        );
      } else if (data.error) {
        setEmailMessage(`Resend rejected it: ${data.error} (from "${data.from}")`);
      } else {
        setEmailMessage(`Result: ${data.mode}.`);
      }
      setTimeout(() => setEmailMessage(null), 12000);
    } catch {
      setEmailMessage("Test email request failed.");
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleCouponSync() {
    setCouponSyncing(true);
    setCouponMessage(null);
    try {
      const res = await fetch("/api/affiliates/admin/coupon-sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCouponMessage(data.error || "Coupon sync failed");
      } else {
        const created = (data.results ?? []).filter(
          (r: { status: string }) => r.status === "created" || r.status === "updated"
        ).length;
        const ok = (data.results ?? []).filter((r: { status: string }) => r.status === "ok").length;
        setCouponMessage(`Coupons verified: ${ok} ok, ${created} created/updated.`);
      }
      setTimeout(() => setCouponMessage(null), 6000);
    } finally {
      setCouponSyncing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/affiliates/admin/woocommerce-sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMessage(data.error || "Sync failed");
      } else {
        setSyncMessage(
          `Synced ${data.ingested}/${data.fetched} orders from WooCommerce.`
        );
        load(preset, false);
      }
      setTimeout(() => setSyncMessage(null), 6000);
    } finally {
      setSyncing(false);
    }
  }

  const [loadError, setLoadError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (p: Preset, isInitial: boolean) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoadError(null);
    // A new label must never be paired with the previous range's totals.
    setStats(null);
    setStoreStats(null);
    setRanking([]);
    setRecentOrders([]);
    setChartOrders([]);
    setStoreChartOrders([]);
    setAppRevenue(null);
    setAppRevenueSeries([]);
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/affiliates/admin/dashboard?range=${encodeURIComponent(p)}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403
        ? "Your session could not be verified. Please sign in again."
        : "Unable to load this period. Please try again.");
      {
        const data = await res.json();
        if (controller.signal.aborted) return;
        setStats(data.stats);
        setStoreStats(data.storeStats ?? null);
        setRanking(data.ranking ?? []);
        setRecentOrders(data.recentOrders ?? []);
        setChartOrders(data.chartOrders ?? []);
        setStoreChartOrders(data.storeChartOrders ?? []);
        setAppRevenue(typeof data.appRevenue === "number" ? data.appRevenue : null);
        setAppRevenueSeries(data.appRevenueSeries ?? []);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : "Unable to load this period. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const isInitial = !hasLoadedOnce.current;
    load(preset, isInitial).then(() => {
      hasLoadedOnce.current = true;
    });
    return () => activeRequest.current?.abort();
  }, [preset, calendarDay, load]);

  const chartRange = useMemo(
    () => resolveRange(preset),
    [preset, calendarDay]
  );

  const seriesData = useMemo(() => {
    const series = buildTimeSeries(chartOrders, chartRange);
    // Bucket store-wide totals with the same series builder so the total
    // revenue line lines up with the affiliate buckets.
    const storeSeries = buildTimeSeries(
      storeChartOrders.map((o) => ({
        createdAt: o.createdAt,
        orderTotal: o.total,
        commission: 0,
      })),
      chartRange
    );
    const storeByBucket = new Map(storeSeries.map((s) => [s.bucket, s.revenue]));
    // App revenue (RevenueCat daily points), bucketed the same way so the
    // store/app/combined toggle can swap the total line. RevenueCat stamps
    // each day at UTC midnight, which is the previous evening in Eastern —
    // shift to noon UTC so the point lands on its intended calendar day.
    const appSeries = buildTimeSeries(
      appRevenueSeries.map((p) => ({
        createdAt: p.date.replace("T00:00:00.000Z", "T12:00:00.000Z"),
        orderTotal: p.value,
        commission: 0,
      })),
      chartRange
    );
    const appByBucket = new Map(appSeries.map((s) => [s.bucket, s.revenue]));

    const hasStoreData = storeChartOrders.length > 0;
    const hasAppData = appRevenueSeries.length > 0;
    const showTertiary =
      revenueView === "app" ? hasAppData : hasStoreData || hasAppData;
    return series.map((s) => {
      const store = storeByBucket.get(s.bucket) ?? 0;
      const app = appByBucket.get(s.bucket) ?? 0;
      const total =
        revenueView === "store"
          ? store
          : revenueView === "app"
            ? app
            : store + app;
      return {
        date: s.bucket,
        label: s.label,
        primary: s.revenue,
        secondary: s.commission,
        ...(showTertiary ? { tertiary: total } : {}),
      };
    });
  }, [chartOrders, storeChartOrders, appRevenueSeries, revenueView, chartRange]);

  const rangeCaption = useMemo(
    () => formatRangeCaption(chartRange, preset),
    [chartRange, preset]
  );

  const chartGranularity: Granularity = chartRange.granularity;

  const topRanking = ranking.slice(0, 6);

  const matchSplit = useMemo(() => {
    const code = recentOrders.filter((o) => o.matchType === "code").length;
    const recurring = recentOrders.filter((o) => o.matchType === "recurring").length;
    return [
      { label: "Direct (code)", value: code },
      { label: "Recurring", value: recurring },
    ];
  }, [recentOrders]);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Affiliate operations"
        description="Live performance across the entire program with time-windowed insights."
        actions={
          <>
            <RangePicker value={preset} onChange={setPreset} />
            <button
              onClick={handleCouponSync}
              disabled={couponSyncing}
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60"
              title="Verify affiliate promo codes exist as WooCommerce coupons"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${couponSyncing ? "animate-spin" : ""}`} />
              {couponSyncing ? "Verifying…" : "Sync Coupons"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60"
              title="Pull recent orders from WooCommerce and match them to affiliates"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Woo"}
            </button>
            <button
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60"
              title="Send a test email to verify Resend delivery is working"
            >
              <Mail className={`h-3.5 w-3.5 ${testingEmail ? "animate-pulse" : ""}`} />
              {testingEmail ? "Sending…" : "Test Email"}
            </button>
            <a
              href="/api/affiliates/admin/export?type=orders"
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
          </>
        }
      />

      {loadError && (
        <div role="alert" className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c]">
          {loadError}{" "}
          <button type="button" onClick={() => load(preset, false)} className="underline">Retry</button>
        </div>
      )}

      {emailMessage && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c] flex items-start gap-2">
          <Mail className="h-3.5 w-3.5 text-[#64717a] mt-0.5 shrink-0" />
          <span>{emailMessage}</span>
        </div>
      )}

      {couponMessage && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c] flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-[#64717a]" />
          {couponMessage}
        </div>
      )}

      {syncMessage && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c] flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-[#64717a]" />
          {syncMessage}
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-lg glass-hero-dark text-white p-7 md:p-10 mb-8">
        <div
          className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full opacity-50 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
          <div>
            {(() => {
              const storeRevenue = storeStats
                ? storeStats.totalRevenue
                : stats
                  ? stats.totalRevenue
                  : null;
              const heroValue =
                storeRevenue == null
                  ? null
                  : appRevenue == null
                    ? storeRevenue
                    : revenueView === "store"
                      ? storeRevenue
                      : revenueView === "app"
                        ? appRevenue
                        : storeRevenue + appRevenue;
              const heroLabel =
                appRevenue == null
                  ? "Total revenue"
                  : revenueView === "store"
                    ? "Store revenue"
                    : revenueView === "app"
                      ? "App revenue"
                      : "Combined revenue";
              return (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/50">
                    {heroLabel} · {rangeLabel(preset)}
                  </p>
                  <Link
                    href={`/affiliates/admin/orders?range=${encodeURIComponent(preset)}`}
                    title={`View the orders behind this number (${rangeLabel(preset)})`}
                    className="group/revenue inline-flex items-baseline gap-3 font-sans font-medium tracking-tight text-white leading-none mt-3 transition-opacity hover:opacity-85"
                    style={{
                      fontSize: "clamp(1.875rem, 6vw, 4rem)",
                    }}
                  >
                    {heroValue != null ? formatCurrency(heroValue) : "—"}
                    <ArrowRight className="h-[0.5em] w-[0.5em] opacity-0 -translate-x-1 group-hover/revenue:opacity-70 group-hover/revenue:translate-x-0 transition-all" />
                  </Link>
                  {appRevenue != null && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center rounded-full bg-white/5 border border-white/15 p-1 gap-1">
                        {(
                          [
                            ["combined", "Combined"],
                            ["store", "Peptides"],
                            ["app", "App"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => setRevenueView(id)}
                            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] font-sans transition-colors ${
                              revenueView === id
                                ? "bg-white text-[#20282c]"
                                : "text-white/60 hover:text-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {revenueView === "combined" && storeRevenue != null && (
                        <p className="text-[11px] font-sans text-white/60 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Peptides{" "}
                            <span className="text-white/90">
                              {formatCurrency(storeRevenue)}
                            </span>
                          </span>
                          <span>
                            App{" "}
                            <span className="text-white/90">
                              {formatCurrency(appRevenue)}
                            </span>
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            <p className="text-white/55 text-sm mt-3 max-w-md">
              {storeStats && stats
                ? `Across ${storeStats.totalOrders} paid ${
                    storeStats.totalOrders === 1 ? "order" : "orders"
                  } (processing + completed). ${formatCurrency(
                    stats.affiliateRevenue
                  )} from ${stats.affiliateOrders} affiliate ${
                    stats.affiliateOrders === 1 ? "order" : "orders"
                  }.`
                : stats
                  ? `Across ${stats.totalOrders} attributed ${
                      stats.totalOrders === 1 ? "order" : "orders"
                    } from ${stats.activeAffiliates} active ${
                      stats.activeAffiliates === 1 ? "affiliate" : "affiliates"
                    }.`
                  : "—"}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/affiliates/admin/payouts"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white text-[#20282c] hover:bg-[#fafbfb] transition-colors"
              >
                Settle payouts
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/affiliates/admin/affiliates"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white/5 backdrop-blur-md border border-white/15 text-white hover:bg-white/10 transition-colors"
              >
                Manage affiliates
              </Link>
              <Link
                href="/affiliates/admin/subscriptions"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white/5 backdrop-blur-md border border-white/15 text-white hover:bg-white/10 transition-colors"
              >
                Subscriptions
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 self-end lg:self-stretch">
            <DarkInline
              label="Paid Out"
              value={stats ? formatCurrency(stats.totalPaid) : "—"}
              hint="Settled to bank/PayPal/Zelle"
            />
            <DarkInline
              label="Pending"
              value={stats ? formatCurrency(stats.totalPending) : "—"}
              hint="To be paid · all time"
            />
            <DarkInline
              label="Commissions"
              value={stats ? formatCurrency(stats.totalCommissions) : "—"}
              hint="Generated this period"
            />
            <DarkInline
              label="Avg Order"
              value={
                storeStats && storeStats.totalOrders
                  ? formatCurrency(storeStats.totalRevenue / storeStats.totalOrders)
                  : stats && stats.totalOrders
                    ? formatCurrency(stats.totalRevenue / stats.totalOrders)
                    : "—"
              }
              hint="Per paid order"
            />
          </div>
        </div>
      </section>

      {/* Stat row */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-10">
        <StatCard
          icon={Users}
          label="Affiliates"
          value={stats ? String(stats.totalAffiliates) : "—"}
          hint={stats ? `${stats.activeAffiliates} active` : undefined}
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders"
          value={
            storeStats
              ? String(storeStats.totalOrders)
              : stats
                ? String(stats.totalOrders)
                : "—"
          }
          hint={stats ? `${stats.affiliateOrders} from affiliates` : undefined}
        />
        <StatCard
          icon={DollarSign}
          label="Affiliate revenue"
          value={stats ? formatCurrency(stats.affiliateRevenue) : "—"}
          hint={
            storeStats && storeStats.totalRevenue > 0 && stats
              ? `${Math.round(
                  (stats.affiliateRevenue / storeStats.totalRevenue) * 100
                )}% of total`
              : undefined
          }
        />
      </section>

      {/* BODY CATEGORY ADDITION */}
      <CategoryRevenue preset={preset} audience="admin" />

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <div className="lg:col-span-2 glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle
            eyebrow="Trend"
            title="Revenue & commission"
            right={
              <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
                {refreshing ? "Updating…" : rangeCaption}
              </span>
            }
          />
          {loading && chartOrders.length === 0 ? (
            <ChartSkeleton />
          ) : (
            <AreaChart
              key={`${preset}-${calendarDay}`}
              data={seriesData}
              granularity={chartGranularity}
              primaryLabel="Affiliate revenue"
              secondaryLabel="Commission"
              tertiaryLabel={
                appRevenue == null
                  ? "Total revenue"
                  : revenueView === "store"
                    ? "Peptides revenue"
                    : revenueView === "app"
                      ? "App revenue"
                      : "Combined revenue"
              }
              formatValue={(n) => `$${Math.round(n).toLocaleString()}`}
            />
          )}
        </div>
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Mix" title="Attribution split" />
          <Donut
            slices={matchSplit}
            centerLabel={String(matchSplit.reduce((s, x) => s + x.value, 0))}
            centerSubLabel="Recent orders"
          />
        </div>
      </section>

      {/* Leaderboard + Recent activity */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <div className="lg:col-span-2 glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle
            eyebrow="Performance"
            title="Top affiliates by sales"
            right={
              <Link
                href="/affiliates/admin/affiliates"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {topRanking.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No data yet"
              description="The leaderboard will populate as orders come in."
            />
          ) : (
            <BarChart
              data={topRanking.map((r) => ({
                label: r.name,
                value: r.totalSales,
                hint: `${r.orderCount} ${
                  r.orderCount === 1 ? "order" : "orders"
                } · ${formatCurrency(r.totalCommission)} commission`,
              }))}
              formatValue={formatCurrency}
            />
          )}
        </div>

        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Activity" title="Recent orders" />
          <ul className="space-y-3">
            {recentOrders.slice(0, 6).map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 py-2 border-b border-[#242526]/5 last:border-0"
              >
                <div className="w-9 h-9 rounded-full bg-[#242526]/5 flex items-center justify-center text-[10px] font-sans text-[#64717a]">
                  #{o.orderId.slice(-3)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {o.customerName}
                  </p>
                  <p className="text-[11px] text-[#64717a] truncate">
                    {formatShortDate(o.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-sans">{formatCurrency(o.orderTotal)}</p>
                  <Pill
                    tone={o.matchType === "code" ? "dark" : "neutral"}
                    icon={o.matchType === "code" ? ShoppingBag : Repeat}
                  >
                    {o.matchType === "code"
                      ? "Code"
                      : o.matchType === "bonus"
                      ? "Bonus"
                      : "Recur"}
                  </Pill>
                </div>
              </li>
            ))}
            {recentOrders.length === 0 && (
              <li className="text-sm text-[#64717a] text-center py-6">
                No recent orders.
              </li>
            )}
          </ul>
        </div>
      </section>
    </>
  );
}

function DarkInline({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/50">
        {label}
      </p>
      <p className="text-lg md:text-xl font-medium font-sans tracking-tight mt-1.5 text-white">
        {value}
      </p>
      <p className="text-[10px] text-white/45 mt-1 font-sans">{hint}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[260px] flex items-end gap-2 animate-pulse">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-[#242526]/8 rounded"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

