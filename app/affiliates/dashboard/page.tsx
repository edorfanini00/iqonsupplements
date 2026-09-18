"use client";
import {nonproviderMutationFetch} from "@/lib/affiliates/nonprovider-mutation-fetch";
// BODY CATEGORY ADDITION
import { CategoryRevenue } from "@/components/affiliates/shared/CategoryRevenue";
import { useLatestRead } from "@/lib/affiliates/use-latest-read";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Copy,
  Share2,
  Check,
  ShoppingBag,
  DollarSign,
  Repeat,
  TrendingUp,
  ArrowRight,
  Clock,
  X,
  Music2,
  Loader2,
  ChevronDown,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { AreaChart } from "@/components/affiliates/charts/AreaChart";
import { Donut } from "@/components/affiliates/charts/Donut";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import { useCalendarDay } from "@/components/affiliates/shared/useCalendarDay";
import {
  PageHeader,
  StatCard,
  SectionTitle,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import { OrderDetailDrawer } from "@/components/affiliates/shared/OrderDetailDrawer";
import {
  buildTimeSeries,
  formatRangeCaption,
  resolveRange,
} from "@/lib/affiliates/time-series";
import type { Granularity } from "@/lib/affiliates/types";

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  directCommission: number;
  pendingCommission: number;
  paidCommission: number;
  codeOrders: number;
  recurringOrders: number;
  referralOrders: number;
  referralCommission: number;
  referralCommissionPending: number;
  referralCommissionPaid: number;
}

interface Account {
  commissionRate: number;
  recurringCommissionRate: number;
  couponRate: number;
  referralCommissionRate: number;
  referredBy: { name: string; promoCode: string; rate: number } | null;
}

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

interface ReferralBreakdownRow {
  refereeId: string;
  refereeName: string;
  refereePromoCode: string;
  refereeStatus: "active" | "pending" | "disabled";
  referralRate: number;
  ordersCount: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

interface BonusInfo {
  threshold: number;
  rate: number;
  monthSales: number;
  reached: boolean;
  projectedBonus: number;
  monthLabel: string;
}

interface SessionUser {
  firstName: string;
  promoCode: string;
}

export default function AffiliateOverviewPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [preset, setPreset] = useState<Preset>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [referralBreakdown, setReferralBreakdown] = useState<
    ReferralBreakdownRow[]
  >([]);
  const [bonus, setBonus] = useState<BonusInfo | null>(null);
  // IQONIC app: this affiliate's customers on the app, subscribers, earnings.
  const [appStats, setAppStats] = useState<{
    usersOnApp: number | null;
    subscribers: number;
    earnings: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  const calendarDay = useCalendarDay();

  const beginRead = useLatestRead();
  const [readError, setReadError] = useState<string | null>(null);
  const load = useCallback(async (p: Preset, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    const request = beginRead();
    setReadError(null);
    setStats(null); setAccount(null); setOrders([]); setReferralBreakdown([]); setBonus(null); setAppStats(null);
    try {
      const [meRes, dashRes] = await Promise.all([
        fetch("/api/affiliates/me", { credentials: "include", cache: "no-store", signal: request.signal }),
        fetch(`/api/affiliates/dashboard?range=${encodeURIComponent(p)}`, {
          credentials: "include", cache: "no-store", signal: request.signal,
        }),
      ]);
      if (!meRes.ok || !dashRes.ok) throw new Error("Could not load data. Please retry.");
      if (meRes.ok) {
        const data = await meRes.json();
        if (!request.isCurrent()) return;
        setUser(data.user);
      }
      if (dashRes.ok) {
        const data = await dashRes.json();
        if (!request.isCurrent()) return;
        setStats(data.stats);
        setAccount(data.account ?? null);
        setOrders(data.orders ?? []);
        setReferralBreakdown(data.referralBreakdown ?? []);
        setBonus(data.bonus ?? null);
        setAppStats(data.appStats ?? null);
      }
    } catch {
      if (request.isCurrent()) setReadError("Could not load data. Please retry.");
    } finally {
      if (!request.isCurrent()) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [beginRead]);

  useEffect(() => {
    const isInitial = !hasLoadedOnce.current;
    load(preset, isInitial).then(() => {
      hasLoadedOnce.current = true;
    });
  }, [preset, calendarDay, load]);

  function copy() {
    if (!user) return;
    navigator.clipboard.writeText(user.promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function share() {
    if (!user) return;
    const text = `Use my code ${user.promoCode} for 15% off at iqonhealth.com`;
    if (navigator.share) {
      navigator.share({ title: "IQON code", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const chartRange = useMemo(
    () => resolveRange(preset),
    [preset, calendarDay]
  );

  const seriesData = useMemo(() => {
    const series = buildTimeSeries(orders, chartRange);
    return series.map((s) => ({
      date: s.bucket,
      label: s.label,
      primary: s.commission,
      secondary: s.revenue,
    }));
  }, [orders, chartRange]);

  const rangeCaption = useMemo(
    () => formatRangeCaption(chartRange, preset),
    [chartRange, preset]
  );

  const chartGranularity: Granularity = chartRange.granularity;

  const splitDonut = useMemo(
    () => [
      { label: "Code orders", value: stats?.codeOrders ?? 0 },
      { label: "Recurring", value: stats?.recurringOrders ?? 0 },
    ],
    [stats]
  );

  const earningsDonut = useMemo(() => {
    const slices: { label: string; value: number }[] = [];

    slices.push({
      label: "Your sales",
      value: stats?.directCommission ?? 0,
    });

    for (const referee of referralBreakdown) {
      slices.push({
        label: referee.refereeName,
        value: referee.totalCommission,
      });
    }

    return slices.filter((slice) => slice.value > 0);
  }, [stats, referralBreakdown]);

  const hasReferralNetwork = referralBreakdown.length > 0;

  return (
    <>
      {readError && <p role="alert">{readError} <button type="button" onClick={() => load(preset, false)}>Retry</button></p>}
      <PageHeader
        eyebrow={`Welcome back${user ? `, ${user.firstName}` : ""}`}
        title="Your performance"
        description="Track sales attributed to your code, your commissions and your payouts."
        actions={<RangePicker value={preset} onChange={setPreset} />}
      />

      {/* Promo code hero */}
      <section className="relative overflow-hidden rounded-lg glass-hero-dark text-white p-7 md:p-10 mb-8">
        <div
          className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full opacity-50 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55">
              Your promo code ·{" "}
              {account ? `${account.couponRate}%` : "—"} off ·{" "}
              {account ? `${account.commissionRate}%` : "—"} commission
            </p>
            <p
              className="font-sans font-medium tracking-tight text-white leading-none mt-3 break-words"
              style={{
                fontSize: "clamp(2rem, 7vw, 4.5rem)",
              }}
            >
              {user?.promoCode ?? "—"}
            </p>
            <p className="text-white/55 text-sm mt-3 max-w-md">
              Earn{" "}
              <span className="text-white">
                {account ? `${account.commissionRate}%` : "—"}
              </span>{" "}
              on a customer&apos;s first order with your code, plus{" "}
              <span className="text-white">
                {account ? `${account.recurringCommissionRate}%` : "—"}
              </span>{" "}
              on every recurring order from repeat customers
              {account && account.referralCommissionRate > 0
                ? " and your referral network"
                : ""}
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={copy}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white text-[#20282c] hover:bg-[#fafbfb] transition-colors"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy code"}
              </button>
              <button
                onClick={share}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white/5 backdrop-blur-md border border-white/15 text-white hover:bg-white/10 transition-colors"
              >
                <Share2 className="h-3 w-3" />
                Share
              </button>
              <Link
                href="/affiliates/dashboard/payment"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-white/5 backdrop-blur-md border border-white/15 text-white hover:bg-white/10 transition-colors"
              >
                Payment info
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-end lg:self-stretch">
            <DarkInline
              label="Earnings"
              value={stats ? formatCurrency(stats.totalCommission) : "—"}
            />
            <DarkInline
              label="Pending"
              value={stats ? formatCurrency(stats.pendingCommission) : "—"}
            />
            <DarkInline
              label="Paid out"
              value={stats ? formatCurrency(stats.paidCommission) : "—"}
            />
            <DarkInline
              label="Orders"
              value={stats ? String(stats.totalOrders) : "—"}
            />
          </div>
        </div>
      </section>

      <MonthlyRankCard />

      {bonus && <BonusProgressCard bonus={bonus} />}

      <TikTokBonusCard />

      {/* Stat row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
        <StatCard
          icon={ShoppingBag}
          label="Orders"
          value={stats ? String(stats.totalOrders - stats.referralOrders) : "—"}
          hint={
            stats && stats.referralOrders > 0
              ? `+ ${stats.referralOrders} referral`
              : undefined
          }
        />
        <StatCard
          icon={DollarSign}
          label="Revenue driven"
          value={stats ? formatCurrency(stats.totalRevenue) : "—"}
        />
        <StatCard
          icon={TrendingUp}
          label="Commission"
          value={stats ? formatCurrency(stats.totalCommission) : "—"}
          accent
          hint={
            stats && stats.referralCommission > 0
              ? `incl. ${formatCurrency(stats.referralCommission)} from network`
              : undefined
          }
        />
        {stats && stats.referralCommission > 0 ? (
          <StatCard
            icon={Repeat}
            label="From network"
            value={formatCurrency(stats.referralCommission)}
            hint={`${stats.referralOrders} referred orders`}
          />
        ) : (
          <StatCard
            icon={Repeat}
            label="Recurring"
            value={stats ? String(stats.recurringOrders) : "—"}
            hint="Repeat customer orders"
          />
        )}
      </section>

      {/* IQONIC app — shown once any of their customers is on the app */}
      {appStats &&
        ((appStats.usersOnApp ?? 0) > 0 ||
          appStats.subscribers > 0 ||
          appStats.earnings > 0) && (
          <section className="glass-surface rounded-lg p-6 md:p-7 mb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#242526] text-white flex items-center justify-center">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    IQONIC app
                  </p>
                  <p className="text-sm text-[#20282c] mt-0.5">
                    Your customers on the app — you earn a cut of their app
                    subscriptions too.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 md:gap-10">
                {appStats.usersOnApp != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                      On the app
                    </p>
                    <p className="text-xl font-sans font-medium mt-1">
                      {appStats.usersOnApp}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    Subscribed
                  </p>
                  <p className="text-xl font-sans font-medium mt-1">
                    {appStats.subscribers}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    App earnings
                  </p>
                  <p className="text-xl font-sans font-medium mt-1">
                    {formatCurrency(appStats.earnings)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* BODY CATEGORY ADDITION */}
      <CategoryRevenue preset={preset} audience="affiliate" />

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        <div className="lg:col-span-2 glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle
            eyebrow="Trend"
            title="Earnings over time"
            right={
              <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
                {refreshing ? "Updating…" : rangeCaption}
              </span>
            }
          />
          {loading && orders.length === 0 ? (
            <ChartSkeleton />
          ) : seriesData.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No data for this range"
              description="Try a wider time frame or share your code to earn commissions."
            />
          ) : (
            <AreaChart
              key={`${preset}-${calendarDay}`}
              data={seriesData}
              granularity={chartGranularity}
              primaryLabel="Commission"
              secondaryLabel="Revenue"
              formatValue={(n) => `$${Math.round(n).toLocaleString()}`}
            />
          )}
        </div>
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Mix" title="Order types" />
          <Donut
            slices={splitDonut}
            centerLabel={String(
              splitDonut.reduce((s, x) => s + x.value, 0)
            )}
            centerSubLabel="Total orders"
          />
        </div>
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle
            eyebrow="Sources"
            title="Earnings mix"
            right={
              hasReferralNetwork ? (
                <Link
                  href="/affiliates/dashboard/network"
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
                >
                  Network
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : undefined
            }
          />
          {loading ? (
            <ChartSkeleton />
          ) : earningsDonut.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No earnings yet"
              description="Commission from your sales and referrals will show up here."
            />
          ) : (
            <Donut
              slices={earningsDonut}
              centerLabel={formatCurrency(stats?.totalCommission ?? 0)}
              centerSubLabel="Total earned"
              formatValue={(n) => formatCurrency(n)}
            />
          )}
          {hasReferralNetwork && earningsDonut.length > 0 && (
            <p className="text-xs text-[#64717a] mt-4 leading-relaxed">
              Your sales vs. kickbacks from each affiliate you referred.
              {referralBreakdown.some((r) => r.totalCommission === 0) && (
                <>
                  {" "}
                  Referred affiliates with no orders yet are omitted until they
                  earn.
                </>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Recent orders */}
      <section>
        <SectionTitle
          eyebrow="Activity"
          title="Recent orders"
          right={
            <Link
              href="/affiliates/dashboard/orders"
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Share your code to start earning on every sale."
          />
        ) : (
          <div className="glass-surface rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[#242526]/8">
                    <Th>Date</Th>
                    <Th>Customer</Th>
                    <Th>Type</Th>
                    <Th align="right">Order</Th>
                    <Th align="right">Commission</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((o) => (
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
                      <td className="py-4 px-5">
                        <Pill
                          tone={o.matchType === "code" ? "dark" : "neutral"}
                          icon={
                            o.matchType === "code"
                              ? ShoppingBag
                              : o.matchType === "bonus"
                              ? TrendingUp
                              : Repeat
                          }
                        >
                          {o.matchType === "code"
                            ? "Code"
                            : o.matchType === "bonus"
                            ? "Bonus"
                            : "Recurring"}
                        </Pill>
                      </td>
                      <td className="py-4 px-5 text-right font-sans">
                        {formatCurrency(o.orderTotal)}
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
      </section>

      <OrderDetailDrawer
        orderId={activeOrderId}
        onClose={() => setActiveOrderId(null)}
      />
    </>
  );
}

interface RankPayload {
  periodEnd: string;
  resetDay: number;
  prizes: number[];
  qualifyingMinimum: number;
  rank: number | null;
  totalRanked: number;
  rankedWithSales: number;
  hasSales: boolean;
  /** Own sales counted only up to the qualifying minimum — never beyond. */
  qualifyProgress: number;
  qualified: boolean;
  prize: number | null;
  /** Set when the caller won a prize in the cycle that just ended. */
  lastCycleWin?: { rank: number; prize: number; endedAt: string } | null;
}

const RANK_MEDALS: Record<
  number,
  { label: string; card: string; badge: string }
> = {
  1: {
    label: "Gold",
    card: "bg-gradient-to-r from-[#D4A937] to-[#F0CF6E] text-[#3C2E05]",
    badge: "bg-[#3C2E05]/10 text-[#3C2E05]",
  },
  2: {
    label: "Silver",
    card: "bg-gradient-to-r from-[#9FA6AD] to-[#D5DADF] text-[#33383D]",
    badge: "bg-[#33383D]/10 text-[#33383D]",
  },
  3: {
    label: "Bronze",
    card: "bg-gradient-to-r from-[#A96F3D] to-[#D19A66] text-[#3B2410]",
    badge: "bg-[#3B2410]/10 text-[#3B2410]",
  },
};

/**
 * Monthly sales bonus progress. Only shows for affiliates the admin set a
 * bonus program for: a bar fills toward the sales target, and once it's hit
 * the card flips to a "bonus unlocked" state with the earned amount.
 */
function BonusProgressCard({ bonus }: { bonus: BonusInfo }) {
  const pct = Math.min(100, (bonus.monthSales / bonus.threshold) * 100);
  const remaining = Math.max(0, bonus.threshold - bonus.monthSales);

  return (
    <section
      className={`rounded-lg p-6 md:p-7 mb-8 ${
        bonus.reached
          ? "bg-gradient-to-br from-[#20282c] to-[#1E3A32] text-white"
          : "glass-surface"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="min-w-0">
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-sans ${
              bonus.reached ? "text-white/60" : "text-[#64717a]"
            }`}
          >
            {bonus.monthLabel} sales bonus
          </p>
          <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1.5">
            {bonus.reached ? (
              <>Bonus unlocked — +{bonus.rate}% on your sales</>
            ) : (
              <>
                {formatCurrency(remaining)} to go for a {bonus.rate}% bonus
              </>
            )}
          </p>
          <p
            className={`text-sm mt-2 ${
              bonus.reached ? "text-white/70" : "text-[#64717a]"
            }`}
          >
            {bonus.reached ? (
              <>
                You passed {formatCurrency(bonus.threshold)} in sales this
                month, so you earn an extra {bonus.rate}% on your{" "}
                {bonus.monthLabel} sales volume — currently{" "}
                {formatCurrency(bonus.projectedBonus)}. It&apos;s added to your
                payout balance automatically when the month closes, and it
                grows with every order until then.
              </>
            ) : (
              <>
                Hit {formatCurrency(bonus.threshold)} in sales this calendar
                month and you earn an extra {bonus.rate}% on your entire{" "}
                {bonus.monthLabel} sales volume — added to your payout balance
                automatically when the month closes.
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-left md:text-right">
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-sans ${
              bonus.reached ? "text-white/60" : "text-[#64717a]"
            }`}
          >
            Your sales this month
          </p>
          <p className="font-sans text-2xl font-semibold mt-1">
            {formatCurrency(bonus.monthSales)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div
          className={`h-3 rounded-full overflow-hidden ${
            bonus.reached ? "bg-white/15" : "bg-[#242526]/8"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              bonus.reached
                ? "bg-gradient-to-r from-emerald-300 to-emerald-400"
                : "bg-gradient-to-r from-[#20282c] to-[#3A5A4E]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between mt-2 text-xs font-sans ${
            bonus.reached ? "text-white/70" : "text-[#64717a]"
          }`}
        >
          <span>
            {formatCurrency(bonus.monthSales)} of{" "}
            {formatCurrency(bonus.threshold)}
          </span>
          <span>{Math.floor(pct)}%</span>
        </div>
      </div>
    </section>
  );
}

interface TikTokPayload {
  cycleLabel: string;
  cycleDays: number;
  daysLeft: number;
  goal: number;
  count: number;
  hit: boolean;
  reward: number;
  baseReward: number;
  streakMonth: number;
  nextReward: number;
  submissions: { id: string; url: string; createdAt: string }[];
}

/**
 * TikTok bonus — 15 videos per 30-day cycle earns the current streak reward
 * ($100 for a first cycle; consecutive hit cycles climb an admin-set ladder,
 * a missed cycle resets it). The counter resets to zero when the cycle ends;
 * a timer on the card shows the days remaining.
 */
function TikTokBonusCard() {
  const [data, setData] = useState<TikTokPayload | null>(null);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/affiliates/tiktok", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive && json?.ok) setData(json as TikTokPayload);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await nonproviderMutationFetch("/api/affiliates/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Something went wrong — try again.");
        return;
      }
      setData(json as TikTokPayload);
      setUrl("");
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }, [url, submitting]);

  if (!data) return null;

  const hit = data.hit;
  const remaining = Math.max(0, data.goal - data.count);
  const pct = Math.min(100, (data.count / data.goal) * 100);

  return (
    <section
      className={`rounded-lg p-6 md:p-7 mb-8 ${
        hit
          ? "bg-gradient-to-br from-[#20282c] to-[#1E3A32] text-white"
          : "glass-surface"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="min-w-0">
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-sans flex items-center gap-1.5 ${
              hit ? "text-white/60" : "text-[#64717a]"
            }`}
          >
            <Music2 className="h-3 w-3" />
            TikTok bonus · {data.cycleLabel}
          </p>
          <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1.5">
            {hit ? (
              <>${data.reward} unlocked this month</>
            ) : (
              <>
                {remaining} more video{remaining === 1 ? "" : "s"} for $
                {data.reward}
              </>
            )}
          </p>
          <p
            className={`text-sm mt-2 max-w-2xl leading-relaxed ${
              hit ? "text-white/70" : "text-[#64717a]"
            }`}
          >
            Post {data.goal} TikToks about IQON before the timer runs out and
            paste each link below to earn ${data.reward}
            {data.streakMonth > 1 && (
              <> — you&apos;re on a {data.streakMonth}-cycle streak</>
            )}
            . Every {data.cycleDays} days the counter resets to zero and a new
            round starts. Hit the goal every round and the reward keeps
            climbing
            {hit && data.nextReward > data.reward && (
              <> (next round: ${data.nextReward})</>
            )}
            ; miss one and it resets to ${data.baseReward}. Your bonus is added
            to your payout balance automatically when the round closes.
          </p>
          <div
            className={`inline-flex items-center gap-2.5 mt-3.5 rounded-lg px-4 py-2.5 border ${
              hit
                ? "bg-emerald-300/15 border-emerald-300/30 text-emerald-200"
                : "bg-[#20282c]/6 border-[#20282c]/15 text-[#20282c]"
            }`}
          >
            <TrendingUp className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium leading-snug">
              Stay on a streak and you have the chance to make{" "}
              <span className="font-semibold">$1,000+ a month</span> after
              month 4.
            </p>
          </div>
        </div>
        <div className="shrink-0 text-left md:text-right">
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-sans ${
              hit ? "text-white/60" : "text-[#64717a]"
            }`}
          >
            Videos this round
          </p>
          <p className="font-sans text-2xl font-semibold mt-1">
            {data.count}
            <span
              className={`text-sm font-normal ${
                hit ? "text-white/60" : "text-[#64717a]"
              }`}
            >
              {" "}
              / {data.goal}
            </span>
          </p>
          <div className="flex flex-wrap md:justify-end gap-1.5 mt-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold ${
                hit
                  ? "bg-white/15 text-white"
                  : "bg-[#242526]/8 text-[#20282c]"
              }`}
            >
              <Clock className="h-3 w-3" />
              {data.daysLeft} day{data.daysLeft === 1 ? "" : "s"} left
            </span>
            {data.streakMonth > 1 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold ${
                  hit
                    ? "bg-white/15 text-white"
                    : "bg-[#242526]/8 text-[#20282c]"
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                Streak ×{data.streakMonth}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress toward the monthly goal */}
      <div className="mt-6">
        <div
          className={`h-3 rounded-full overflow-hidden ${
            hit ? "bg-white/15" : "bg-[#242526]/8"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              hit
                ? "bg-gradient-to-r from-emerald-300 to-emerald-400"
                : "bg-gradient-to-r from-[#20282c] to-[#3A5A4E]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between mt-2 text-xs font-sans ${
            hit ? "text-white/70" : "text-[#64717a]"
          }`}
        >
          <span>
            {data.count} of {data.goal} videos
          </span>
          <span>{Math.floor(pct)}%</span>
        </div>
      </div>

      {/* Submission form */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Paste your TikTok link — e.g. https://www.tiktok.com/@you/video/…"
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none ${
            hit
              ? "bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-white/50"
              : "bg-white/60 border border-[#20282c]/15 text-[#20282c] placeholder:text-[#64717a]/70 focus:border-[#20282c]/40"
          }`}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !url.trim()}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            hit
              ? "bg-white text-[#20282c] hover:bg-white/90"
              : "bg-[#20282c] text-white hover:bg-[#1E3A32]"
          }`}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Music2 className="h-3.5 w-3.5" />
          )}
          Submit TikTok
        </button>
      </div>
      {error && (
        <p
          className={`text-sm mt-2 ${
            hit ? "text-red-300" : "text-red-600"
          }`}
        >
          {error}
        </p>
      )}

      {/* This month's submissions */}
      {data.submissions.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.14em] ${
              hit
                ? "text-white/70 hover:text-white"
                : "text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                showList ? "rotate-180" : ""
              }`}
            />
            {showList ? "Hide" : "View"} your {data.submissions.length}{" "}
            submission{data.submissions.length === 1 ? "" : "s"}
          </button>
          {showList && (
            <ul
              className={`mt-3 space-y-1.5 text-sm max-h-56 overflow-y-auto pr-1 ${
                hit ? "text-white/80" : "text-[#20282c]"
              }`}
            >
              {data.submissions.map((s) => (
                <li key={s.id} className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 text-xs font-sans ${
                      hit ? "text-white/50" : "text-[#64717a]"
                    }`}
                  >
                    {formatShortDate(s.createdAt)}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate underline underline-offset-2 hover:no-underline"
                  >
                    {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                  <ExternalLink
                    className={`h-3 w-3 shrink-0 ${
                      hit ? "text-white/50" : "text-[#64717a]"
                    }`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * "You won" banner for the contest cycle that just closed. The API only sends
 * lastCycleWin during the first week of the new cycle; dismissing hides it
 * for that cycle on this device.
 */
function LastCycleWinBanner({
  win,
}: {
  win: NonNullable<RankPayload["lastCycleWin"]>;
}) {
  const storageKey = `iqon-contest-win-dismissed-${win.endedAt}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  const medal = RANK_MEDALS[win.rank];
  const endedLabel = new Date(win.endedAt).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
  });

  return (
    <section
      className={`relative rounded-lg p-6 md:p-7 mb-8 ${medal.card}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            window.localStorage.setItem(storageKey, "1");
          } catch {}
          setDismissed(true);
        }}
        className="absolute top-4 right-4 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans opacity-70">
        Affiliate of the month · {medal.label}
      </p>
      <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1.5">
        🎉 You won — congratulations!
      </p>
      <p className="text-sm mt-2 opacity-80 max-w-2xl leading-relaxed">
        You finished <strong>#{win.rank}</strong> in the cycle that ended on{" "}
        {endedLabel} and won the{" "}
        <strong>{formatCurrency(win.prize)}</strong> prize. We&apos;ll include
        it with your next payout. A new cycle has started and everyone is back
        to zero — go take the top spot again.
      </p>
    </section>
  );
}

function MonthlyRankCard() {
  const [data, setData] = useState<RankPayload | null>(null);

  useEffect(() => {
    fetch("/api/affiliates/rankings", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.rank != null || payload?.totalRanked != null) {
          setData(payload);
        }
      })
      .catch(() => {});
  }, []);

  if (!data || data.rank == null) return null;

  const hasSales = data.hasSales;
  const medal = hasSales && data.rank <= 3 ? RANK_MEDALS[data.rank] : null;
  const prizes = data.prizes ?? [500, 100, 50];
  const minimum = data.qualifyingMinimum ?? 1500;
  const qualifyProgress = data.qualifyProgress ?? 0;
  const toQualify = Math.max(0, minimum - qualifyProgress);
  const qualifyPct = Math.min(100, (qualifyProgress / minimum) * 100);
  const nextReset = new Date(data.periodEnd).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
  });
  // Whole days only — no clock. Ends-today shows as "Last day".
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(data.periodEnd).getTime() - Date.now()) / 86_400_000)
  );
  const daysLeftLabel =
    daysLeft <= 1 ? "Last day" : `${daysLeft} days left`;

  const prizeBreakdown = `Prizes: #1 $${prizes[0]} · #2 $${prizes[1]} · #3 $${prizes[2]} (minimum $${minimum.toLocaleString()} in sales to qualify).`;

  let statusLine: string;
  if (medal && data.qualified && data.prize) {
    statusLine = `You've qualified — hold your spot and win $${data.prize} this cycle. ${prizeBreakdown}`;
  } else if (medal && !data.qualified) {
    statusLine = `You're in a prize spot! Reach $${minimum.toLocaleString()} in sales to qualify — ${formatCurrency(
      toQualify
    )} to go. ${prizeBreakdown}`;
  } else if (data.qualified) {
    statusLine = `You've qualified for the monthly prize — climb into the top 3 to win. ${prizeBreakdown}`;
  } else {
    statusLine = `You're at ${formatCurrency(
      qualifyProgress
    )} of the $${minimum.toLocaleString()} minimum — ${formatCurrency(
      toQualify
    )} to go to qualify for prizes. ${prizeBreakdown}`;
  }

  // Anonymized ladder: prize spots + your own position. Other affiliates'
  // names and volumes are never exposed here.
  const ladder = [1, 2, 3].map((rank) => ({
    rank,
    isYou: data.rank === rank,
    prize: prizes[rank - 1],
  }));
  const showOwnRow = data.rank > 3;

  return (
    <>
    {data.lastCycleWin ? <LastCycleWinBanner win={data.lastCycleWin} /> : null}
    <section
      className={`rounded-lg p-6 md:p-7 mb-8 ${
        medal ? medal.card : "glass-surface"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-sans ${
              medal ? "opacity-70" : "text-[#64717a]"
            }`}
          >
            Affiliate of the month
            {medal ? ` · ${medal.label}` : ""}
          </p>
          <span
            className={`inline-flex items-center gap-1.5 mt-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold ${
              medal
                ? "bg-white/40 text-[#20282c]"
                : "bg-[#20282c] text-white"
            }`}
          >
            <Clock className="h-3 w-3" />
            {daysLeftLabel}
          </span>
          <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1.5">
            Your rank is #{data.rank}
            {!medal && data.totalRanked > 0 ? (
              <span className="text-[#64717a] text-lg"> of {data.totalRanked}</span>
            ) : null}
          </p>
          <p className={`text-sm mt-2 ${medal ? "opacity-80" : "text-[#64717a]"}`}>
            {statusLine} Rankings are based on your sales volume and reset on{" "}
            {nextReset} — everyone starts from zero.
          </p>
        </div>
        <div className="shrink-0 text-left md:text-right md:min-w-[200px]">
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-sans ${
              medal ? "opacity-70" : "text-[#64717a]"
            }`}
          >
            Prize qualification
          </p>
          {data.qualified ? (
            <p className="font-sans text-2xl font-semibold mt-1">
              Qualified ✓
            </p>
          ) : (
            <>
              <p className="font-sans text-2xl font-semibold mt-1">
                {formatCurrency(qualifyProgress)}
                <span
                  className={`text-sm font-normal ${
                    medal ? "opacity-70" : "text-[#64717a]"
                  }`}
                >
                  {" "}
                  of ${minimum.toLocaleString()}
                </span>
              </p>
              <div
                className={`mt-2 h-2 w-full md:w-[200px] rounded-full overflow-hidden ${
                  medal ? "bg-black/10" : "bg-[#242526]/8"
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    medal ? "bg-black/40" : "bg-[#20282c]"
                  }`}
                  style={{ width: `${qualifyPct}%` }}
                />
              </div>
              <p
                className={`text-xs mt-1.5 ${
                  medal ? "opacity-70" : "text-[#64717a]"
                }`}
              >
                {formatCurrency(toQualify)} to go
              </p>
            </>
          )}
          {medal && data.qualified && (
            <span
              className={`inline-flex items-center gap-1.5 mt-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold ${medal.badge}`}
            >
              <TrendingUp className="h-3 w-3" />
              ${data.prize ?? prizes[data.rank - 1]} prize
            </span>
          )}
        </div>
      </div>

      {/* Anonymized standings — only your own spot is identified. */}
      <div
        className={`mt-6 rounded-lg overflow-hidden border ${
          medal ? "border-black/10 bg-white/25" : "border-[#242526]/8 bg-[#242526]/3"
        }`}
      >
        {ladder.map((row) => (
          <div
            key={row.rank}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b last:border-0 ${
              medal ? "border-black/8" : "border-[#242526]/6"
            } ${row.isYou ? (medal ? "bg-white/35" : "bg-[#242526]/6") : ""}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold shrink-0 ${RANK_MEDALS[row.rank].card}`}
              >
                #{row.rank}
              </span>
              <span className="text-sm truncate">
                {row.isYou ? (
                  <strong>You{data.qualified ? "" : " · not qualified yet"}</strong>
                ) : (
                  <span className={medal ? "opacity-70" : "text-[#64717a]"}>
                    {RANK_MEDALS[row.rank].label} spot
                  </span>
                )}
              </span>
            </div>
            <span className="font-sans text-sm font-medium shrink-0">
              ${row.prize}
            </span>
          </div>
        ))}
        {showOwnRow && (
          <div
            className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
              medal ? "bg-white/35" : "bg-[#242526]/6"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold shrink-0 ${
                  medal ? "bg-black/10" : "bg-[#242526]/10 text-[#20282c]"
                }`}
              >
                #{data.rank}
              </span>
              <span className="text-sm">
                <strong>You</strong>
              </span>
            </div>
            <span className="font-sans text-sm font-medium shrink-0">
              {data.qualified
                ? "Qualified ✓"
                : `${formatCurrency(toQualify)} to qualify`}
            </span>
          </div>
        )}
      </div>
    </section>
    </>
  );
}

function DarkInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/50">
        {label}
      </p>
      <p className="text-lg md:text-xl font-medium font-sans tracking-tight mt-1.5 text-white">
        {value}
      </p>
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
