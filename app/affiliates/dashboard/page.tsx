"use client";

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
import { SharedProgram } from "@/components/affiliates/shared/SharedProgram";
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

import { formatBuckets, formatDenominated, type MoneyBucket } from "@/components/affiliates/shared/currency-view";

interface BonusInfo {
  currency: string | null;
  scalarTotalsAvailable: boolean;
  currencies: MoneyBucket[];
  threshold: number;
  rate: number;
  monthSales: number | null;
  reached: boolean;
  projectedBonus: number | null;
  monthLabel: string;
}

interface SessionUser {
  firstName: string;
  promoCode: string;
}

export default function AffiliateOverviewPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bonus, setBonus] = useState<BonusInfo | null>(null);
  const [appStats, setAppStats] = useState<{usersOnApp: number | null; subscribers: number; earnings: number | null; currencies: MoneyBucket[]} | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.all([fetch('/api/affiliates/me', {credentials:'include', cache:'no-store'}), fetch('/api/affiliates/dashboard?range=all', {credentials:'include', cache:'no-store'})])
      .then(async ([me, dash]) => { if (!me.ok || !dash.ok) throw new Error('Could not load your existing partnership tools.'); const [m,d] = await Promise.all([me.json(),dash.json()]); if (alive) {setUser(m.user); setBonus(d.bonus ?? null); setAppStats(d.appStats ?? null);} })
      .catch(e => {if (alive) setError(e.message);});
    return () => {alive=false;};
  }, []);
  function copy() { if (!user) return; navigator.clipboard.writeText(user.promoCode).then(() => {setCopied(true); setTimeout(() => setCopied(false),2000);}).catch(() => setError('Clipboard unavailable. Select your code to copy it.')); }
  function share() { if (!user) return; const text = `My IQON creator code is ${user.promoCode}. Check the participating store for verified availability and the applicable discount.`; if (navigator.share) void navigator.share({title:'IQON creator code',text}).catch(() => {}); else void navigator.clipboard.writeText(text).catch(() => setError('Clipboard unavailable.')); }
  return <>
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
              Your creator code
            </p>
            <p
              className="font-sans font-medium tracking-tight text-white leading-none mt-3 break-words"
              style={{
                fontSize: "clamp(2rem, 7vw, 4.5rem)",
              }}
            >
              {user?.promoCode ?? "—"}
            </p>
            <p className="text-white/55 text-sm mt-3 max-w-md">Use the verified category agreements below before advertising a discount. Your existing network, app and bonus programs remain linked to this account.</p>
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

          <div className="self-end text-sm text-white/70">One creator identity. Category agreements and verified store activation are shown in your shared program report. A code is not an activation guarantee.</div>
        </div>
      </section>
      <div id="shared-performance"><SharedProgram brand="supplements" /></div>
      <nav aria-label="Partnership tools" className="glass-surface rounded-lg p-5 flex flex-wrap gap-4 mb-8">
        <Link className="underline" href="/affiliates/dashboard/network">Referral network</Link>
        <Link className="underline" href="/affiliates/dashboard/messages">Messages</Link>
        <Link className="underline" href="/affiliates/dashboard/learn">Learning & resources</Link>
        <Link className="underline" href="/affiliates/dashboard/clients">Linked clients</Link>
        <Link className="underline" href="/affiliates/dashboard/orders">Order details</Link>
        <Link className="underline" href="/affiliates/dashboard/payment">Payment settings</Link>
      </nav>
      {error && <p role="alert">{error}</p>}
      <h2 className="text-2xl mb-2">Your partnership programs</h2>
      <p className="text-sm mb-6">Existing app audience, bonus targets and contest cycles use their own stated periods and eligibility rules, not the reporting filters above. Earnings and paid balances remain in the shared ledger.</p>
      {/* IQONIC app — shown once any of their customers is on the app */}
      {appStats &&
        ((appStats.usersOnApp ?? 0) > 0 ||
          appStats.subscribers > 0 ||
          appStats.currencies.some(b => Number(b.earnings) > 0)) && (
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
                    <a href="#shared-performance" className="underline text-sm">Select App in shared report</a>
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

      {!appStats && <p className="glass-surface rounded-lg p-5 mb-6">IQONIC app audience is unavailable or not linked yet. App commission records remain available through the shared App category.</p>}
      <MonthlyRankCard />
      {bonus && <BonusProgressCard bonus={bonus} />}
      <TikTokBonusCard />
    </>;
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
  if (!bonus.scalarTotalsAvailable || bonus.monthSales === null || bonus.projectedBonus === null || bonus.currency === null) return <section className="glass-surface rounded-3xl p-6 mb-8">
    <h3>{bonus.monthLabel} sales bonus</h3>
    <p>{formatBuckets(bonus, 'monthSales')}</p>
    <p>Bonus projection unavailable: a single known currency is required. No cross-currency target comparison or FX conversion has been made.</p>
  </section>;
  const formatCurrency = (amount: number) => formatDenominated(amount, bonus.currency);
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
      const res = await fetch("/api/affiliates/tiktok", {
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
