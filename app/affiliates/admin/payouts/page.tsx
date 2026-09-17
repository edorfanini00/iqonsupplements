"use client";
// BODY COMMAND ADAPTER
import { canonicalActionFetch as fetch } from "@/lib/affiliates/canonical-action-fetch";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Wallet,
  Download,
  X,
  Send,
  Trash2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Pill,
  EmptyState,
  bonusKindLabel,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import {
  parseOrderTimestamp,
  rangeLabel,
  resolveRange,
} from "@/lib/affiliates/time-series";

/**
 * Payouts are recorded with day precision (the modal's date input), but
 * stored as full ISO timestamps at UTC midnight. Read back just the UTC
 * calendar day and anchor it locally so "today" means the local day the
 * admin picked, not the UTC one.
 */
function paidAtDay(paidAt: string): Date {
  return parseOrderTimestamp(paidAt.slice(0, 10));
}

interface PendingOrderRow {
  id: string;
  orderId: string;
  wooOrderId: number | null;
  customerName: string;
  matchType: "code" | "recurring" | "referral" | "bonus";
  orderTotal: number;
  commission: number;
  couponCode: string | null;
  createdAt: string;
}

interface PendingRow {
  id: string;
  name: string;
  promoCode: string;
  pendingCommission: number;
  pendingOrders: number;
  bankInfoOnFile: boolean;
  orders: PendingOrderRow[];
}

const MATCH_TYPE_LABEL: Record<PendingOrderRow["matchType"], string> = {
  code: "New · code",
  recurring: "Recurring",
  referral: "Referral",
  bonus: "Bonus",
};

function matchTypeLabel(o: {
  matchType: PendingOrderRow["matchType"];
  couponCode?: string | null;
  orderId?: string;
}): string {
  if (o.matchType === "code" && o.couponCode) {
    return `New · ${o.couponCode.toUpperCase()}`;
  }
  if (o.matchType === "bonus" && o.orderId) {
    return bonusKindLabel(o.orderId);
  }
  return MATCH_TYPE_LABEL[o.matchType];
}

/** "#1234" for real orders; bonuses have no order number, the reason column carries the detail. */
function orderRef(o: { matchType: string; wooOrderId: number | null; orderId: string }): string {
  return o.matchType === "bonus" ? "—" : `#${o.wooOrderId ?? o.orderId}`;
}

interface PayoutOrderRow {
  id: string;
  orderId: string;
  wooOrderId: number | null;
  customerName: string;
  matchType: "code" | "recurring" | "referral" | "bonus";
  orderTotal: number;
  commission: number;
  couponCode?: string | null;
  createdAt: string;
}

interface PayoutRow {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  amount: number;
  method: "bank" | "paypal" | "zelle" | "other";
  orderIds: string[];
  orders: PayoutOrderRow[];
  reference?: string;
  notes?: string;
  paidAt: string;
  createdAt: string;
}

export default function AdminPayoutsPage() {
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [preset, setPreset] = useState<Preset>("30d");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<PendingRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPayoutId, setExpandedPayoutId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/payouts", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPending(data.pendingByAffiliate ?? []);
        setPayouts(data.payouts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPayouts = useMemo(() => {
    const range = resolveRange(preset);
    return payouts.filter((p) => {
      const t = paidAtDay(p.paidAt).getTime();
      return t >= range.start.getTime() && t <= range.end.getTime();
    });
  }, [payouts, preset]);

  const totals = useMemo(() => {
    const totalPending = pending.reduce((s, p) => s + p.pendingCommission, 0);
    const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
    const paidInRange = filteredPayouts.reduce((s, p) => s + p.amount, 0);
    return {
      totalPending,
      totalPaid,
      paidInRange,
      affiliatesAwaiting: pending.filter((p) => p.pendingCommission > 0).length,
    };
  }, [pending, payouts, filteredPayouts]);

  async function reverse(id: string) {
    if (!window.confirm("Reverse this payout? Linked orders will return to pending.")) return;
    const res = await fetch(`/api/affiliates/admin/payouts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) load();
  }

  return (
    <>
      <PageHeader
        eyebrow="Payouts"
        title="Settle commissions"
        description="Record what you've paid. We'll automatically deduct it from each affiliate's pending balance."
        actions={
          <>
            <RangePicker value={preset} onChange={setPreset} />
            <a
              href="/api/affiliates/admin/export?type=payouts"
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
          </>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={Wallet}
          label="Total pending"
          value={formatCurrency(totals.totalPending)}
          accent
          hint={`${totals.affiliatesAwaiting} affiliates`}
        />
        <StatCard
          icon={Wallet}
          label="Paid"
          value={formatCurrency(totals.paidInRange)}
          hint={rangeLabel(preset)}
        />
        <StatCard
          icon={Wallet}
          label="Paid lifetime"
          value={formatCurrency(totals.totalPaid)}
        />
        <StatCard
          icon={Wallet}
          label="Payouts"
          value={String(filteredPayouts.length)}
          hint={rangeLabel(preset)}
        />
      </section>

      {/* Pending balances */}
      <section className="mb-10">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              To be paid
            </p>
            <h2 className="text-xl md:text-2xl font-medium tracking-tight mt-1">
              Pending balances
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Loading…
          </div>
        ) : pending.filter((p) => p.pendingCommission > 0).length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nothing to pay"
            description="All affiliate balances are settled."
          />
        ) : (
          <div className="glass-surface rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[#242526]/8">
                    <Th>Affiliate</Th>
                    <Th>Code</Th>
                    <Th align="right">Open orders</Th>
                    <Th align="right">Pending commission</Th>
                    <Th>Bank info</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {pending
                    .filter((p) => p.pendingCommission > 0)
                    .map((p) => (
                      <PendingBalanceRow
                        key={p.id}
                        row={p}
                        expanded={expandedId === p.id}
                        onToggle={() =>
                          setExpandedId((cur) => (cur === p.id ? null : p.id))
                        }
                        onRecord={() => setTarget(p)}
                        onRemoved={load}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Past payouts */}
      <section>
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              History
            </p>
            <h2 className="text-xl md:text-2xl font-medium tracking-tight mt-1">
              Past payouts
            </h2>
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            {filteredPayouts.length} · {rangeLabel(preset)}
          </p>
        </div>

        {payouts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payouts yet"
            description="Payouts you record will appear here for tracking and reversal."
          />
        ) : filteredPayouts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payouts in this range"
            description={`Nothing was paid out in ${rangeLabel(preset).toLowerCase()}. Pick a wider window to see older payouts.`}
          />
        ) : (
          <div className="glass-surface rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[#242526]/8">
                    <Th>Date</Th>
                    <Th>Affiliate</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th align="right">Orders</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.map((p) => (
                    <PayoutHistoryRow
                      key={p.id}
                      payout={p}
                      expanded={expandedPayoutId === p.id}
                      onToggle={() =>
                        setExpandedPayoutId((cur) => (cur === p.id ? null : p.id))
                      }
                      onReverse={() => reverse(p.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {target && (
        <RecordPayoutModal
          target={target}
          onClose={() => setTarget(null)}
          onRecorded={() => {
            setTarget(null);
            load();
          }}
        />
      )}
    </>
  );
}

function PendingBalanceRow({
  row,
  expanded,
  onToggle,
  onRecord,
  onRemoved,
}: {
  row: PendingRow;
  expanded: boolean;
  onToggle: () => void;
  onRecord: () => void;
  onRemoved: () => void;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function removeOrder(o: PendingOrderRow) {
    const what =
      o.matchType === "bonus"
        ? `${o.customerName}`
        : `order #${o.wooOrderId ?? o.orderId}`;
    if (
      !window.confirm(
        `Remove ${what} (${formatCurrency(
          o.commission
        )}) from ${row.name}'s pending payout? This can't be undone.`
      )
    ) {
      return;
    }
    setRemovingId(o.id);
    try {
      const res = await fetch(`/api/affiliates/admin/commissions/${o.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onRemoved();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <tr className="border-b border-[#242526]/5 last:border-0 hover:bg-white/40 transition-colors">
        <td className="py-4 px-5 font-medium">{row.name}</td>
        <td className="py-4 px-5">
          <span className="inline-flex items-center font-sans text-xs px-2.5 py-1 rounded-full bg-[#242526]/5 border border-[#242526]/10">
            {row.promoCode}
          </span>
        </td>
        <td className="py-4 px-5 text-right font-sans text-[#64717a]">
          {row.pendingOrders}
        </td>
        <td className="py-4 px-5 text-right font-sans font-medium">
          {formatCurrency(row.pendingCommission)}
        </td>
        <td className="py-4 px-5">
          {row.bankInfoOnFile ? (
            <Pill tone="success">On file</Pill>
          ) : (
            <Pill tone="warn">Missing</Pill>
          )}
        </td>
        <td className="py-4 px-5 text-right whitespace-nowrap">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 mr-2 text-[10px] uppercase tracking-[0.18em] font-sans border border-[#242526]/15 text-[#20282c] hover:bg-[#242526]/5 transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide" : "Show"}
          </button>
          <button
            onClick={onRecord}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
          >
            <Send className="h-3 w-3" />
            Record payout
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#242526]/5 last:border-0">
          <td colSpan={6} className="px-5 pb-5 pt-0">
            <div className="rounded-lg bg-[#242526]/[0.03] border border-[#242526]/8 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#242526]/8">
                    <Th>Date</Th>
                    <Th>Order</Th>
                    <Th>Customer / reason</Th>
                    <Th>Type</Th>
                    <Th align="right">Order total</Th>
                    <Th align="right">Commission</Th>
                    <Th align="right" />
                  </tr>
                </thead>
                <tbody>
                  {row.orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-[#242526]/5 last:border-0"
                    >
                      <td className="py-2.5 px-5 font-sans text-[#64717a]">
                        {formatShortDate(o.createdAt)}
                      </td>
                      <td className="py-2.5 px-5 font-sans">{orderRef(o)}</td>
                      <td className="py-2.5 px-5">{o.customerName}</td>
                      <td className="py-2.5 px-5">
                        <Pill
                          tone={
                            o.matchType === "code"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {matchTypeLabel(o)}
                        </Pill>
                      </td>
                      <td className="py-2.5 px-5 text-right font-sans text-[#64717a]">
                        {o.matchType === "bonus" ? "—" : formatCurrency(o.orderTotal)}
                      </td>
                      <td className="py-2.5 px-5 text-right font-sans font-medium">
                        {formatCurrency(o.commission)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => removeOrder(o)}
                          disabled={removingId === o.id}
                          title="Remove this order from the payout"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-full text-[#64717a] hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#242526]/10">
                    <td
                      colSpan={5}
                      className="py-2.5 px-5 text-right font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a]"
                    >
                      Total to pay
                    </td>
                    <td className="py-2.5 px-5 text-right font-sans font-semibold">
                      {formatCurrency(row.pendingCommission)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PayoutHistoryRow({
  payout,
  expanded,
  onToggle,
  onReverse,
}: {
  payout: PayoutRow;
  expanded: boolean;
  onToggle: () => void;
  onReverse: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-[#242526]/5 last:border-0 hover:bg-white/40 transition-colors cursor-pointer"
      >
        <td className="py-4 px-5 font-sans text-xs text-[#64717a]">
          {formatShortDate(payout.paidAt.slice(0, 10))}
        </td>
        <td className="py-4 px-5">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#64717a] transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
            <div>
              <p className="font-medium leading-tight">{payout.affiliateName}</p>
              <p className="text-xs text-[#64717a] mt-0.5 font-sans">
                {payout.affiliateCode}
              </p>
            </div>
          </div>
        </td>
        <td className="py-4 px-5">
          <Pill tone="neutral">{payout.method.toUpperCase()}</Pill>
        </td>
        <td className="py-4 px-5 text-[#64717a] font-sans text-xs">
          {payout.reference || "—"}
        </td>
        <td className="py-4 px-5 text-right font-sans text-[#64717a]">
          {payout.orderIds.length}
        </td>
        <td className="py-4 px-5 text-right font-sans font-medium">
          {formatCurrency(payout.amount)}
        </td>
        <td className="py-4 px-5 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReverse();
            }}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
            title="Reverse payout"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#242526]/5 last:border-0">
          <td colSpan={7} className="px-5 pb-5 pt-0">
            <div className="rounded-lg bg-[#242526]/[0.03] border border-[#242526]/8 overflow-hidden">
              {payout.orders.length === 0 ? (
                <p className="px-5 py-4 text-xs text-[#64717a]">
                  No order detail recorded for this payout.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#242526]/8">
                      <Th>Date</Th>
                      <Th>Order</Th>
                      <Th>Customer / reason</Th>
                      <Th>Type</Th>
                      <Th align="right">Order total</Th>
                      <Th align="right">Commission paid</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payout.orders.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b border-[#242526]/5 last:border-0"
                      >
                        <td className="py-2.5 px-5 font-sans text-[#64717a]">
                          {formatShortDate(o.createdAt)}
                        </td>
                        <td className="py-2.5 px-5 font-sans">{orderRef(o)}</td>
                        <td className="py-2.5 px-5">{o.customerName}</td>
                        <td className="py-2.5 px-5">
                          <Pill
                            tone={o.matchType === "code" ? "success" : "neutral"}
                          >
                            {matchTypeLabel(o)}
                          </Pill>
                        </td>
                        <td className="py-2.5 px-5 text-right font-sans text-[#64717a]">
                          {o.matchType === "bonus" ? "—" : formatCurrency(o.orderTotal)}
                        </td>
                        <td className="py-2.5 px-5 text-right font-sans font-medium">
                          {formatCurrency(o.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#242526]/10">
                      <td
                        colSpan={5}
                        className="py-2.5 px-5 text-right font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a]"
                      >
                        Total paid
                      </td>
                      <td className="py-2.5 px-5 text-right font-sans font-semibold">
                        {formatCurrency(payout.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </td>
        </tr>
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

function RecordPayoutModal({
  target,
  onClose,
  onRecorded,
}: {
  target: PendingRow;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [form, setForm] = useState({
    method: "bank" as "bank" | "paypal" | "zelle" | "other",
    reference: "",
    notes: "",
    paidAt: new Date().toISOString().slice(0, 10),
    amount: target.pendingCommission,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          affiliateId: target.id,
          method: form.method,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
          // Anchor the picked day at local noon so the stored timestamp
          // stays on the same calendar day in any timezone.
          paidAt: parseOrderTimestamp(form.paidAt).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      onRecorded();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] transition-colors placeholder:text-[#64717a] w-full";

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
          Record payout
        </p>
        <h3 className="text-2xl font-medium tracking-tight mb-1">
          {target.name}
        </h3>
        <p className="text-sm text-[#64717a] font-sans">{target.promoCode}</p>

        <div className="mt-6 mb-6 rounded-lg bg-[#242526] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55">
              Amount due
            </p>
            <p className="font-sans text-2xl font-medium mt-1">
              {formatCurrency(target.pendingCommission)}
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55">
            {target.pendingOrders} orders
          </p>
        </div>

        {target.orders.length > 0 && (
          <div className="mb-6 max-h-44 overflow-y-auto rounded-lg border border-[#242526]/8 divide-y divide-[#242526]/5">
            {target.orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {o.matchType === "bonus"
                      ? o.customerName
                      : `#${o.wooOrderId ?? o.orderId} · ${o.customerName}`}
                  </p>
                  <p className="text-[#64717a] font-sans mt-0.5">
                    {formatShortDate(o.createdAt)} · {matchTypeLabel(o)}
                  </p>
                </div>
                <p className="font-sans font-medium shrink-0">
                  {formatCurrency(o.commission)}
                </p>
              </div>
            ))}
          </div>
        )}

        {!target.bankInfoOnFile && (
          <div className="mb-5 flex items-start gap-2 p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              No bank info on file for this affiliate. You can still record this
              payout but make sure they've sent payment instructions.
            </p>
          </div>
        )}

        {error && (
          <p className="text-amber-700 text-sm mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-1">
          <div className="grid grid-cols-2 gap-4">
            <select
              value={form.method}
              onChange={(e) =>
                setForm({ ...form, method: e.target.value as typeof form.method })
              }
              className={inputClass}
            >
              <option value="bank">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="zelle">Zelle</option>
              <option value="other">Other</option>
            </select>
            <input
              type="date"
              value={form.paidAt}
              onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
              className={inputClass}
            />
          </div>
          <input
            placeholder="Reference (e.g. wire confirmation #)"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            className={inputClass}
          />
          <textarea
            placeholder="Internal notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className={`${inputClass} resize-none`}
          />

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
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {loading ? "Recording…" : "Mark as paid"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
