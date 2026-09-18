"use client";
// BODY COMMAND ADAPTER
import { canonicalActionFetch as fetch } from "@/lib/affiliates/canonical-action-fetch";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  X,
  Users,
  Download,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Trash2,
  UserSquare,
  ArrowRight,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface BankInfo {
  accountHolder?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: "checking" | "savings";
  country?: string;
  paypalEmail?: string;
  zelle?: string;
  notes?: string;
}

interface AffiliateRow {
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
  status: "active" | "pending" | "disabled";
  commissionRate: number;
  recurringCommissionRate: number;
  couponRate: number;
  referrerId: string | null;
  referralCommissionRate: number | null;
  bonusThreshold: number | null;
  bonusRate: number | null;
  createdAt: string;
  bankInfo: BankInfo | null;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
  };
  lastPayoutAt: string | null;
}

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled" | "pending">("all");
  const [selected, setSelected] = useState<AffiliateRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/affiliates", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAffiliates(data.affiliates ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return affiliates.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.promoCode.toLowerCase().includes(q)
      );
    });
  }, [affiliates, search, statusFilter]);

  const totals = useMemo(() => {
    const active = affiliates.filter((a) => a.status === "active").length;
    const withBank = affiliates.filter((a) => a.bankInfo).length;
    const pending = affiliates.reduce(
      (s, a) => s + (a.stats?.pendingCommission ?? 0),
      0
    );
    const paid = affiliates.reduce(
      (s, a) => s + (a.stats?.paidCommission ?? 0),
      0
    );
    return { active, withBank, pending, paid };
  }, [affiliates]);

  return (
    <>
      <PageHeader
        eyebrow="Roster"
        title="Manage affiliates"
        description="Bank info, contact details, payout history and account controls."
        actions={
          <>
            <a
              href="/api/affiliates/admin/export?type=affiliates"
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </>
        }
      />

      {/* Top stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total"
          value={String(affiliates.length)}
          hint={`${totals.active} active`}
        />
        <StatCard
          icon={CreditCard}
          label="With bank info"
          value={String(totals.withBank)}
          hint="Ready for payout"
        />
        <StatCard
          icon={CreditCard}
          label="Pending payout"
          value={formatCurrency(totals.pending)}
          accent
        />
        <StatCard
          icon={CreditCard}
          label="Paid lifetime"
          value={formatCurrency(totals.paid)}
        />
      </section>

      {/* Filters */}
      <section className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
          <input
            type="text"
            placeholder="Search by name, email or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
        </div>
        <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1">
          {(["all", "active", "pending", "disabled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
                statusFilter === s
                  ? "bg-[#242526] text-white"
                  : "text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Table */}
      {loading ? (
        <div className="glass-surface rounded-lg p-12 animate-pulse text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matches" : "No affiliates yet"}
          description={
            search
              ? "Try a different search or clear the status filter."
              : "Create your first affiliate to populate the roster."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[#242526]/8">
                  <Th>Affiliate</Th>
                  <Th>Code</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                  <Th align="right">Commission</Th>
                  <Th align="right">Pending</Th>
                  <Th>Bank</Th>
                  <Th>Status</Th>
                  <Th align="right">Last payout</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="border-b border-[#242526]/5 last:border-0 hover:bg-white/40 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-5">
                      <p className="font-medium leading-tight">
                        {a.firstName} {a.lastName}
                      </p>
                      <p className="text-xs text-[#64717a] mt-0.5">{a.email}</p>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center font-sans text-xs px-2.5 py-1 rounded-full bg-[#242526]/5 border border-[#242526]/10">
                        {a.promoCode}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right font-sans text-[#64717a]">
                      {a.stats.totalOrders}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {formatCurrency(a.stats.totalRevenue)}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {formatCurrency(a.stats.totalCommission)}
                    </td>
                    <td className="py-4 px-5 text-right font-sans text-[#20282c]">
                      {formatCurrency(a.stats.pendingCommission)}
                    </td>
                    <td className="py-4 px-5">
                      {a.bankInfo ? (
                        <Pill tone="success">On file</Pill>
                      ) : (
                        <Pill tone="warn">Missing</Pill>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <Pill tone={a.status === "active" ? "success" : "warn"}>
                        {a.status}
                      </Pill>
                    </td>
                    <td className="py-4 px-5 text-right font-sans text-xs text-[#64717a]">
                      {a.lastPayoutAt ? formatShortDate(a.lastPayoutAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <AffiliateDetailDrawer
          affiliate={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            load();
            setSelected(null);
          }}
        />
      )}

      {showCreate && (
        <CreateAffiliateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
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

function AffiliateDetailDrawer({
  affiliate,
  onClose,
  onUpdated,
}: {
  affiliate: AffiliateRow;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [bank, setBank] = useState<BankInfo>(affiliate.bankInfo ?? {});
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [status, setStatus] = useState(affiliate.status);
  const [commissionRate, setCommissionRate] = useState(affiliate.commissionRate);
  const [recurringCommissionRate, setRecurringCommissionRate] = useState(
    affiliate.recurringCommissionRate
  );
  const [couponRate, setCouponRate] = useState(affiliate.couponRate);
  const [promoCode, setPromoCode] = useState(affiliate.promoCode);
  const [couponWarning, setCouponWarning] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState(affiliate.referrerId ?? "");
  const [referralRate, setReferralRate] = useState(
    affiliate.referralCommissionRate ?? 5
  );
  // Monthly sales bonus — empty target means the program is off.
  const [bonusThreshold, setBonusThreshold] = useState(
    affiliate.bonusThreshold != null ? String(affiliate.bonusThreshold) : ""
  );
  const [bonusRate, setBonusRate] = useState(
    affiliate.bonusRate != null ? String(affiliate.bonusRate) : "5"
  );
  const [referrerOptions, setReferrerOptions] = useState<
    { id: string; name: string; promoCode: string; isAdmin: boolean }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/affiliates/admin/referrer-options", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.options) {
          setReferrerOptions(
            (data.options as typeof referrerOptions).filter(
              (o) => o.id !== affiliate.id
            )
          );
        }
      })
      .catch(() => {});
  }, [affiliate.id]);

  async function handleSave() {
    const newCode = promoCode.trim().toUpperCase();
    const codeChanged = newCode !== affiliate.promoCode.toUpperCase();
    if (
      codeChanged &&
      !window.confirm(
        `Change this affiliate's code from ${affiliate.promoCode} to ${newCode}?\n\nThe old coupon stops working immediately and a new WooCommerce coupon is created. Future sales attribute through ${newCode} only.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    setCouponWarning(null);
    try {
      const res = await fetch(`/api/affiliates/admin/affiliates/${affiliate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bankInfo: bank,
          status,
          commissionRate,
          recurringCommissionRate,
          couponRate,
          promoCode: newCode,
          referrerId: referrerId || null,
          referralCommissionRate: referralRate,
          bonusThreshold: Number(bonusThreshold) > 0 ? Number(bonusThreshold) : null,
          bonusRate: Number(bonusThreshold) > 0 ? Number(bonusRate) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      if (data.couponWarning) {
        setCouponWarning(String(data.couponWarning));
      }
      setSuccess(true);
      setTimeout(() => onUpdated(), data.couponWarning ? 3500 : 600);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this affiliate? This cannot be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/affiliates/admin/affiliates/${affiliate.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onUpdated();
    } finally {
      setSaving(false);
    }
  }

  const bankInputClass =
    "bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] transition-colors placeholder:text-[#64717a] w-full";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-[#20282c]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative ml-auto w-full max-w-xl h-full glass-surface-strong overflow-y-auto">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-[#fafbfb]/60 border-b border-[#242526]/8 px-7 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              {affiliate.promoCode}
            </p>
            <h3 className="text-2xl font-medium tracking-tight mt-1">
              {affiliate.firstName} {affiliate.lastName}
            </h3>
            <p className="text-[#64717a] text-sm mt-1">{affiliate.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#242526]/5 -mr-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-8">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/affiliates/admin/affiliates/${affiliate.id}`}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
            >
              <UserSquare className="h-3.5 w-3.5" />
              View recruits & clients
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Stats */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
              Performance
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Orders"
                value={String(affiliate.stats.totalOrders)}
              />
              <MiniStat
                label="Revenue"
                value={formatCurrency(affiliate.stats.totalRevenue)}
              />
              <MiniStat
                label="Commission"
                value={formatCurrency(affiliate.stats.totalCommission)}
              />
              <MiniStat
                label="Pending"
                value={formatCurrency(affiliate.stats.pendingCommission)}
              />
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
              Contact
            </p>
            <ul className="space-y-2 text-sm">
              <ContactRow label="Phone" value={affiliate.phone || "—"} />
              <ContactRow label="WhatsApp" value={affiliate.whatsapp || "—"} />
              <ContactRow label="Instagram" value={affiliate.instagram || "—"} />
              <ContactRow label="TikTok" value={affiliate.tiktok || "—"} />
              <ContactRow
                label="Website"
                value={affiliate.website || "—"}
                href={affiliate.website || undefined}
              />
              <ContactRow
                label="Joined"
                value={formatShortDate(affiliate.createdAt)}
              />
            </ul>
          </section>

          {/* Bank Info */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                Payout / Bank Information
              </p>
              {affiliate.bankInfo ? (
                <Pill tone="success">On file</Pill>
              ) : (
                <Pill tone="warn">Missing</Pill>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
              <input
                placeholder="Account holder"
                value={bank.accountHolder ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, accountHolder: e.target.value })
                }
                className={bankInputClass}
              />
              <input
                placeholder="Bank name"
                value={bank.bankName ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, bankName: e.target.value })
                }
                className={bankInputClass}
              />
              <input
                placeholder="Routing number"
                value={bank.routingNumber ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, routingNumber: e.target.value })
                }
                className={bankInputClass}
              />
              <div className="relative">
                <input
                  placeholder="Account number"
                  type={showAccountNumber ? "text" : "password"}
                  value={bank.accountNumber ?? ""}
                  onChange={(e) =>
                    setBank({ ...bank, accountNumber: e.target.value })
                  }
                  className={`${bankInputClass} pr-8`}
                />
                <button
                  type="button"
                  onClick={() => setShowAccountNumber((v) => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[#64717a] hover:text-[#20282c]"
                >
                  {showAccountNumber ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <select
                value={bank.accountType ?? ""}
                onChange={(e) =>
                  setBank({
                    ...bank,
                    accountType:
                      e.target.value === "checking" || e.target.value === "savings"
                        ? e.target.value
                        : undefined,
                  })
                }
                className={`${bankInputClass} cursor-pointer`}
              >
                <option value="">Account type</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
              <input
                placeholder="Country"
                value={bank.country ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, country: e.target.value })
                }
                className={bankInputClass}
              />
              <input
                placeholder="PayPal email (optional)"
                value={bank.paypalEmail ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, paypalEmail: e.target.value })
                }
                className={bankInputClass}
              />
              <input
                placeholder="Zelle email or phone (optional)"
                value={bank.zelle ?? ""}
                onChange={(e) => setBank({ ...bank, zelle: e.target.value })}
                className={bankInputClass}
              />
              <textarea
                placeholder="Notes / additional payout instructions"
                value={bank.notes ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, notes: e.target.value })
                }
                rows={2}
                className={`${bankInputClass} sm:col-span-2 resize-none`}
              />
            </div>
          </section>

          {/* Account controls */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
              Account
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className={bankInputClass}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="disabled">Disabled</option>
              </select>
              <label className="block">
                <span className="text-xs text-[#64717a]">Promo code</span>
                <input
                  value={promoCode}
                  onChange={(e) =>
                    setPromoCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                    )
                  }
                  maxLength={20}
                  className={`${bankInputClass} font-sans tracking-wide`}
                />
              </label>
            </div>
            {promoCode.trim().toUpperCase() !== affiliate.promoCode.toUpperCase() && (
              <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                Saving renames the code: a new WooCommerce coupon is created with
                the same discount, the old {affiliate.promoCode} coupon is
                deactivated, and all future sales attribute through the new code.
                Past orders and commissions are untouched.
              </p>
            )}
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-4 mb-2">
              Rates
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              <label className="block">
                <span className="text-xs text-[#64717a]">Coupon discount %</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={couponRate}
                  onChange={(e) =>
                    setCouponRate(Number(e.target.value) || 0)
                  }
                  className={bankInputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs text-[#64717a]">First-order commission %</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) =>
                    setCommissionRate(Number(e.target.value) || 0)
                  }
                  className={bankInputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs text-[#64717a]">Recurring commission %</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={recurringCommissionRate}
                  onChange={(e) =>
                    setRecurringCommissionRate(Number(e.target.value) || 0)
                  }
                  className={bankInputClass}
                />
              </label>
            </div>
            <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
              Coupon discount is what customers save at checkout. First-order
              commission applies to a customer&apos;s first (coupon-attributed)
              order; recurring commission applies to their repeat orders. Rate
              changes only affect future orders — past commissions are locked in.
              Run coupon sync after changing the discount.
            </p>

            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-6 mb-2">
              Monthly sales bonus
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              <label className="block">
                <span className="text-xs text-[#64717a]">Sales target / month ($)</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={bonusThreshold}
                  onChange={(e) => setBonusThreshold(e.target.value)}
                  placeholder="e.g. 5000"
                  className={bankInputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs text-[#64717a]">Bonus %</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={bonusRate}
                  onChange={(e) => setBonusRate(e.target.value)}
                  className={bankInputClass}
                />
              </label>
            </div>
            <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
              {Number(bonusThreshold) > 0 ? (
                <>
                  If this affiliate sells $
                  {Number(bonusThreshold).toLocaleString()}+ in a calendar
                  month, they earn an extra {Number(bonusRate) || 0}% on that
                  month&apos;s sales volume. A progress bar shows on their
                  dashboard so they can track it.
                </>
              ) : (
                <>
                  Leave the target empty for no bonus program. When set, the
                  affiliate sees a progress bar filling toward the target each
                  month.
                </>
              )}
            </p>

            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-6 mb-2">
              Referred by
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              <label className="block">
                <span className="text-xs text-[#64717a]">Referrer</span>
                <select
                  value={referrerId}
                  onChange={(e) => setReferrerId(e.target.value)}
                  className={bankInputClass}
                >
                  <option value="">No referrer</option>
                  {referrerOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.isAdmin ? "★ " : ""}
                      {r.name} ({r.promoCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-[#64717a]">Referral commission %</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={referralRate}
                  onChange={(e) => setReferralRate(Number(e.target.value) || 0)}
                  className={bankInputClass}
                />
              </label>
            </div>
            <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
              You can assign or change the referrer at any time, even after
              approval. The referrer earns the referral % on this
              affiliate&apos;s future sales, and gets an email letting them
              know the affiliate was added to their network (no email for the
              ★ house account).
            </p>
          </section>

          {error && (
            <p className="text-amber-700 text-sm p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[#20282c] text-sm p-3 bg-[#242526]/5 border border-[#242526]/10 rounded-xl">
              Saved.
            </p>
          )}
          {couponWarning && (
            <p className="text-amber-700 text-sm p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
              Saved, but check WooCommerce: {couponWarning}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pb-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#64717a]/10 text-[#64717a] hover:bg-[#64717a]/15 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#242526]/4 border border-[#242526]/8 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
        {label}
      </p>
      <p className="font-sans text-base font-medium mt-1.5">{value}</p>
    </div>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-[#242526]/5 last:border-0 pb-2">
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
        {label}
      </span>
      {href ? (
        <a
          href={href.startsWith("http") ? href : `https://${href}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline inline-flex items-center gap-1"
        >
          {value}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-sm">{value}</span>
      )}
    </li>
  );
}

function CreateAffiliateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nickname: "",
    role: "affiliate" as "affiliate" | "admin",
    commissionRate: 15,
    recurringCommissionRate: 10,
    couponRate: 15,
    referrerId: "",
    referralCommissionRate: 5,
    sendEmail: true,
  });
  const [referrers, setReferrers] = useState<
    { id: string; name: string; promoCode: string; isAdmin?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/affiliates/admin/referrer-options", {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((data) => {
        if (!cancelled) setReferrers(data.options ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const previewCode = useMemo(() => {
    const clean = form.nickname.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return clean ? `${clean}15` : "";
  }, [form.nickname]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          nickname: form.nickname,
          role: form.role,
          commissionRate: form.commissionRate,
          recurringCommissionRate: form.recurringCommissionRate,
          couponRate: form.couponRate,
          referrerId:
            form.role === "affiliate" && form.referrerId
              ? form.referrerId
              : null,
          referralCommissionRate:
            form.role === "affiliate" && form.referrerId
              ? form.referralCommissionRate
              : 0,
          sendEmail: form.sendEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to create");
        return;
      }
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] transition-colors placeholder:text-[#64717a] w-full";

  const referrer = referrers.find((r) => r.id === form.referrerId);

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
        <h3 className="text-2xl font-medium tracking-tight mb-1">
          New affiliate
        </h3>
        <p className="text-sm text-[#64717a] mb-6">
          Provision a partner or admin account.
        </p>
        {error && (
          <p className="text-amber-700 text-sm mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            {error}
          </p>
        )}
        <form onSubmit={submit} className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
            Identity
          </p>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="First name*"
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
              required
              className={inputClass}
            />
            <input
              placeholder="Last name*"
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
              required
              className={inputClass}
            />
          </div>
          <input
            type="email"
            placeholder="Email*"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
            required
            className={inputClass}
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) =>
              setForm((f) => ({ ...f, phone: e.target.value }))
            }
            className={inputClass}
          />
          <p className="text-xs text-[#64717a] py-3">
            Identity setup is handled by the canonical provider. Creating a profile
            does not confirm login access, email delivery or creator-code activation.
          </p>
          <input
            placeholder="Nickname (for promo code)*"
            value={form.nickname}
            onChange={(e) =>
              setForm((f) => ({ ...f, nickname: e.target.value }))
            }
            required
            className={inputClass}
          />
          {previewCode && (
            <div className="!mt-4 rounded-xl px-4 py-3 bg-[#242526] text-white">
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55">
                Code preview
              </p>
              <p className="font-sans text-lg font-medium mt-0.5">
                {previewCode}
              </p>
            </div>
          )}

          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] !mt-6 mb-2">
            Role
          </p>
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as "affiliate" | "admin",
              }))
            }
            className={`${inputClass} cursor-pointer`}
          >
            <option value="affiliate">Affiliate</option>
            <option value="admin">Admin</option>
          </select>

          {form.role === "affiliate" && (
            <>
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] !mt-6 mb-2">
                Rates
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-[#64717a]">Coupon discount</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={form.couponRate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          couponRate: Math.max(0, Number(e.target.value) || 0),
                        }))
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
                      value={form.commissionRate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          commissionRate: Math.max(
                            0,
                            Number(e.target.value) || 0
                          ),
                        }))
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
                      value={form.recurringCommissionRate}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          recurringCommissionRate: Math.max(
                            0,
                            Number(e.target.value) || 0
                          ),
                        }))
                      }
                      className={inputClass}
                    />
                    <span className="text-sm text-[#64717a] font-sans">%</span>
                  </div>
                </label>
              </div>

              <div className="!mt-5 rounded-lg bg-[#242526]/4 border border-[#242526]/8 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2">
                  Referred by (optional)
                </p>
                <select
                  value={form.referrerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, referrerId: e.target.value }))
                  }
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

                {form.referrerId && (
                  <>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-5 mb-2">
                      Referrer's cut
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="50"
                        value={form.referralCommissionRate}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            referralCommissionRate: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          }))
                        }
                        className={inputClass}
                      />
                      <span className="text-sm text-[#64717a] font-sans">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-[#64717a] mt-2 leading-relaxed">
                      We'll automatically credit{" "}
                      <span className="font-sans text-[#20282c]">
                        {referrer?.name}
                      </span>{" "}
                      with {form.referralCommissionRate}% of every order this
                      affiliate brings in.
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          <label className="!mt-6 flex items-start gap-3 cursor-pointer rounded-lg px-4 py-3 border border-[#242526]/8 hover:bg-[#242526]/[0.02] transition-colors">
            <input
              type="checkbox"
              checked={form.sendEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, sendEmail: e.target.checked }))
              }
              className="mt-1 accent-[#242526]"
            />
            <div className="text-sm">
              <p className="font-medium text-[#20282c] leading-tight">
                Send welcome email
              </p>
              <p className="text-[11px] text-[#64717a] mt-1 leading-relaxed">
                We'll email {form.email || "them"} their promo code, commission
                rate, login URL and temporary password.
              </p>
            </div>
          </label>

          <div className="!mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center glass-surface rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create & notify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
