"use client";
import { useOriginalRequest, OriginalRequestError } from "@/components/affiliates/shared/useOriginalRequest";

import { originalMoney as formatCurrency, originalField, originalTotal, originalCurrency, originalChartRows, type OriginalMoney } from "@/components/affiliates/shared/original-view";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  Users,
  DollarSign,
  Repeat,
  TrendingUp,
  UserX,
  Loader2,
  Link2,
  Settings2,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  Pill,
  StatCard,
  SectionTitle,
  EmptyState,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface IntegrationStatus {
  supabaseConfigured: boolean;
  revenuecatConfigured: boolean;
  missing: string[];
}

interface AppMetrics {
  activeSubscriptions: number | null;
  activeTrials: number | null;
  mrr: number | null;
  revenue28d: number | null;
  newCustomers: number | null;
  activeUsers: number | null;
}

interface AppSubscription {
  customerId: string;
  email: string | null;
  /** Resolved from the app account (or store match) — real person's name. */
  name: string | null;
  affiliate: { name: string; promoCode: string } | null;
  productName: string;
  status: string;
  store: string;
  startedAt: string | null;
  currentPeriodEndsAt: string | null;
  autoRenews: boolean | null;
  grossUsd: number | null;
  country: string | null;
}

interface Match {
  appSubscription: { status: string; active: boolean; productName: string } | null;
  appUser: { email: string; name: string; provider: string; createdAt: string };
  store: {
    email: string;
    name: string;
    orders: number;
    totalSpent: number;
    lastOrderAt: string;
  };
  basis: "email" | "name";
  affiliate: { id: string; name: string; promoCode: string } | null;
  commissionsRecorded: number;
}

interface RecordedCommission extends OriginalMoney {
  id: string;
  orderId: string;
  affiliateName: string;
  customerName: string;
  customerEmail: string;
  commission: number;
  status: string;
  createdAt: string;
}

interface AppData {
  status: IntegrationStatus;
  errors: string[];
  commissionRate: number;
  users: {
    total: number;
    last30d: number;
    truncated: boolean;
    recent: { email: string; name: string; provider: string; createdAt: string }[];
  };
  metrics: AppMetrics | null;
  subscriptions: {
    subscriptions: AppSubscription[];
    totalCustomers: number;
    partial: boolean;
  } | null;
  matches: Match[];
  commissions: RecordedCommission[];
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "in_grace_period"]);

type SubFilter = "all" | "paying" | "stopped";

export default function AdminAppPage() {
  const {request: fetch, requestError} = useOriginalRequest();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  // Which match row has the record-commission form open, and its amount input.
  const [recordFor, setRecordFor] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("12.99");
  const [recording, setRecording] = useState(false);
  const [signupsShown, setSignupsShown] = useState(15);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/app", { credentials: "include" });
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
        setRateInput(payload.commissionRate == null ? '' : String(payload.commissionRate));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveRate = useCallback(async () => {
    const value = Number(rateInput);
    if (!rateInput.trim() || !Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("Rate must be between 0 and 100.");
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch("/api/affiliates/admin/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "set_rate", rate: value }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Could not save the rate.");
        return;
      }
      toast.success(`App commission rate set to ${value}%.`);
      setData((prev) => (prev ? { ...prev, commissionRate: value } : prev));
    } finally {
      setSavingRate(false);
    }
  }, [rateInput]);

  const recordCommission = useCallback(
    async (match: Match) => {
      if (!match.affiliate) return;
      const amount = Number(amountInput);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error("Enter the subscription amount first.");
        return;
      }
      setRecording(true);
      try {
        const res = await fetch("/api/affiliates/admin/app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "record_commission",
            affiliateId: match.affiliate.id,
            customerEmail: match.appUser.email || match.store.email,
            customerName: match.appUser.name || match.store.name,
            amount,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(payload.error ?? "Could not record the commission.");
          return;
        }
        toast.success(
          `${formatCurrency(payload.commission)} credited to ${match.affiliate.name}.`
        );
        setRecordFor(null);
        await load();
      } finally {
        setRecording(false);
      }
    },
    [amountInput, load]
  );

  const subs = data?.subscriptions?.subscriptions ?? [];
  const paying = useMemo(
    () => subs.filter((s) => ACTIVE_STATUSES.has(s.status)),
    [subs]
  );
  const stopped = useMemo(
    () => subs.filter((s) => !ACTIVE_STATUSES.has(s.status)),
    [subs]
  );
  const visibleSubs =
    subFilter === "paying" ? paying : subFilter === "stopped" ? stopped : subs;

  const metrics = data?.metrics ?? null;
  const rate = data?.commissionRate ?? null;
  const previewAmount = Number(amountInput);
  const previewCommission =
    rate !== null && Number.isFinite(previewAmount) && previewAmount > 0
      ? Math.round(previewAmount * rate) / 100
      : null;

  if (requestError) return <OriginalRequestError message={requestError} />;

  return (
    <>
      <PageHeader
        eyebrow="IQONIC"
        title="App"
        description="Analytics from the IQONIC mobile app: signups, subscription revenue, who's paying and who stopped, plus app users matched to store customers so affiliates get credited."
      />

      {data && data.status.missing.length > 0 && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-4 text-sm text-[#20282c]">
          <p className="font-medium">Finish connecting the app</p>
          <p className="text-[#64717a] mt-1 leading-relaxed">
            Add {data.status.missing.length === 1 ? "this environment variable" : "these environment variables"} in
            Vercel to activate the missing sections:{" "}
            <span className="font-sans text-xs">{data.status.missing.join(", ")}</span>
            {!data.status.supabaseConfigured &&
              " — the Supabase service role key comes from the IQONIC Supabase project settings"}
            {!data.status.revenuecatConfigured &&
              " — the RevenueCat secret key and project id come from the RevenueCat dashboard"}
            .
          </p>
        </div>
      )}

      {data && data.errors.length > 0 && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-xs text-[#64717a]">
          {data.errors.join(" ")}
        </div>
      )}

      {loading && !data ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : (
        <>
          {/* Stat row */}
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-10">
            <StatCard
              icon={Users}
              label="App signups"
              value={data ? String(data.users.total) : "—"}
              hint={data ? `${data.users.last30d} in the last 30 days` : undefined}
            />
            <StatCard
              icon={Repeat}
              label="Active subs"
              value={
                metrics?.activeSubscriptions != null
                  ? String(metrics.activeSubscriptions)
                  : "—"
              }
              hint={
                metrics?.activeTrials != null
                  ? `${metrics.activeTrials} in trial`
                  : undefined
              }
            />
            <StatCard
              icon={TrendingUp}
              label="MRR"
              value={metrics?.mrr != null ? formatCurrency(metrics.mrr) : "—"}
              hint="Monthly recurring"
            />
            <StatCard
              icon={DollarSign}
              label="Revenue"
              value={
                metrics?.revenue28d != null ? formatCurrency(metrics.revenue28d) : "—"
              }
              hint="Last 28 days"
            />
            <StatCard
              icon={Smartphone}
              label="Active users"
              value={
                metrics?.activeUsers != null ? String(metrics.activeUsers) : "—"
              }
              hint="Last 28 days"
            />
            <StatCard
              icon={UserX}
              label="Stopped paying"
              value={data?.subscriptions ? String(stopped.length) : "—"}
              hint="Expired or cancelled"
            />
          </section>

          {/* Signups */}
          <section className="glass-surface rounded-lg p-6 md:p-7 mb-10">
            <SectionTitle
              eyebrow="Downloads"
              title="Who signed up"
              right={
                data ? (
                  <span className="text-xs text-[#64717a]">
                    {data.users.total} total · showing latest{" "}
                    {Math.min(signupsShown, data.users.recent.length)}
                  </span>
                ) : undefined
              }
            />
            {!data?.status.supabaseConfigured ? (
              <EmptyState
                icon={Users}
                title="Supabase not connected"
                description="Add the Supabase service key to see app signups here."
              />
            ) : (data?.users.recent.length ?? 0) === 0 ? (
              <EmptyState
                icon={Users}
                title="No signups yet"
                description="App accounts appear here as soon as people create them."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-[#242526]/8">
                        <Th>Name</Th>
                        <Th>Email</Th>
                        <Th>Sign-in</Th>
                        <Th align="right">Joined</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.users.recent ?? [])
                        .slice(0, signupsShown)
                        .map((u, idx) => (
                          <tr
                            key={`${u.email || u.name}-${idx}`}
                            className="border-b border-[#242526]/5"
                          >
                            <td className="py-3 px-4 font-medium">
                              {u.name || "—"}
                            </td>
                            <td className="py-3 px-4 text-[#64717a] truncate max-w-[16rem]">
                              {u.email || "—"}
                            </td>
                            <td className="py-3 px-4">
                              <Pill tone="neutral">{u.provider}</Pill>
                            </td>
                            <td className="py-3 px-4 text-right font-sans text-xs text-[#64717a] whitespace-nowrap">
                              {formatShortDate(u.createdAt)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {(data?.users.recent.length ?? 0) > signupsShown && (
                  <button
                    type="button"
                    onClick={() => setSignupsShown((n) => n + 25)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full glass-surface px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors"
                  >
                    Show more
                  </button>
                )}
              </>
            )}
          </section>

          {/* Subscribers */}
          <section className="glass-surface rounded-lg p-6 md:p-7 mb-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <SectionTitle eyebrow="Subscriptions" title="Who's paying" />
              <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1">
                {(
                  [
                    ["all", `All (${subs.length})`],
                    ["paying", `Paying (${paying.length})`],
                    ["stopped", `Stopped (${stopped.length})`],
                  ] as [SubFilter, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSubFilter(id)}
                    className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-sans transition-colors whitespace-nowrap ${
                      subFilter === id
                        ? "bg-[#242526] text-white"
                        : "text-[#64717a] hover:text-[#20282c]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {!data?.status.revenuecatConfigured ? (
              <EmptyState
                icon={Smartphone}
                title="RevenueCat not connected"
                description="Add the RevenueCat env vars to see paying subscribers here."
              />
            ) : visibleSubs.length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="No subscriptions here yet"
                description="Subscriptions appear as soon as RevenueCat records them."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b border-[#242526]/8">
                      <Th>Customer</Th>
                      <Th>Affiliate</Th>
                      <Th>Product</Th>
                      <Th>Status</Th>
                      <Th>Started</Th>
                      <Th>Period ends</Th>
                      <Th align="right">Revenue</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSubs.map((s, idx) => (
                      <tr key={`${s.customerId}-${idx}`} className="border-b border-[#242526]/5">
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-[#20282c] truncate max-w-[16rem]">
                            {s.name || s.email || "Anonymous app user"}
                          </p>
                          <p className="text-[10px] font-sans text-[#64717a] truncate max-w-[16rem] mt-0.5">
                            {s.name ? (s.email ?? s.customerId) : !s.email ? s.customerId : ""}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          {s.affiliate ? (
                            <Pill tone="dark">
                              {s.affiliate.promoCode || s.affiliate.name}
                            </Pill>
                          ) : (
                            <span className="text-xs text-[#64717a]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#20282c]">{s.productName}</td>
                        <td className="py-3.5 px-4">
                          <Pill
                            tone={
                              ACTIVE_STATUSES.has(s.status)
                                ? "success"
                                : s.status === "expired"
                                  ? "danger"
                                  : "warn"
                            }
                          >
                            {s.status.replace(/_/g, " ")}
                            {s.autoRenews === false && ACTIVE_STATUSES.has(s.status)
                              ? " · cancelling"
                              : ""}
                          </Pill>
                        </td>
                        <td className="py-3.5 px-4 font-sans text-xs text-[#64717a] whitespace-nowrap">
                          {s.startedAt ? formatShortDate(s.startedAt) : "—"}
                        </td>
                        <td className="py-3.5 px-4 font-sans text-xs text-[#64717a] whitespace-nowrap">
                          {s.currentPeriodEndsAt ? formatShortDate(s.currentPeriodEndsAt) : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-sans">
                          {s.grossUsd != null ? formatCurrency(s.grossUsd) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data?.subscriptions?.partial && (
                  <p className="text-xs text-[#64717a] mt-3">
                    Showing the most recently active customers; the full base is larger
                    than one refresh can cover.
                  </p>
                )}
                <p className="text-xs text-[#64717a] mt-2">
                  Purchases made while signed in carry the customer&rsquo;s app
                  account, so their email resolves automatically. Guest purchases
                  stay anonymous until the customer signs in or restores.
                </p>
              </div>
            )}
          </section>

          {/* Matches */}
          <section className="glass-surface rounded-lg p-6 md:p-7 mb-10">
            <SectionTitle
              eyebrow="Cross-sell"
              title="Store customers in the app"
              right={
                <span className="text-xs text-[#64717a]">
                  Matched by email, then by name
                </span>
              }
            />
            <p className="text-sm text-[#64717a] mt-2 mb-5 leading-relaxed">
              App accounts that match a store customer. When a matched customer
              came through an affiliate, each app subscription payment is
              credited to that affiliate at the current rate ({rate}%) — added
              to their payout once the charge has settled for a few days and
              the subscription is still active, so refunds never pay out. Only
              paying subscribers earn commission; downloading the app alone
              earns nothing. The button on each row is for manual top-ups or
              corrections only.
            </p>
            {data && data.matches.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No matches yet"
                description="As store customers sign up in the app (same email or name), they show up here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-[#242526]/8">
                      <Th>App user</Th>
                      <Th>Store customer</Th>
                      <Th>Match</Th>
                      <Th>Affiliate</Th>
                      <Th align="right">Store spend</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.matches ?? []).map((m) => {
                      const key = m.appUser.email || m.store.email;
                      const open = recordFor === key;
                      return (
                        <FragmentRow key={key}>
                          <tr className="border-b border-[#242526]/5">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <p className="font-medium leading-tight">
                                  {m.appUser.name || "—"}
                                </p>
                                {m.appSubscription && (
                                  <Pill
                                    tone={m.appSubscription.active ? "success" : "warn"}
                                  >
                                    {m.appSubscription.active
                                      ? "subscribed"
                                      : "sub ended"}
                                  </Pill>
                                )}
                              </div>
                              <p className="text-xs text-[#64717a] mt-0.5 truncate max-w-[15rem]">
                                {m.appUser.email || "no email"} · joined{" "}
                                {formatShortDate(m.appUser.createdAt)}
                              </p>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="leading-tight">{m.store.name || "—"}</p>
                              <p className="text-xs text-[#64717a] mt-0.5">
                                {m.store.orders}{" "}
                                {m.store.orders === 1 ? "order" : "orders"}
                              </p>
                            </td>
                            <td className="py-3.5 px-4">
                              <Pill tone={m.basis === "email" ? "success" : "neutral"}>
                                {m.basis}
                              </Pill>
                            </td>
                            <td className="py-3.5 px-4">
                              {m.affiliate ? (
                                <Pill tone="dark">{m.affiliate.promoCode || m.affiliate.name}</Pill>
                              ) : (
                                <span className="text-xs text-[#64717a]">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              {formatCurrency(m.store.totalSpent)}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {m.affiliate ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecordFor(open ? null : key);
                                    setAmountInput("12.99");
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#242526] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] font-sans text-white hover:opacity-90 transition-opacity"
                                >
                                  <Gift className="h-3 w-3" />
                                  {m.commissionsRecorded > 0
                                    ? `Commission (${m.commissionsRecorded})`
                                    : "Commission"}
                                </button>
                              ) : (
                                <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                                  No affiliate
                                </span>
                              )}
                            </td>
                          </tr>
                          {open && m.affiliate && (
                            <tr className="border-b border-[#242526]/5 bg-[#242526]/[0.02]">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs text-[#64717a]">
                                    App subscription amount:
                                  </span>
                                  {["12.99", "49.99", "149.99"].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setAmountInput(preset)}
                                      className={`px-3 py-1.5 rounded-full text-xs font-sans border transition-colors ${
                                        amountInput === preset
                                          ? "bg-[#242526] text-white border-[#242526]"
                                          : "border-[#242526]/15 text-[#20282c] hover:bg-[#242526]/5"
                                      }`}
                                    >
                                      ${preset}
                                    </button>
                                  ))}
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amountInput}
                                    onChange={(e) => setAmountInput(e.target.value)}
                                    className="w-24 glass-surface rounded-full px-3 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
                                  />
                                  <span className="text-xs text-[#64717a]">
                                    → {m.affiliate.name} earns{" "}
                                    <strong className="text-[#20282c]">
                                      {previewCommission != null
                                        ? formatCurrency(previewCommission)
                                        : "—"}
                                    </strong>{" "}
                                    ({rate}%)
                                  </span>
                                  <button
                                    type="button"
                                    disabled={recording}
                                    onClick={() => recordCommission(m)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[#242526] px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                                  >
                                    {recording ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Gift className="h-3 w-3" />
                                    )}
                                    Record
                                  </button>
                                </div>
                                <p className="text-[11px] text-[#64717a] mt-2">
                                  One commission per app customer per month. It shows up
                                  under Payouts as &ldquo;App commission&rdquo;.
                                </p>
                              </td>
                            </tr>
                          )}
                        </FragmentRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Settings + recorded commissions */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
            <div className="glass-surface rounded-lg p-6 md:p-7">
              <SectionTitle eyebrow="Settings" title="App commission rate" />
              <p className="text-sm text-[#64717a] mt-2 leading-relaxed">
                Percentage of each app subscription payment an affiliate earns
                when a matched paying subscriber came through them. Booked a few
                days after every successful charge.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-28 glass-surface rounded-full pl-4 pr-8 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#64717a]">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  onClick={saveRate}
                  disabled={savingRate || String(rate) === rateInput}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#242526] px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {savingRate ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Settings2 className="h-3 w-3" />
                  )}
                  Save
                </button>
              </div>
            </div>

            <div className="glass-surface rounded-lg p-6 md:p-7">
              <SectionTitle eyebrow="History" title="Recorded app commissions" />
              {data && data.commissions.length === 0 ? (
                <p className="text-sm text-[#64717a] mt-3">
                  Nothing recorded yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {(data?.commissions ?? []).slice(0, 12).map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate">
                          {c.affiliateName}{" "}
                          <span className="text-[#64717a]">
                            · {c.customerName || c.customerEmail}
                          </span>
                        </p>
                        <p className="text-[10px] font-sans text-[#64717a] mt-0.5">
                          {formatShortDate(c.createdAt)} · {c.status}
                        </p>
                      </div>
                      <span className="font-sans whitespace-nowrap">
                        {originalField(c, "commission")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
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
      className={`py-3 px-4 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
