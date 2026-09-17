"use client";
import { useLatestRead } from "@/lib/affiliates/use-latest-read";

/**
 * Admin — TikTok bonus monitoring. Every active affiliate with their video
 * count for the current 30-day cycle, streak position and the reward they're
 * playing for. The goal is fixed at 15 videos per cycle; the reward ladder
 * (amount per consecutive streak cycle, resetting on a missed cycle) is
 * editable here. Bonuses are paid automatically when each cycle closes.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Music2,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Trash2,
  Loader2,
  Users,
  Wallet,
  Pencil,
  Check,
  X,
  Plus,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  EmptyState,
  Pill,
} from "@/components/affiliates/shared/ui";

interface Submission {
  id: string;
  url: string;
  createdAt: string;
}

interface Entry {
  affiliateId: string;
  name: string;
  promoCode: string;
  count: number;
  hit: boolean;
  streakMonth: number;
  reward: number;
  submissions: Submission[];
}

interface Payload {
  period: "current" | "previous";
  cycleLabel: string;
  cycleDays: number;
  daysLeft: number;
  goal: number;
  ladder: number[];
  totalSubmissions: number;
  totalBonus: number;
  entries: Entry[];
}

type Period = "current" | "previous";

export default function AdminTikTokPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [period, setPeriod] = useState<Period>("current");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Ladder editing — values as strings so the inputs stay friendly.
  const [editingLadder, setEditingLadder] = useState(false);
  const [ladderDraft, setLadderDraft] = useState<string[]>([]);
  const [ladderSaving, setLadderSaving] = useState(false);
  const [ladderError, setLadderError] = useState<string | null>(null);

  const beginRead = useLatestRead();
  const [readError, setReadError] = useState<string | null>(null);
  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const request = beginRead();
    setReadError(null); setData(null);
    try {
      const res = await fetch(`/api/affiliates/admin/tiktok?period=${encodeURIComponent(p)}`, {
        credentials: "include", cache: "no-store", signal: request.signal,
      });
      if (!res.ok) throw new Error("Could not load data. Please retry.");
      if (res.ok) {
        const json = await res.json();
        if (!request.isCurrent()) return;
        if (json?.ok) setData(json as Payload);
      }
    } catch {
      if (request.isCurrent()) setReadError("Could not load data. Please retry.");
    } finally {
      if (!request.isCurrent()) return;
      setLoading(false);
    }
  }, [beginRead]);

  useEffect(() => {
    void load(period);
  }, [load, period]);

  const removeSubmission = useCallback(
    async (id: string) => {
      if (!window.confirm("Remove this submission? It comes off the affiliate's monthly count.")) {
        return;
      }
      setDeleting(id);
      try {
        const res = await fetch(`/api/affiliates/admin/tiktok/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) await load(period);
      } finally {
        setDeleting(null);
      }
    },
    [load, period]
  );

  function startEditingLadder() {
    setLadderDraft((data?.ladder ?? [100]).map((n) => String(n)));
    setLadderError(null);
    setEditingLadder(true);
  }

  async function saveLadder() {
    const amounts = ladderDraft.map((v) => Number(v));
    if (amounts.some((n) => !Number.isFinite(n) || n <= 0)) {
      setLadderError("Enter an amount above $0 for each streak cycle.");
      return;
    }
    setLadderSaving(true);
    setLadderError(null);
    try {
      const res = await fetch("/api/affiliates/admin/tiktok", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amounts }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setLadderError(json?.error ?? "Could not save — try again.");
        return;
      }
      setEditingLadder(false);
      await load(period);
    } catch {
      setLadderError("Could not save — try again.");
    } finally {
      setLadderSaving(false);
    }
  }

  const hitCount = data?.entries.filter((e) => e.hit).length ?? 0;

  return (
    <div>
      {readError && <p role="alert">{readError} <button type="button" onClick={() => load(period)}>Retry</button></p>}
      <PageHeader
        eyebrow="TikTok bonus"
        title="TikTok submissions"
        description={
          data
            ? `Cycle ${data.cycleLabel}${
                data.period === "current"
                  ? ` — resets in ${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"}`
                  : ""
              }. ${data.goal} videos per ${data.cycleDays}-day cycle earns the streak reward. Consecutive cycles climb the ladder below; a missed cycle resets the affiliate to step 1. Paid to payout balances automatically when the cycle closes.`
            : "Loading…"
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-[#242526]/5 border border-[#242526]/10 p-1">
              {(
                [
                  { key: "current", label: "This cycle" },
                  { key: "previous", label: "Last cycle" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPeriod(opt.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-sans uppercase tracking-[0.12em] transition-colors ${
                    period === opt.key
                      ? "bg-[#20282c] text-white"
                      : "text-[#64717a] hover:text-[#20282c]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load(period)}
              className="inline-flex items-center gap-2 rounded-full border border-[#242526]/15 px-4 py-2 text-xs font-sans uppercase tracking-[0.12em] text-[#20282c] hover:bg-[#242526]/5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard
          icon={Music2}
          label="Submissions"
          value={data ? String(data.totalSubmissions) : "—"}
          hint={data ? data.cycleLabel : undefined}
        />
        <StatCard
          icon={Users}
          label="Hit the goal"
          value={data ? String(hitCount) : "—"}
          hint={data ? `of ${data.entries.length} active affiliates` : undefined}
        />
        <StatCard
          icon={Wallet}
          label="Bonus earned so far"
          value={data ? `$${data.totalBonus}` : "—"}
          hint="Paid when the cycle closes"
          accent
        />
      </div>

      {/* Reward ladder */}
      <div className="glass-surface rounded-lg p-5 sm:p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              Reward ladder
            </p>
            <p className="text-sm text-[#64717a] mt-1 max-w-2xl leading-relaxed">
              What a streak pays, cycle by cycle. Affiliates only reach a
              higher step by hitting {data?.goal ?? 15} videos every{" "}
              {data?.cycleDays ?? 30}-day cycle in a row — one missed cycle
              resets them to step 1. Streaks longer than the ladder keep
              paying the last step.
            </p>
          </div>
          {editingLadder ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveLadder()}
                disabled={ladderSaving}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#20282c] text-white px-4 py-2 text-xs font-sans uppercase tracking-[0.12em] hover:bg-[#1E3A32] transition-colors disabled:opacity-50"
              >
                {ladderSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingLadder(false);
                  setLadderError(null);
                }}
                disabled={ladderSaving}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#242526]/15 px-4 py-2 text-xs font-sans uppercase tracking-[0.12em] text-[#20282c] hover:bg-[#242526]/5 transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditingLadder}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#242526]/15 px-4 py-2 text-xs font-sans uppercase tracking-[0.12em] text-[#20282c] hover:bg-[#242526]/5 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit rewards
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {(editingLadder ? ladderDraft : (data?.ladder ?? [100]).map(String)).map(
            (amount, i) => (
              <div
                key={i}
                className="rounded-lg bg-[#242526]/4 border border-[#242526]/8 px-4 py-3 min-w-[110px]"
              >
                <p className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
                  Cycle {i + 1}
                </p>
                {editingLadder ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-sans text-lg font-semibold">$</span>
                    <input
                      type="number"
                      min="1"
                      step="10"
                      value={amount}
                      onChange={(e) =>
                        setLadderDraft((d) => {
                          const next = [...d];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      className="w-20 bg-white/60 border border-[#20282c]/15 rounded-xl px-2 py-0.5 font-sans text-lg font-semibold focus:outline-none focus:border-[#20282c]/40"
                    />
                  </div>
                ) : (
                  <p className="font-sans text-lg font-semibold mt-0.5">
                    ${amount}
                  </p>
                )}
              </div>
            )
          )}
          {editingLadder && (
            <div className="flex flex-col justify-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setLadderDraft((d) =>
                    d.length >= 24 ? d : [...d, d[d.length - 1] ?? "100"]
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#242526]/15 px-3 py-1.5 text-[10px] font-sans uppercase tracking-[0.12em] text-[#20282c] hover:bg-[#242526]/5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add cycle
              </button>
              {ladderDraft.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLadderDraft((d) => d.slice(0, -1))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#242526]/15 px-3 py-1.5 text-[10px] font-sans uppercase tracking-[0.12em] text-[#64717a] hover:bg-[#242526]/5 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Remove last
                </button>
              )}
            </div>
          )}
        </div>
        {ladderError && (
          <p className="text-sm text-red-600 mt-3">{ladderError}</p>
        )}
      </div>

      {loading && !data ? (
        <div className="glass-surface rounded-lg p-10 text-center text-sm text-[#64717a]">
          <Loader2 className="h-5 w-5 animate-spin inline-block" />
        </div>
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="No active affiliates"
          description="Once affiliates start submitting TikTok links they'll show up here."
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                  <th className="px-5 py-3.5 font-medium">Affiliate</th>
                  <th className="px-5 py-3.5 font-medium">Code</th>
                  <th className="px-5 py-3.5 font-medium">Videos</th>
                  <th className="px-5 py-3.5 font-medium">Progress</th>
                  <th className="px-5 py-3.5 font-medium">Streak</th>
                  <th className="px-5 py-3.5 font-medium">Bonus</th>
                  <th className="px-5 py-3.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => {
                  const isOpen = expanded === entry.affiliateId;
                  const pct = Math.min(100, (entry.count / data.goal) * 100);
                  return (
                    <AffiliateRow
                      key={entry.affiliateId}
                      entry={entry}
                      goal={data.goal}
                      isOpen={isOpen}
                      pct={pct}
                      deleting={deleting}
                      onToggle={() =>
                        setExpanded(isOpen ? null : entry.affiliateId)
                      }
                      onDelete={removeSubmission}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AffiliateRow({
  entry,
  goal,
  isOpen,
  pct,
  deleting,
  onToggle,
  onDelete,
}: {
  entry: Entry;
  goal: number;
  isOpen: boolean;
  pct: number;
  deleting: string | null;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-[#242526]/6 transition-colors ${
          entry.count > 0 ? "cursor-pointer hover:bg-[#242526]/3" : ""
        }`}
        onClick={entry.count > 0 ? onToggle : undefined}
      >
        <td className="px-5 py-3.5 font-medium text-[#20282c] whitespace-nowrap">
          {entry.name}
        </td>
        <td className="px-5 py-3.5 font-sans text-xs text-[#64717a] whitespace-nowrap">
          {entry.promoCode || "—"}
        </td>
        <td className="px-5 py-3.5 font-sans font-semibold text-[#20282c] whitespace-nowrap">
          {entry.count}
          <span className="text-xs font-normal text-[#64717a]"> / {goal}</span>
        </td>
        <td className="px-5 py-3.5 w-[200px]">
          <div className="h-2 rounded-full bg-[#242526]/8 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                entry.hit
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : "bg-gradient-to-r from-[#20282c] to-[#3A5A4E]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap">
          {entry.streakMonth > 1 ? (
            <Pill tone="success">Cycle {entry.streakMonth}</Pill>
          ) : (
            <span className="text-xs text-[#64717a]">Cycle 1</span>
          )}
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap">
          {entry.hit ? (
            <Pill tone="dark">${entry.reward}</Pill>
          ) : (
            <span className="text-xs text-[#64717a]">
              playing for ${entry.reward}
            </span>
          )}
        </td>
        <td className="px-5 py-3.5 text-right">
          {entry.count > 0 && (
            <ChevronDown
              className={`h-4 w-4 inline-block text-[#64717a] transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-[#242526]/6 bg-[#242526]/2">
          <td colSpan={7} className="px-5 py-4">
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {entry.submissions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 text-sm min-w-0"
                >
                  <span className="shrink-0 font-sans text-xs text-[#64717a] w-20">
                    {new Date(s.createdAt).toLocaleDateString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[#20282c] underline underline-offset-2 hover:no-underline inline-flex items-center gap-1.5 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">
                      {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-[#64717a]" />
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    disabled={deleting === s.id}
                    className="ml-auto shrink-0 p-1.5 rounded-full text-[#64717a] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    aria-label="Remove submission"
                  >
                    {deleting === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
