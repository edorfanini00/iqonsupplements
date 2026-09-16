"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trophy, RefreshCw, Pencil, Check, X, Loader2 } from "lucide-react";
import {
  PageHeader,
  EmptyState,
  formatCurrency,
} from "@/components/affiliates/shared/ui";

interface Entry {
  affiliateId: string;
  name: string;
  promoCode: string;
  salesVolume: number;
  orders: number;
  rank: number;
  qualified: boolean;
  prize: number | null;
}

interface RankingsPayload {
  cycleKey: string;
  currentCycleKey: string;
  source: "live" | "snapshot" | "reconstructed";
  settledAt: string | null;
  availableCycles: { key: string; start: string; end: string }[];
  periodStart: string;
  periodEnd: string;
  resetDay: number;
  prizes: number[];
  qualifyingMinimum: number;
  entries: Entry[];
}

const MEDAL_STYLES: Record<number, { bg: string; label: string }> = {
  1: { bg: "bg-gradient-to-r from-[#D4A937] to-[#F0CF6E] text-[#3C2E05]", label: "Gold" },
  2: { bg: "bg-gradient-to-r from-[#9FA6AD] to-[#D5DADF] text-[#33383D]", label: "Silver" },
  3: { bg: "bg-gradient-to-r from-[#A96F3D] to-[#D19A66] text-[#3B2410]", label: "Bronze" },
};

function formatPeriod(startIso: string, endIso: string): string {
  const opts = {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  } as const;
  const start = new Date(startIso).toLocaleDateString("en-US", opts);
  // The period is exclusive of the next reset day, so show the day before.
  const endDate = new Date(new Date(endIso).getTime() - 1);
  const end = endDate.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${start} – ${end}`;
}

export default function AdminRankingsPage() {
  const [data, setData] = useState<RankingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  // Prize editing — values as strings so the inputs stay friendly.
  const [editingPrizes, setEditingPrizes] = useState(false);
  const [prizeDraft, setPrizeDraft] = useState<string[]>(["", "", ""]);
  const [prizeSaving, setPrizeSaving] = useState(false);
  const [prizeError, setPrizeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/affiliates/admin/rankings${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`, {
        credentials: "include", cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load rankings. Please retry.");
      const payload = await res.json();
      if (id === requestId.current) setData(payload);
    } catch {
      if (id === requestId.current) { setData(null); setLoadError("Could not load rankings. Please retry."); }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [cycle]);

  useEffect(() => {
    load();
  }, [load]);

  function startEditingPrizes() {
    const current = data?.prizes ?? [500, 100, 50];
    setPrizeDraft(current.map((p) => String(p)));
    setPrizeError(null);
    setEditingPrizes(true);
  }

  async function savePrizes() {
    const prizes = prizeDraft.map((p) => Number(p));
    if (prizes.some((p) => !Number.isFinite(p) || p < 0)) {
      setPrizeError("Enter a valid amount (0 or more) for each spot.");
      return;
    }
    if (prizes[0] < prizes[1] || prizes[1] < prizes[2]) {
      setPrizeError("Prizes must not increase down the ranks (#1 ≥ #2 ≥ #3).");
      return;
    }
    setPrizeSaving(true);
    setPrizeError(null);
    try {
      const res = await fetch("/api/affiliates/admin/rankings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prizes }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPrizeError(
          payload?.error?.message || payload?.error || "Failed to save prizes"
        );
        return;
      }
      setEditingPrizes(false);
      await load();
    } catch {
      setPrizeError("Failed to save prizes");
    } finally {
      setPrizeSaving(false);
    }
  }

  const showingResults = !loading && !!data && (!cycle || cycle === data.cycleKey);
  const entries = showingResults ? data.entries : [];
  const withSales = entries.filter((e) => e.salesVolume > 0);
  const withoutSales = entries.filter((e) => e.salesVolume <= 0);

  return (
    <>
      <PageHeader
        eyebrow="Affiliate of the month"
        title="Monthly rankings"
        description={
          showingResults
            ? `Sales volume from attributed orders · ${formatPeriod(
                data.periodStart,
                data.periodEnd
              )} · ${(() => {
                if (data.source !== "live") return "closed cycle";
                const d = Math.max(
                  0,
                  Math.ceil(
                    (new Date(data.periodEnd).getTime() - Date.now()) /
                      86_400_000
                  )
                );
                return d <= 1 ? "last day" : `${d} days left`;
              })()} · resets on the ${data.resetDay}th, everyone starts from zero. Prizes require a $${data.qualifyingMinimum.toLocaleString()} sales minimum.`
            : "Sales volume from attributed orders. Resets on the 13th of each month. Prizes require a $1,500 sales minimum."
        }
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="ranking-cycle" className="text-sm font-medium">Contest cycle</label>
        <select id="ranking-cycle" value={cycle || data?.currentCycleKey || ""}
          onChange={e => { setLoading(true); setCycle(e.target.value); setEditingPrizes(false); }}
          className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm">
          {(data?.availableCycles ?? []).map(c => <option key={c.key} value={c.key}>
            {formatPeriod(c.start, c.end)}{c.key === data?.currentCycleKey ? " · Current" : ""}
          </option>)}
        </select>
        {loading && <span className="text-sm" role="status">Loading…</span>}
        {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
        {!loading && data && <p className="w-full text-sm text-[#64717a]">
          {data.source === "snapshot"
            ? "Finalized snapshot — rankings and prizes are locked. Qualified prizes were added to payout balances; payment is still recorded manually."
            : data.source === "reconstructed"
              ? "Reconstructed history — calculated from currently available orders and affiliate status, not a finalized result. This view does not award prizes."
              : "Live rankings — prizes are not earned until the cycle closes and settlement completes."}
        </p>}
      </div>

      {showingResults && <>
      {/* Prize strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        {[1, 2, 3].map((rank) => (
          <div
            key={rank}
            className={`rounded-lg px-6 py-5 ${MEDAL_STYLES[rank].bg} shadow-sm`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans opacity-70">
              {MEDAL_STYLES[rank].label} · #{rank}
            </p>
            {editingPrizes ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="font-sans text-2xl font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={prizeDraft[rank - 1]}
                  onChange={(e) =>
                    setPrizeDraft((d) => {
                      const next = [...d];
                      next[rank - 1] = e.target.value;
                      return next;
                    })
                  }
                  className="w-full max-w-[120px] bg-white/40 border border-black/15 rounded-xl px-3 py-1 font-sans text-2xl font-semibold focus:outline-none focus:border-black/40"
                />
              </div>
            ) : (
              <p className="font-sans text-2xl font-semibold mt-1">
                ${data?.prizes?.[rank - 1] ?? [500, 100, 50][rank - 1]}
              </p>
            )}
            <p className="text-xs mt-1 opacity-80">
              {(() => {
                const holder = entries.find(
                  (e) => e.rank === rank && e.salesVolume > 0
                );
                if (!holder) return data?.source === "live" ? "Up for grabs" : "No qualifying winner";
                return holder.qualified
                  ? holder.name
                  : `${holder.name} · below $${(
                      data?.qualifyingMinimum ?? 1500
                    ).toLocaleString()} min`;
              })()}
            </p>
          </div>
        ))}
      </div>

      {/* Prize controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {editingPrizes ? (
          <>
            <button
              onClick={savePrizes}
              disabled={prizeSaving}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
            >
              {prizeSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save prizes
            </button>
            <button
              onClick={() => {
                setEditingPrizes(false);
                setPrizeError(null);
              }}
              disabled={prizeSaving}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <span className="text-xs text-[#64717a]">
              Applies from the current cycle onward — affiliates see the new
              amounts right away. Past cycles keep the prizes they ran with.
            </span>
            {prizeError && (
              <span className="text-xs text-red-600">{prizeError}</span>
            )}
          </>
        ) : (
          <button
            onClick={startEditingPrizes}
            disabled={loading || !data || data.source !== "live"}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit prizes
          </button>
        )}
      </div>

      </>}
      <section className="glass-surface rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64717a]">Loading…</div>
        ) : withSales.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No attributed sales yet this cycle"
            description="Rankings fill up as orders come in with affiliate codes. Everyone starts from zero each cycle."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-[#242526]/8 text-left">
                  <th className="py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium">Rank</th>
                  <th className="py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium">Affiliate</th>
                  <th className="py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium">Code</th>
                  <th className="py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium text-right">Orders</th>
                  <th className="py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium text-right">Sales volume</th>
                  <th className="py-3.5 px-5 font-sans text-[10px] uppercase tracking-[0.18em] text-[#64717a] font-medium text-right">Prize</th>
                </tr>
              </thead>
              <tbody>
                {withSales.map((e) => (
                  <tr
                    key={e.affiliateId}
                    className="border-b border-[#242526]/5 last:border-0 hover:bg-[#242526]/2"
                  >
                    <td className="py-3.5 px-5">
                      {e.rank <= 3 ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-sans font-semibold ${MEDAL_STYLES[e.rank].bg}`}
                        >
                          <Trophy className="h-3 w-3" />#{e.rank}
                        </span>
                      ) : (
                        <span className="font-sans text-[#64717a]">#{e.rank}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-medium">{e.name}</td>
                    <td className="py-3.5 px-5 font-sans text-xs">{e.promoCode}</td>
                    <td className="py-3.5 px-5 text-right font-sans">{e.orders}</td>
                    <td className="py-3.5 px-5 text-right font-sans font-medium">
                      {formatCurrency(e.salesVolume)}
                    </td>
                    <td className="py-3.5 px-5 text-right font-sans">
                      {e.prize ? `$${e.prize}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {withoutSales.length > 0 && (
        <p className="text-xs text-[#64717a] mt-4">
          {withoutSales.length} active affiliate
          {withoutSales.length === 1 ? "" : "s"} with no attributed sales yet
          this cycle.
        </p>
      )}
    </>
  );
}
