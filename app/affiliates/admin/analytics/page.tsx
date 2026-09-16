"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { TrendingUp, ShoppingBag, Users, Repeat } from "lucide-react";
import { AreaChart } from "@/components/affiliates/charts/AreaChart";
import { BarChart } from "@/components/affiliates/charts/BarChart";
import { Donut } from "@/components/affiliates/charts/Donut";
import { RangePicker, type Preset } from "@/components/affiliates/shared/RangePicker";
import { useCalendarDay } from "@/components/affiliates/shared/useCalendarDay";
import {
  buildTimeSeries,
  formatRangeCaption,
  resolveRange,
} from "@/lib/affiliates/time-series";
import type { Granularity } from "@/lib/affiliates/types";
import {
  PageHeader,
  StatCard,
  SectionTitle,
  formatCurrency,
} from "@/components/affiliates/shared/ui";

interface ChartOrder {
  createdAt: string;
  orderTotal: number;
  commission: number;
}

interface RankingRow {
  id: string;
  name: string;
  promoCode: string;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  orderCount: number;
}

interface OrderRow {
  id: string;
  orderTotal: number;
  commission: number;
  matchType: "code" | "recurring";
  status: "pending" | "paid";
  createdAt: string;
}

interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  totalCommissions: number;
  totalPending: number;
  totalAffiliates: number;
  activeAffiliates: number;
}

export default function AdminAnalyticsPage() {
  const [preset, setPreset] = useState<Preset>("90d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [chartOrders, setChartOrders] = useState<ChartOrder[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const hasLoadedOnce = useRef(false);
  const calendarDay = useCalendarDay();

  const load = useCallback(async (p: Preset, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/affiliates/admin/dashboard?range=${p}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRanking(data.ranking ?? []);
        setChartOrders(data.chartOrders ?? []);
        setRecentOrders(data.recentOrders ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const isInitial = !hasLoadedOnce.current;
    load(preset, isInitial).then(() => {
      hasLoadedOnce.current = true;
    });
  }, [preset, calendarDay, load]);

  const chartRange = useMemo(
    () => resolveRange(preset),
    [preset, calendarDay]
  );

  const series = useMemo(
    () => buildTimeSeries(chartOrders, chartRange),
    [chartOrders, chartRange]
  );

  const rangeCaption = useMemo(
    () => formatRangeCaption(chartRange, preset),
    [chartRange, preset]
  );

  const chartGranularity: Granularity = chartRange.granularity;

  const ordersData = useMemo(
    () =>
      series.map((s) => ({
        date: s.bucket,
        label: s.label,
        primary: s.orders,
      })),
    [series]
  );

  const revenueData = useMemo(
    () =>
      series.map((s) => ({
        date: s.bucket,
        label: s.label,
        primary: s.revenue,
      })),
    [series]
  );

  const commissionData = useMemo(
    () =>
      series.map((s) => ({
        date: s.bucket,
        label: s.label,
        primary: s.commission,
      })),
    [series]
  );

  const matchSplit = useMemo(() => {
    const code = recentOrders.filter((o) => o.matchType === "code").length;
    const recurring = recentOrders.filter((o) => o.matchType === "recurring").length;
    return [
      { label: "Direct (code)", value: code },
      { label: "Recurring", value: recurring },
    ];
  }, [recentOrders]);

  const statusSplit = useMemo(() => {
    const paid = recentOrders.filter((o) => o.status === "paid");
    const pending = recentOrders.filter((o) => o.status === "pending");
    return [
      {
        label: "Paid out",
        value: paid.reduce((s, o) => s + o.commission, 0),
        color: "#3F5D52", // muted sage — settled
      },
      {
        label: "Pending",
        value: pending.reduce((s, o) => s + o.commission, 0),
        color: "#C9A26A", // muted gold — outstanding
      },
    ];
  }, [recentOrders]);

  const aov = useMemo(() => {
    if (recentOrders.length === 0) return 0;
    return (
      recentOrders.reduce((s, o) => s + o.orderTotal, 0) / recentOrders.length
    );
  }, [recentOrders]);

  const conversion = useMemo(() => {
    const total = recentOrders.length;
    const code = recentOrders.filter((o) => o.matchType === "code").length;
    return total > 0 ? (code / total) * 100 : 0;
  }, [recentOrders]);

  const peakBucket = useMemo(() => {
    if (series.length === 0) return null;
    return series.reduce((a, b) => (a.revenue >= b.revenue ? a : b));
  }, [series]);

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Insights & trends"
        description="Slice performance across time, attribution and partners."
        actions={
          <div className="flex flex-col items-end gap-2">
            <RangePicker value={preset} onChange={setPreset} />
            <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
              {refreshing ? "Updating…" : rangeCaption}
            </span>
          </div>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={ShoppingBag}
          label="Avg order value"
          value={formatCurrency(aov)}
          hint={`${recentOrders.length} orders`}
        />
        <StatCard
          icon={TrendingUp}
          label="Code conversion"
          value={`${conversion.toFixed(0)}%`}
          hint="Orders attributed via code"
        />
        <StatCard
          icon={Users}
          label="Active affiliates"
          value={stats ? String(stats.activeAffiliates) : "—"}
          hint="Status: active"
          accent
        />
        <StatCard
          icon={Repeat}
          label="Peak period"
          value={peakBucket ? formatCurrency(peakBucket.revenue) : "—"}
          hint={peakBucket ? `On ${peakBucket.label}` : "—"}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Revenue" title="Sales over time" />
          {loading && chartOrders.length === 0 ? (
            <Skeleton />
          ) : (
            <AreaChart
              key={`revenue-${preset}-${calendarDay}`}
              data={revenueData}
              granularity={chartGranularity}
              primaryLabel="Revenue"
              formatValue={(n) => `$${Math.round(n).toLocaleString()}`}
            />
          )}
        </div>
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Earnings" title="Commission generated" />
          {loading && chartOrders.length === 0 ? (
            <Skeleton />
          ) : (
            <AreaChart
              key={`commission-${preset}-${calendarDay}`}
              data={commissionData}
              granularity={chartGranularity}
              primaryLabel="Commission"
              formatValue={(n) => `$${Math.round(n).toLocaleString()}`}
            />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Volume" title="Order count" />
          {loading && chartOrders.length === 0 ? (
            <Skeleton />
          ) : (
            <AreaChart
              key={`orders-${preset}-${calendarDay}`}
              data={ordersData}
              granularity={chartGranularity}
              primaryLabel="Orders"
              formatValue={(n) => Math.round(n).toString()}
            />
          )}
        </div>
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Mix" title="Attribution split" />
          <Donut
            slices={matchSplit}
            centerLabel={String(matchSplit.reduce((s, x) => s + x.value, 0))}
            centerSubLabel="Recent orders"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Liability" title="Commission status" />
          <Donut
            slices={statusSplit}
            centerLabel={formatCurrency(
              statusSplit.reduce((s, x) => s + x.value, 0)
            )}
            centerSubLabel="Total commission"
            formatValue={formatCurrency}
          />
        </div>
        <div className="glass-surface rounded-lg p-6 md:p-7">
          <SectionTitle eyebrow="Performance" title="Top affiliates" />
          {ranking.length === 0 ? (
            <Skeleton />
          ) : (
            <BarChart
              data={ranking.slice(0, 8).map((r) => ({
                label: r.name,
                value: r.totalSales,
                hint: `${r.orderCount} orders · ${formatCurrency(
                  r.totalCommission
                )} earned`,
              }))}
              formatValue={formatCurrency}
            />
          )}
        </div>
      </section>
    </>
  );
}

function Skeleton() {
  return (
    <div className="h-[260px] flex items-end gap-2 animate-pulse">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-[#242526]/8 rounded"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}
