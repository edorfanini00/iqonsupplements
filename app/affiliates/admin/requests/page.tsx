"use client";
// BODY COMMAND ADAPTER
import { canonicalActionFetch as fetch } from "@/lib/affiliates/canonical-action-fetch";

import { useEffect, useState, useCallback } from "react";
import {
  Inbox,
  Check,
  X,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import {
  PageHeader,
  Pill,
  EmptyState,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface SuggestedReferrer {
  id: string;
  name: string;
  promoCode: string;
  source: "invite-link";
}

interface RequestRow {
  referralCommissionRate?: number | null;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  promoCode: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
  createdAt: string;
  suggestedReferrer?: SuggestedReferrer | null;
}

interface ReferrerOption {
  id: string;
  name: string;
  promoCode: string;
  isAdmin?: boolean;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [referrers, setReferrers] = useState<ReferrerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<RequestRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/requests", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
        setReferrers(data.referrerOptions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Onboarding"
        title="Affiliate requests"
        description="Approve new affiliates, set their commission rate and optionally credit a referrer."
        actions={
          <span className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            <Inbox className="h-3.5 w-3.5" />
            {requests.length} pending
          </span>
        }
      />

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox zero"
          description="No pending applications. New requests will show up here as people sign up."
        />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {requests.map((r) => (
            <li
              key={r.id}
              className="glass-surface rounded-lg p-6 flex flex-col"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    {formatShortDate(r.createdAt)}
                  </p>
                  <h3 className="text-xl font-medium tracking-tight mt-1">
                    {r.firstName} {r.lastName}
                  </h3>
                  <p className="text-sm text-[#64717a] mt-0.5">{r.email}</p>
                </div>
                <Pill tone="warn">Pending</Pill>
              </div>

              {r.suggestedReferrer && (
                <div className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-[#20282c]/5 border border-[#20282c]/10 px-3 py-1.5">
                  <UserPlus className="h-3 w-3 text-[#20282c]" />
                  <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    Referred by
                  </span>
                  <span className="text-xs font-medium text-[#20282c]">
                    {r.suggestedReferrer.name}
                  </span>
                  <span className="text-xs font-sans text-[#64717a]">
                    · {r.suggestedReferrer.promoCode}
                  </span>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3 mt-5 text-sm">
                <Detail label="Phone" value={r.phone || "—"} />
                <Detail label="WhatsApp" value={r.whatsapp || "—"} />
                <Detail
                  label="Wanted code"
                  value={
                    <span className="font-sans text-[#20282c]">
                      {r.promoCode}
                    </span>
                  }
                />
                <Detail
                  label="Instagram"
                  value={r.instagram || "—"}
                  href={
                    r.instagram
                      ? `https://instagram.com/${r.instagram.replace(/^@/, "")}`
                      : undefined
                  }
                />
                <Detail label="TikTok" value={r.tiktok || "—"} />
                {r.website && (
                  <Detail
                    label="Website"
                    value={r.website}
                    href={
                      r.website.startsWith("http")
                        ? r.website
                        : `https://${r.website}`
                    }
                  />
                )}
              </dl>

              <div className="mt-6 flex gap-2 justify-end">
                <button
                  onClick={() => setActive(r)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
                >
                  Review
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <ReviewModal
          request={active}
          referrers={referrers}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            load();
          }}
        />
      )}
    </>
  );
}

function Detail({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[#20282c]">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            {value}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function ReviewModal({
  request,
  referrers,
  onClose,
  onDone,
}: {
  request: RequestRow;
  referrers: ReferrerOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [promoCode, setPromoCode] = useState(request.promoCode);
  const [commissionRate, setCommissionRate] = useState(15);
  const [recurringCommissionRate, setRecurringCommissionRate] = useState(10);
  const [couponRate, setCouponRate] = useState(15);
  const [supplementsCommissionRate, setSupplementsCommissionRate] = useState<string>("");
  const [skincareCommissionRate, setSkincareCommissionRate] = useState<string>("");
  const [referrerId, setReferrerId] = useState(
    request.suggestedReferrer?.id ?? ""
  );
  const [referralCommissionRate, setReferralCommissionRate] = useState(request.referralCommissionRate ?? 5);
  // Optional monthly sales bonus, off unless a target is entered.
  const [bonusThreshold, setBonusThreshold] = useState("");
  const [bonusRate, setBonusRate] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve(e: React.FormEvent) {
    e.preventDefault();
    if (!promoCode.trim()) {
      setError("Promo code cannot be empty.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/affiliates/admin/requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          promoCode: promoCode.trim(),
          commissionRate,
          recurringCommissionRate,
          couponRate,
          supplementsCommissionRate: supplementsCommissionRate !== "" ? Number(supplementsCommissionRate) : undefined,
          skincareCommissionRate: skincareCommissionRate !== "" ? Number(skincareCommissionRate) : undefined,
          referrerId: referrerId || null,
          referralCommissionRate: referrerId ? referralCommissionRate : 0,
          bonusThreshold: Number(bonusThreshold) > 0 ? Number(bonusThreshold) : undefined,
          bonusRate:
            Number(bonusThreshold) > 0 && Number(bonusRate) > 0
              ? Number(bonusRate)
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || data.error || "Failed to approve");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!window.confirm("Reject and delete this application?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/affiliates/admin/requests/${request.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onDone();
      // BODY COMMAND REJECTION STATE
      else { const data = await res.json(); setError(data.error || "Command not confirmed complete. Check Command recovery."); }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] transition-colors placeholder:text-[#64717a] w-full";

  const referrer = referrers.find((r) => r.id === referrerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#20282c]/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-surface-strong rounded-lg p-7 md:p-9 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#242526]/5"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1">
          Review application
        </p>
        <h3 className="text-2xl font-medium tracking-tight">
          {request.firstName} {request.lastName}
        </h3>
        <p className="text-sm text-[#64717a] mt-0.5">{request.email}</p>

        {error && (
          <p className="text-amber-700 text-sm mt-5 p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <form onSubmit={approve} className="mt-6 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
            Promo code
          </p>
          <div className="mb-5">
            <input
              type="text"
              value={promoCode}
              onChange={(e) =>
                setPromoCode(
                  e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 40)
                )
              }
              className={`${inputClass} font-sans tracking-wide`}
              placeholder="e.g. JANE15"
            />
            <p className="text-xs text-[#64717a] mt-1.5 leading-relaxed">
              {promoCode === request.promoCode ? (
                <>This is the code they asked for — edit it if you want something different.</>
              ) : (
                <>
                  Changed from{" "}
                  <span className="font-sans line-through opacity-70">
                    {request.promoCode}
                  </span>{" "}
                  — the approval email and checkout coupon will use{" "}
                  <span className="font-sans text-[#20282c]">{promoCode || "…"}</span>.
                </>
              )}
            </p>
          </div>

          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
            Rates
          </p>
          <div className="grid grid-cols-2 gap-4 mb-1">
            <label className="block">
              <span className="text-xs text-[#64717a]">Coupon discount</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={couponRate}
                  onChange={(e) =>
                    setCouponRate(Math.max(0, Number(e.target.value) || 0))
                  }
                  className={inputClass}
                />
                <span className="text-sm text-[#64717a] font-sans">%</span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-[#64717a]">First-order commission</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) =>
                    setCommissionRate(Math.max(0, Number(e.target.value) || 0))
                  }
                  className={inputClass}
                />
                <span className="text-sm text-[#64717a] font-sans">%</span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-[#64717a]">Recurring commission</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={recurringCommissionRate}
                  onChange={(e) =>
                    setRecurringCommissionRate(
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  className={inputClass}
                />
                <span className="text-sm text-[#64717a] font-sans">%</span>
              </div>
            </label>
          </div>
          <p className="text-xs text-[#64717a] mb-6 leading-relaxed">
            Customers get {couponRate}% off with code{" "}
            <span className="font-sans text-[#20282c]">{promoCode || request.promoCode}</span>.
            {request.firstName} earns {commissionRate}% on a customer&apos;s first
            order and {recurringCommissionRate}% on their recurring orders.
          </p>

          <div className="rounded-lg bg-[#242526]/4 border border-[#242526]/8 p-4 !mt-4 mb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
              Body rates (Shopify)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-[#64717a]">Supplements %</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={supplementsCommissionRate}
                    onChange={(e) => setSupplementsCommissionRate(e.target.value)}
                    placeholder="Not set"
                    className={inputClass}
                  />
                  <span className="text-sm text-[#64717a] font-sans">%</span>
                </div>
              </label>
              <label className="block">
                <span className="text-xs text-[#64717a]">Skincare %</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={skincareCommissionRate}
                    onChange={(e) => setSkincareCommissionRate(e.target.value)}
                    placeholder="Not set"
                    className={inputClass}
                  />
                  <span className="text-sm text-[#64717a] font-sans">%</span>
                </div>
              </label>
            </div>
            <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
              Leave blank to keep Shopify supplements / skincare orders inactive for this affiliate. When set, orders from those Shopify categories earn at the specified rate instead of the peptides rate.
            </p>
          </div>

          <div className="rounded-lg bg-[#242526]/4 border border-[#242526]/8 p-4 !mt-4 mb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
              Monthly sales bonus (optional)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-[#64717a]">Sales target / month</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#64717a] font-sans">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={bonusThreshold}
                    onChange={(e) => setBonusThreshold(e.target.value)}
                    placeholder="e.g. 5000"
                    className={inputClass}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs text-[#64717a]">Bonus</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={bonusRate}
                    onChange={(e) => setBonusRate(e.target.value)}
                    className={inputClass}
                  />
                  <span className="text-sm text-[#64717a] font-sans">%</span>
                </div>
              </label>
            </div>
            <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
              {Number(bonusThreshold) > 0 ? (
                <>
                  If {request.firstName} sells ${Number(bonusThreshold).toLocaleString()}+
                  in a calendar month, they earn an extra {Number(bonusRate) || 0}% on
                  that month&apos;s sales. They&apos;ll see a progress bar on their
                  dashboard.
                </>
              ) : (
                <>Leave the target empty for no bonus program.</>
              )}
            </p>
          </div>

          <div className="rounded-lg bg-[#242526]/4 border border-[#242526]/8 p-4 !mt-4">
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
              Referred by (optional)
            </p>
            {request.suggestedReferrer && (
              <p className="text-xs text-[#20282c] mb-2 inline-flex items-center gap-1.5 bg-[#20282c]/5 px-2 py-1 rounded-full">
                <UserPlus className="h-3 w-3" />
                Pre-selected from invite link
              </p>
            )}
            <select
              value={referrerId}
              onChange={(e) => setReferrerId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">— Nobody —</option>
              {referrers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.isAdmin
                    ? `${r.name} — Admin (house account)`
                    : `${r.name} (${r.promoCode})`}
                </option>
              ))}
            </select>

            {referrerId && (
              <>
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-5 mb-2">
                  Referrer's cut
                </p>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={referralCommissionRate}
                    onChange={(e) =>
                      setReferralCommissionRate(
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className={inputClass}
                  />
                  <span className="text-sm text-[#64717a] font-sans">%</span>
                </div>
                <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
                  We'll automatically credit{" "}
                  <span className="font-sans text-[#20282c]">
                    {referrer?.name}
                  </span>{" "}
                  with {referralCommissionRate}% of every order{" "}
                  {request.firstName} brings in — on top of the{" "}
                  {commissionRate}% paid to {request.firstName}.
                </p>
              </>
            )}
          </div>

          <div className="!mt-8 flex gap-3">
            <button
              type="button"
              onClick={reject}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#64717a]/10 text-[#64717a] hover:bg-[#64717a]/15 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {loading ? "Approving…" : "Approve"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
