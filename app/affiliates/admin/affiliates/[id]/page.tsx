"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import Link from "next/link";
import { SharedProgram } from "@/components/affiliates/shared/SharedProgram";
import { RecruitmentLink } from "@/components/affiliates/RecruitmentLink";
import {
  ArrowLeft,
  Search,
  Users,
  ShoppingBag,
  Repeat,
  X,
  Mail,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import { OrderDetailDrawer } from "@/components/affiliates/shared/OrderDetailDrawer";

interface Customer {
  key: string;
  email: string;
  name: string;
  currencies: MoneyBucket[];
  totalSpent: number | null;
  totalCommission: number | null;
  orderCount: number;
  codeOrders: number;
  recurringOrders: number;
  firstOrderAt: string;
  lastOrderAt: string;
  isRecurring: boolean;
}

interface OrderRow {
  currency?: string | null;
  id: string;
  orderId: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring" | "referral" | "bonus";
  status: "pending" | "paid";
  createdAt: string;
}

import { formatBuckets, formatDenominated, type BucketedMoney, type MoneyBucket } from "@/components/affiliates/shared/currency-view";

interface Referee {
  currencies: MoneyBucket[];
  storeRevenue: number | null;
  orderCount: number;
  createdAt: string;
  id: string;
  name: string;
  promoCode: string;
  commissionRate: number;
  status: string;
}

interface AffiliateInfo {
  inviteUrl: string;
  id: string;
  name: string;
  promoCode: string;
}

export default function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [info, setInfo] = useState<AffiliateInfo | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [networkRevenue, setNetworkRevenue] = useState<BucketedMoney | null>(null);
  const [referrerId, setReferrerId] = useState("");
  const [referrerOptions, setReferrerOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "recurring" | "new">("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<OrderRow[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/affiliates/admin/affiliates/${id}/clients`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setInfo(data.affiliate);
        setCustomers(data.customers ?? []);
        setReferees(data.referees ?? []);
        setNetworkRevenue(data.network ?? null);
        const [profileRes, optionsRes] = await Promise.all([
          fetch(`/api/affiliates/admin/affiliates/${id}`, { credentials: "include" }),
          fetch("/api/affiliates/admin/referrer-options", { credentials: "include" }),
        ]);
        if (!profileRes.ok || !optionsRes.ok) throw new Error("Could not load referrer settings.");
        setReferrerId((await profileRes.json()).affiliate?.referrerId ?? "");
        setReferrerOptions((await optionsRes.json()).options ?? []);
      } else {
        throw new Error("Could not load affiliate details.");
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load affiliate details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  async function saveReferrer() {
    setSaving(true); setNotice("");
    try {
      const res = await fetch(`/api/affiliates/admin/affiliates/${id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrerId: referrerId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save referrer.");
      setNotice("Referrer saved. Historical commission entries are unchanged.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save referrer."); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function openCustomer(c: Customer) {
    setSelected(c);
    setSelectedOrders([]);
    const res = await fetch(
      `/api/affiliates/admin/affiliates/${id}/clients?customer=${encodeURIComponent(
        c.key
      )}`,
      { credentials: "include" }
    );
    if (res.ok) {
      const data = await res.json();
      setSelectedOrders(data.orders ?? []);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === "recurring" && !c.isRecurring) return false;
      if (filter === "new" && c.isRecurring) return false;
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    });
  }, [customers, search, filter]);

  const totals = useMemo(() => {
    const recurring = customers.filter((c) => c.isRecurring).length;
    return { recurring };
  }, [customers]);

  return (
    <>
      <SharedProgram admin brand="supplements" affiliateId={id} title="Affiliate shared performance" />
      <Link
        href="/affiliates/admin/affiliates"
        className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All affiliates
      </Link>

      <PageHeader
        eyebrow={info ? info.promoCode : "Loading"}
        title={info ? `${info.name}'s network & clients` : "Loading…"}
        description="Contact and network directory (lifetime, not filtered). All financial reporting is in the shared report above."
      />

      {loadError && <p role="alert" className="text-amber-700 mb-4">{loadError} <button className="underline" onClick={load}>Retry</button></p>}
      {info?.inviteUrl && <RecruitmentLink inviteUrl={info.inviteUrl} />}
      {!loading && !loadError && <section className="glass-surface rounded-lg p-5 mb-6">
        <label htmlFor="referrer" className="block text-sm mb-2">Referred by</label>
        <select id="referrer" value={referrerId} onChange={e => setReferrerId(e.target.value)} className="border rounded-lg p-2 text-sm mr-3">
          <option value="">No referrer</option>
          {referrerId && !referrerOptions.some(r => r.id === referrerId) && <option value={referrerId}>Current referrer (unavailable)</option>}
          {referrerOptions.filter(r => r.id !== id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button disabled={saving} onClick={saveReferrer} className="underline text-sm">{saving ? "Saving…" : "Save referrer"}</button>
        <p className="text-xs text-[#64717a] mt-3">Changes apply to future commissions only. Approval status is unchanged.</p>
        {notice && <p role="status" className="text-sm mt-2">{notice}</p>}
      </section>}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Clients"
          value={String(customers.length)}
        />
        <StatCard
          icon={Repeat}
          label="Recurring"
          value={String(totals.recurring)}
          accent
          hint={
            customers.length > 0
              ? `${((totals.recurring / customers.length) * 100).toFixed(
                  0
                )}% of base`
              : undefined
          }
        />


      </section>

      {!loading && !loadError && (
        <section className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
            Direct recruits of {info?.name ?? "this affiliate"} · {referees.length}
          </p>
          <p className="text-xl font-medium mb-2">Legacy network sales (unfiltered): {formatBuckets(networkRevenue, 'storeRevenue')}</p>
          <p className="text-xs text-[#64717a] mb-4">Lifetime recorded store sales from current direct recruits, including recurring orders. Excludes referral mirrors, bonus/app commission rows and known voided entries. Includes recorded signed refund adjustments; original Woo revenue uses its recorded net basis. App subscription revenue is not included. This is sales revenue, not the recruiter’s commission.</p>
          {referees.length === 0 && <p className="text-sm text-[#64717a]">No referred applications yet.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {referees.map((r) => (
              <Link
                key={r.id}
                href={`/affiliates/admin/affiliates/${r.id}`}
                className="glass-surface rounded-lg p-5 flex items-center gap-3 hover:bg-white/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#242526]/8 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-[#20282c]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <p className="text-xs text-[#64717a] font-sans mt-0.5 truncate">
                    {r.promoCode} · {r.commissionRate}%
                  </p>
                  <p className="text-sm mt-2">Legacy lifetime: {formatBuckets(r, 'storeRevenue')} · {r.orderCount} orders</p>
                  <p className="text-xs text-[#64717a] mt-1">Applied {formatShortDate(r.createdAt)}</p>
                </div>
                <Pill tone={r.status === "active" ? "success" : "warn"}>
                  {r.status}
                </Pill>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
        </div>
        <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1">
          {(["all", "recurring", "new"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
                filter === f
                  ? "bg-[#242526] text-white"
                  : "text-[#64717a] hover:text-[#20282c]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients"
          description="Customers will appear here once they place orders attributed to this affiliate."
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-[#242526]/8">
                  <Th>Customer</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Spent</Th>
                  <Th align="right">Commission</Th>
                  <Th>Type</Th>
                  <Th align="right">Last</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.key}
                    onClick={() => openCustomer(c)}
                    className="border-b border-[#242526]/5 last:border-0 hover:bg-white/40 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-5">
                      <p className="font-medium leading-tight">{c.name}</p>
                      <p className="text-xs text-[#64717a] mt-0.5">
                        {c.email}
                      </p>
                    </td>
                    <td className="py-4 px-5 text-right font-sans text-[#64717a]">
                      {c.orderCount}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {formatBuckets(c, 'totalSpent')}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {formatBuckets(c, 'totalCommission')}
                    </td>
                    <td className="py-4 px-5">
                      <Pill
                        tone={c.isRecurring ? "dark" : "neutral"}
                        icon={c.isRecurring ? Repeat : ShoppingBag}
                      >
                        {c.isRecurring ? "Recurring" : "New"}
                      </Pill>
                    </td>
                    <td className="py-4 px-5 text-right font-sans text-xs text-[#64717a]">
                      {formatShortDate(c.lastOrderAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <CustomerDrawer
          customer={selected}
          orders={selectedOrders}
          onClose={() => setSelected(null)}
          onOrderClick={setActiveOrderId}
        />
      )}

      <OrderDetailDrawer
        orderId={activeOrderId}
        onClose={() => setActiveOrderId(null)}
        showAffiliate
      />
    </>
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

function CustomerDrawer({
  customer,
  orders,
  onClose,
  onOrderClick,
}: {
  customer: Customer;
  orders: OrderRow[];
  onClose: () => void;
  onOrderClick: (id: string) => void;
}) {
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
              {customer.isRecurring ? "Returning customer" : "New customer"}
            </p>
            <h3 className="text-2xl font-medium tracking-tight mt-1">
              {customer.name}
            </h3>
            <a
              href={`mailto:${customer.email}`}
              className="text-[#64717a] text-sm mt-1 inline-flex items-center gap-1 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {customer.email}
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#242526]/5 -mr-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-8">
          <section className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Orders"
              value={String(customer.orderCount)}
              hint={`${customer.codeOrders} via code · ${customer.recurringOrders} recurring`}
            />
            <MiniStat
              label="Spent"
              value={formatBuckets(customer, 'totalSpent')}
            />
            <MiniStat
              label="Commission"
              value={formatBuckets(customer, 'totalCommission')}
            />
            <MiniStat
              label="Customer since"
              value={formatShortDate(customer.firstOrderAt)}
            />
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
              Order timeline
            </p>
            {orders.length === 0 ? (
              <p className="text-sm text-[#64717a] py-4 text-center">
                Loading orders…
              </p>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    onClick={() => onOrderClick(o.id)}
                    className="flex items-start gap-3 py-3 border-b border-[#242526]/5 last:border-0 cursor-pointer hover:bg-[#242526]/[0.04] -mx-3 px-3 rounded-xl transition-colors"
                  >
                    <div
                      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        o.matchType === "code"
                          ? "bg-[#242526] text-white"
                          : "bg-[#242526]/8 text-[#20282c]"
                      }`}
                    >
                      {o.matchType === "code" ? (
                        <ShoppingBag className="h-4 w-4" />
                      ) : (
                        <Repeat className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          Order #{o.orderId}
                        </p>
                        <Pill
                          tone={o.matchType === "code" ? "dark" : "neutral"}
                        >
                          {o.matchType === "code"
                            ? "Code used"
                            : o.matchType === "bonus"
                            ? "Monthly bonus"
                            : "Auto-matched"}
                        </Pill>
                      </div>
                      <p className="text-[11px] text-[#64717a] mt-1 font-sans">
                        {formatShortDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-sans">
                        {formatDenominated(o.orderTotal, o.currency)}
                      </p>
                      <p className="text-[11px] font-sans text-[#64717a] mt-0.5">
                        + {formatDenominated(o.commission, o.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-[#242526]/4 border border-[#242526]/8 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
        {label}
      </p>
      <p className="font-sans text-base font-medium mt-1.5">{value}</p>
      {hint && (
        <p className="text-[10px] text-[#64717a] mt-1 font-sans">{hint}</p>
      )}
    </div>
  );
}
