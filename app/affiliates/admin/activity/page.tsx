"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Activity,
  ShoppingBag,
  Repeat,
  Wallet,
  UserPlus,
} from "lucide-react";
import {
  PageHeader,
  Pill,
  EmptyState,
  formatCurrency,
} from "@/components/affiliates/shared/ui";

interface OrderRow {
  id: string;
  affiliateId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring" | "referral" | "bonus";
  status: "pending" | "paid";
  createdAt: string;
}

interface PayoutRow {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  amount: number;
  method: string;
  paidAt: string;
}

interface AffiliateRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  promoCode: string;
  createdAt: string;
}

type FeedItem =
  | {
      kind: "order";
      ts: number;
      data: OrderRow;
    }
  | {
      kind: "payout";
      ts: number;
      data: PayoutRow;
    }
  | {
      kind: "signup";
      ts: number;
      data: AffiliateRow;
    };

export default function AdminActivityPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "order" | "payout" | "signup">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, payoutRes, affRes] = await Promise.all([
        fetch("/api/affiliates/admin/dashboard?range=all", {
          credentials: "include",
        }),
        fetch("/api/affiliates/admin/payouts", { credentials: "include" }),
        fetch("/api/affiliates/admin/affiliates", { credentials: "include" }),
      ]);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setOrders(data.recentOrders ?? []);
      }
      if (payoutRes.ok) {
        const data = await payoutRes.json();
        setPayouts(data.payouts ?? []);
      }
      if (affRes.ok) {
        const data = await affRes.json();
        setAffiliates(data.affiliates ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];
    for (const o of orders) {
      items.push({ kind: "order", ts: Date.parse(o.createdAt), data: o });
    }
    for (const p of payouts) {
      items.push({ kind: "payout", ts: Date.parse(p.paidAt), data: p });
    }
    for (const a of affiliates) {
      items.push({ kind: "signup", ts: Date.parse(a.createdAt), data: a });
    }
    items.sort((x, y) => y.ts - x.ts);
    return items;
  }, [orders, payouts, affiliates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feed.filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (!q) return true;
      if (item.kind === "order") {
        return (
          item.data.customerName.toLowerCase().includes(q) ||
          item.data.customerEmail.toLowerCase().includes(q) ||
          item.data.orderId.toLowerCase().includes(q)
        );
      }
      if (item.kind === "payout") {
        return (
          item.data.affiliateName.toLowerCase().includes(q) ||
          item.data.affiliateCode.toLowerCase().includes(q)
        );
      }
      return (
        `${item.data.firstName} ${item.data.lastName}`.toLowerCase().includes(q) ||
        item.data.email.toLowerCase().includes(q) ||
        item.data.promoCode.toLowerCase().includes(q)
      );
    });
  }, [feed, search, filter]);

  return (
    <>
      <PageHeader
        eyebrow="Live Feed"
        title="Activity"
        description="Every order, signup and payout in chronological order."
      />

      <section className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a]" />
          <input
            type="text"
            placeholder="Search activity"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-surface rounded-full pl-9 pr-4 py-2.5 text-sm placeholder:text-[#64717a] focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
        </div>
        <div className="inline-flex items-center glass-surface rounded-full p-1 gap-1">
          {(["all", "order", "payout", "signup"] as const).map((f) => (
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
          icon={Activity}
          title="No activity"
          description="As orders come in or payouts go out, they'll appear here."
        />
      ) : (
        <div className="glass-surface rounded-lg p-2 md:p-3">
          <ul>
            {filtered.map((item, idx) => (
              <li
                key={`${item.kind}-${idx}`}
                className="flex items-start gap-4 py-3 px-3 md:px-4 border-b border-[#242526]/5 last:border-0"
              >
                <FeedIcon kind={item.kind} />
                <div className="flex-1 min-w-0">
                  <FeedDescription item={item} />
                  <p className="text-[11px] text-[#64717a] mt-1 font-sans">
                    {timeAgo(item.ts)}
                  </p>
                </div>
                <FeedRight item={item} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function FeedIcon({ kind }: { kind: FeedItem["kind"] }) {
  const Icon =
    kind === "order"
      ? ShoppingBag
      : kind === "payout"
        ? Wallet
        : UserPlus;
  return (
    <div
      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
        kind === "payout"
          ? "bg-[#242526] text-white"
          : "bg-[#242526]/8 text-[#20282c]"
      }`}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

function FeedDescription({ item }: { item: FeedItem }) {
  if (item.kind === "order") {
    return (
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-sm font-medium">{item.data.customerName}</p>
        <span className="text-[#64717a] text-sm">placed order</span>
        <span className="font-sans text-xs text-[#64717a]">
          #{item.data.orderId}
        </span>
        <Pill
          tone={item.data.matchType === "code" ? "dark" : "neutral"}
          icon={item.data.matchType === "code" ? ShoppingBag : Repeat}
        >
          {item.data.matchType === "code"
            ? "Code"
            : item.data.matchType === "bonus"
            ? "Bonus"
            : item.data.matchType === "referral"
            ? "Referral"
            : "Recurring"}
        </Pill>
      </div>
    );
  }
  if (item.kind === "payout") {
    return (
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[#64717a] text-sm">Paid</span>
        <p className="text-sm font-medium">{item.data.affiliateName}</p>
        <span className="font-sans text-xs text-[#64717a]">
          {item.data.affiliateCode}
        </span>
        <Pill tone="neutral">{item.data.method.toUpperCase()}</Pill>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <p className="text-sm font-medium">
        {item.data.firstName} {item.data.lastName}
      </p>
      <span className="text-[#64717a] text-sm">joined as affiliate</span>
      <span className="font-sans text-xs text-[#64717a]">
        {item.data.promoCode}
      </span>
    </div>
  );
}

function FeedRight({ item }: { item: FeedItem }) {
  if (item.kind === "order") {
    return (
      <div className="text-right shrink-0">
        <p className="text-sm font-sans">{formatCurrency(item.data.orderTotal)}</p>
        <p className="text-[11px] font-sans text-[#64717a] mt-0.5">
          + {formatCurrency(item.data.commission)}
        </p>
      </div>
    );
  }
  if (item.kind === "payout") {
    return (
      <p className="text-sm font-sans shrink-0">
        −{formatCurrency(item.data.amount)}
      </p>
    );
  }
  return null;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
