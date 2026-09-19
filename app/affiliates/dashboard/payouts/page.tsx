"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Wallet } from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface Payout {
  id: string;
  amount: number;
  method: "bank" | "paypal" | "zelle" | "other";
  orderIds: string[];
  reference?: string;
  notes?: string;
  paidAt: string;
}

interface Stats {
  paidCommission: number;
  pendingCommission: number;
  totalCommission: number;
  totalPayouts: number;
  totalPaidOut: number;
}

export default function AffiliatePayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/dashboard?range=all", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts ?? []);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lastPaidAt = useMemo(
    () => (payouts.length > 0 ? payouts[0].paidAt : null),
    [payouts]
  );

  return (
    <>
      <PageHeader
        eyebrow="Earnings"
        title="Your payouts"
        description="When and how you've been paid for your commissions."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          label="Pending"
          value={stats ? formatCurrency(stats.pendingCommission) : "—"}
          accent
          hint="Awaiting next payout"
        />
        <StatCard
          label="Paid lifetime"
          value={stats ? formatCurrency(stats.paidCommission) : "—"}
        />
        <StatCard
          label="Payouts"
          value={stats ? String(stats.totalPayouts) : "—"}
        />
        <StatCard
          label="Last payout"
          value={lastPaidAt ? formatShortDate(lastPaidAt.slice(0, 10)) : "—"}
        />
      </section>

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payouts yet"
          description="Earnings build up under Pending and clear when we issue your next payout."
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[#242526]/8">
                  <Th>Date</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[#242526]/5 last:border-0"
                  >
                    <td className="py-4 px-5 font-sans text-xs text-[#64717a]">
                      {formatShortDate(p.paidAt.slice(0, 10))}
                    </td>
                    <td className="py-4 px-5">
                      <Pill tone="neutral">{p.method.toUpperCase()}</Pill>
                    </td>
                    <td className="py-4 px-5 text-[#64717a] font-sans text-xs">
                      {p.reference || "—"}
                    </td>
                    <td className="py-4 px-5 text-right font-sans text-[#64717a]">
                      {p.orderIds.length}
                    </td>
                    <td className="py-4 px-5 text-right font-sans font-medium">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
