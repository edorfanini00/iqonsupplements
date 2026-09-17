"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Users,
  Network,
  TrendingUp,
  Wallet,
  ArrowDownRight,
  UserPlus,
  Mail,
  Copy,
  Check,
  X,
  MessageCircle,
  Share2,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface BreakdownRow {
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

interface ReferralOrder {
  id: string;
  orderId: string;
  customerName: string;
  orderTotal: number;
  commission: number;
  status: "pending" | "paid";
  createdAt: string;
  sourceAffiliateId: string | null;
  sourceAffiliateName: string | null;
  sourceAffiliateCode: string | null;
}

interface ReferredBy {
  name: string;
  promoCode: string;
  rate: number;
}

const INTRO_SEEN_KEY = "iqon_supplements_affiliate_network_intro_v1";

export default function AffiliateNetworkPage() {
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [recent, setRecent] = useState<ReferralOrder[]>([]);
  const [referredBy, setReferredBy] = useState<ReferredBy | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [referralRate, setReferralRate] = useState<number>(5);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [netRes, inviteRes] = await Promise.all([
        fetch("/api/affiliates/network", { credentials: "include" }),
        fetch("/api/affiliates/invite", { credentials: "include" }),
      ]);
      if (netRes.ok) {
        const data = await netRes.json();
        setBreakdown(data.breakdown ?? []);
        setRecent(data.recentReferralOrders ?? []);
        setReferredBy(data.referredBy ?? null);
        if (typeof data.referralRatePreview === "number") {
          setReferralRate(data.referralRatePreview);
        }
      }
      if (inviteRes.ok) {
        const inviteData = await inviteRes.json();
        if (inviteData.inviteUrl) setInviteUrl(inviteData.inviteUrl);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO_SEEN_KEY)) setIntroOpen(true);
    } catch {
      // localStorage unavailable — skip the intro
    }
  }, []);

  const dismissIntro = useCallback((thenInvite: boolean) => {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setIntroOpen(false);
    if (thenInvite) setInviteOpen(true);
  }, []);

  const totals = useMemo(() => {
    const earned = breakdown.reduce((s, r) => s + r.totalCommission, 0);
    const pending = breakdown.reduce((s, r) => s + r.pendingCommission, 0);
    const paid = breakdown.reduce((s, r) => s + r.paidCommission, 0);
    const orders = breakdown.reduce((s, r) => s + r.ordersCount, 0);
    return { earned, pending, paid, orders };
  }, [breakdown]);

  return (
    <>
      <PageHeader
        eyebrow="Network"
        title="Your referrals"
        description="Affiliates you brought in and the commission you earn from their orders."
        actions={
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#20282c] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#242526] transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite a friend
          </button>
        }
      />

      {referredBy && (
        <section className="mb-6">
          <div className="glass-surface rounded-lg p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#242526]/8 flex items-center justify-center shrink-0">
              <ArrowDownRight className="h-4 w-4 text-[#20282c]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                You were referred by
              </p>
              <p className="text-sm font-medium mt-1 truncate">
                {referredBy.name}{" "}
                <span className="text-[#64717a] font-sans ml-1">
                  · {referredBy.promoCode}
                </span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                Their cut
              </p>
              <p className="text-sm font-sans mt-1">{referredBy.rate}%</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Affiliates referred"
          value={String(breakdown.length)}
          hint={
            breakdown.filter((r) => r.refereeStatus === "active").length > 0
              ? `${
                  breakdown.filter((r) => r.refereeStatus === "active").length
                } active`
              : undefined
          }
        />
        <StatCard
          icon={TrendingUp}
          label="From their orders"
          value={String(totals.orders)}
          hint="Orders that paid you a kickback"
        />
        <StatCard
          icon={Wallet}
          label="Referral earnings"
          value={formatCurrency(totals.earned)}
          accent
          hint={`${formatCurrency(totals.pending)} pending`}
        />
        <StatCard
          icon={Wallet}
          label="Already paid"
          value={formatCurrency(totals.paid)}
        />
      </section>

      <section className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
          Per affiliate
        </p>
        {loading ? (
          <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Loading…
          </div>
        ) : breakdown.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No referrals yet"
            description="When an admin assigns you as a referrer for a new affiliate, you'll automatically earn a cut of their orders. They'll show up here."
          />
        ) : (
          <div className="glass-surface rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[#242526]/8">
                    <Th>Affiliate</Th>
                    <Th>Status</Th>
                    <Th align="right">Your rate</Th>
                    <Th align="right">Orders</Th>
                    <Th align="right">Earned</Th>
                    <Th align="right">Pending</Th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r) => (
                    <tr
                      key={r.refereeId}
                      className="border-b border-[#242526]/5 last:border-0"
                    >
                      <td className="py-4 px-5">
                        <p className="font-medium leading-tight flex items-center gap-2">
                          <UserPlus className="h-3.5 w-3.5 text-[#64717a] shrink-0" />
                          {r.refereeName}
                        </p>
                        <p className="text-xs text-[#64717a] mt-0.5 font-sans">
                          {r.refereePromoCode}
                        </p>
                      </td>
                      <td className="py-4 px-5">
                        <Pill
                          tone={r.refereeStatus === "active" ? "success" : "warn"}
                        >
                          {r.refereeStatus}
                        </Pill>
                      </td>
                      <td className="py-4 px-5 text-right font-sans">
                        {r.referralRate}%
                      </td>
                      <td className="py-4 px-5 text-right font-sans text-[#64717a]">
                        {r.ordersCount}
                      </td>
                      <td className="py-4 px-5 text-right font-sans">
                        {formatCurrency(r.totalCommission)}
                      </td>
                      <td className="py-4 px-5 text-right font-sans text-[#20282c]">
                        {formatCurrency(r.pendingCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
          Recent referral commissions
        </p>
        {recent.length === 0 ? (
          <div className="glass-surface rounded-lg p-8 text-center">
            <p className="text-sm text-[#64717a]">
              No referral commissions yet. As your downstream affiliates get
              orders, the kickbacks will land here.
            </p>
          </div>
        ) : (
          <div className="glass-surface rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[#242526]/8">
                    <Th>Date</Th>
                    <Th>From affiliate</Th>
                    <Th>Customer</Th>
                    <Th align="right">Order</Th>
                    <Th align="right">Your kickback</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-[#242526]/5 last:border-0"
                    >
                      <td className="py-4 px-5 font-sans text-xs text-[#64717a]">
                        {formatShortDate(o.createdAt)}
                      </td>
                      <td className="py-4 px-5">
                        {o.sourceAffiliateName ? (
                          <>
                            <p className="font-medium leading-tight">
                              {o.sourceAffiliateName}
                            </p>
                            <p className="text-xs text-[#64717a] mt-0.5 font-sans">
                              {o.sourceAffiliateCode}
                            </p>
                          </>
                        ) : (
                          <span className="text-[#64717a]">—</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-sm">{o.customerName}</td>
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

      {introOpen && (
        <NetworkIntroModal rate={referralRate} onDismiss={dismissIntro} />
      )}

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          inviteUrl={inviteUrl}
        />
      )}
    </>
  );
}

function NetworkIntroModal({
  rate,
  onDismiss,
}: {
  rate: number;
  onDismiss: (thenInvite: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md glass-surface-strong rounded-lg p-6 md:p-8 text-center max-h-[90vh] overflow-y-auto">
        <div className="mx-auto w-14 h-14 rounded-lg bg-[#20282c] text-white flex items-center justify-center mb-5">
          <Network className="h-6 w-6" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
          Your network
        </p>
        <h2 className="text-2xl font-medium tracking-tight">
          Earn {rate}% of every sale your friends make
        </h2>
        <p className="text-sm text-[#64717a] mt-3 leading-relaxed">
          Refer a friend to the IQON affiliate program and once they&apos;re
          approved, you earn {rate}% of every sale they bring in — on top of
          your own commissions, for as long as they sell.
        </p>
        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => onDismiss(true)}
            className="w-full rounded-lg bg-[#20282c] text-white py-3 text-sm font-medium hover:bg-[#242526] transition-colors inline-flex items-center justify-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Refer a friend now
          </button>
          <button
            onClick={() => onDismiss(false)}
            className="w-full rounded-lg border border-[#242526]/10 py-3 text-sm text-[#64717a] hover:bg-[#242526]/5 transition-colors"
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({
  onClose,
  inviteUrl,
}: {
  onClose: () => void;
  inviteUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: "ok"; email: string; delivery: { ok: boolean; logged?: boolean } }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/affiliates/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "error", message: data.error ?? "Could not send." });
      } else {
        setResult({ kind: "ok", email, delivery: data.delivery });
        setEmail("");
        setFirstName("");
        setMessage("");
      }
    } catch {
      setResult({ kind: "error", message: "Network error. Please retry." });
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: "Join IQON Affiliates",
        text: "Join me as an IQON affiliate — sign up here:",
        url: inviteUrl,
      });
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg glass-surface-strong rounded-lg p-6 md:p-8 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#242526]/8 hover:bg-[#242526]/15 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-[#20282c] text-white flex items-center justify-center">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              Grow your network
            </p>
            <h2 className="text-xl font-medium tracking-tight">
              Invite a friend
            </h2>
          </div>
        </div>
        <p className="text-sm text-[#64717a] mb-5 mt-1">
          We'll email them a personal invite. When they apply through your link
          and get approved, you'll earn a kickback on every order they bring in.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                First name (optional)
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Sarah"
                className="mt-1 w-full rounded-lg bg-[#242526]/5 border border-[#242526]/10 px-4 py-2.5 text-sm focus:outline-none focus:border-[#242526]/30"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="mt-1 w-full rounded-lg bg-[#242526]/5 border border-[#242526]/10 px-4 py-2.5 text-sm focus:outline-none focus:border-[#242526]/30"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              Personal note (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="I think you'd love this product. Thought you'd be perfect for the program."
              className="mt-1 w-full rounded-lg bg-[#242526]/5 border border-[#242526]/10 px-4 py-2.5 text-sm focus:outline-none focus:border-[#242526]/30 resize-none"
            />
            <p className="text-[10px] text-[#64717a] mt-1 text-right font-sans">
              {message.length}/500
            </p>
          </div>

          {result?.kind === "error" && (
            <p className="text-sm text-red-600">{result.message}</p>
          )}
          {result?.kind === "ok" && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-sm text-emerald-900 flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  We&apos;ve sent an email to your friend at{" "}
                  <span className="font-medium">{result.email}</span>. Please
                  tell them to check their inbox — and their junk folder, just
                  in case.
                  {result.delivery?.logged
                    ? " (logged — see server console)"
                    : ""}
                </span>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email}
            className="w-full rounded-lg bg-[#20282c] text-white py-3 text-sm font-medium hover:bg-[#242526] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Mail className="h-4 w-4" />
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </form>

        {inviteUrl && (
          <div className="mt-5 pt-5 border-t border-[#242526]/10">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
              Or share your sign-up link directly
            </p>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded-lg bg-[#242526]/5 border border-[#242526]/10 px-4 py-2.5 text-xs font-sans"
              />
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg border border-[#242526]/10 hover:bg-[#242526]/5 px-4 py-2.5 text-sm inline-flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="flex items-stretch gap-2 mt-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Join me as an IQON affiliate — sign up here: ${inviteUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg border border-[#242526]/10 hover:bg-[#242526]/5 px-4 py-2.5 text-sm inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Share on WhatsApp
              </a>
              {canNativeShare && (
                <button
                  type="button"
                  onClick={nativeShare}
                  className="flex-1 rounded-lg border border-[#242526]/10 hover:bg-[#242526]/5 px-4 py-2.5 text-sm inline-flex items-center justify-center gap-2"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  More options
                </button>
              )}
            </div>
          </div>
        )}
      </div>
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
