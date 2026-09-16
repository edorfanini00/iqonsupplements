"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Users,
  ShoppingBag,
  Repeat,
  X,
  Mail,
  TrendingUp,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import { OrderDetailDrawer } from "@/components/affiliates/shared/OrderDetailDrawer";

interface Customer {
  key: string;
  email: string;
  name: string;
  totalSpent: number;
  totalCommission: number;
  orderCount: number;
  codeOrders: number;
  recurringOrders: number;
  firstOrderAt: string;
  lastOrderAt: string;
  isRecurring: boolean;
}

interface OrderRow {
  id: string;
  orderId: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring" | "referral";
  status: "pending" | "paid";
  createdAt: string;
}

export default function AffiliateClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "recurring" | "new">("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<OrderRow[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/clients", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openCustomer(c: Customer) {
    setSelected(c);
    setSelectedOrders([]);
    const res = await fetch(
      `/api/affiliates/clients?customer=${encodeURIComponent(c.key)}`,
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
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
      );
    });
  }, [customers, search, filter]);

  const totals = useMemo(() => {
    const recurring = customers.filter((c) => c.isRecurring).length;
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    const totalCommission = customers.reduce((s, c) => s + c.totalCommission, 0);
    const lifetimeAvg =
      customers.length > 0 ? totalRevenue / customers.length : 0;
    return { recurring, totalRevenue, totalCommission, lifetimeAvg };
  }, [customers]);

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Your customers"
        description="Everyone who's purchased through your code — including repeat buyers we automatically match by name and email."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total clients"
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
              : "—"
          }
        />
        <StatCard
          icon={ShoppingBag}
          label="Lifetime revenue"
          value={formatCurrency(totals.totalRevenue)}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg LTV"
          value={formatCurrency(totals.lifetimeAvg)}
        />
      </section>

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
          title={search || filter !== "all" ? "No matches" : "No clients yet"}
          description={
            search || filter !== "all"
              ? "Try a different filter or search term."
              : "When customers use your code, they'll appear here as clients."
          }
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
                  <Th align="right">Your commission</Th>
                  <Th>Type</Th>
                  <Th align="right">Last order</Th>
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
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="py-4 px-5 text-right font-sans">
                      {formatCurrency(c.totalCommission)}
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
  onOrderClick: (orderId: string) => void;
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
              value={formatCurrency(customer.totalSpent)}
            />
            <MiniStat
              label="Your commission"
              value={formatCurrency(customer.totalCommission)}
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
                          {o.matchType === "code" ? "Code used" : "Auto-matched"}
                        </Pill>
                      </div>
                      <p className="text-[11px] text-[#64717a] mt-1 font-sans">
                        {formatShortDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-sans">
                        {formatCurrency(o.orderTotal)}
                      </p>
                      <p className="text-[11px] font-sans text-[#64717a] mt-0.5">
                        + {formatCurrency(o.commission)}
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
