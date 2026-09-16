"use client";

/**
 * Email marketing tab (admin Contact inbox).
 *
 * Audience = people who created an account but never ordered. The admin picks
 * recipients (individually, in batches, or all), writes a subject + message,
 * sets a per-day batch size, and starts a drip campaign: every day the cron
 * emails the next batch until everyone selected has been reached.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Megaphone,
  Pause,
  Play,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { EmptyState, Pill, formatShortDate } from "@/components/affiliates/shared/ui";

interface Prospect {
  email: string;
  name: string;
  firstName: string;
  signedUpAt: string;
}

interface Campaign {
  id: string;
  subject: string;
  message: string;
  dailyLimit: number;
  status: "active" | "paused" | "completed";
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
  lastSentAt: string | null;
}

const BATCH_SIZES = [25, 50, 100];

export default function EmailMarketingTab() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loadingAudience, setLoadingAudience] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [dailyLimit, setDailyLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [busyCampaign, setBusyCampaign] = useState<string | null>(null);

  const loadAudience = useCallback(async () => {
    setLoadingAudience(true);
    try {
      const res = await fetch("/api/affiliates/admin/marketing/audience", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProspects(data.prospects ?? []);
        setTruncated(Boolean(data.truncated));
      }
    } finally {
      setLoadingAudience(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch("/api/affiliates/admin/marketing/campaigns", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
      }
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    loadAudience();
    loadCampaigns();
  }, [loadAudience, loadCampaigns]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) =>
      [p.name, p.email].some((v) => v.toLowerCase().includes(q))
    );
  }, [prospects, search]);

  const visibleEmails = useMemo(() => visible.map((p) => p.email), [visible]);
  const allVisibleSelected =
    visibleEmails.length > 0 && visibleEmails.every((e) => selected.has(e));

  const toggle = useCallback((email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSel = visibleEmails.every((e) => next.has(e));
      if (allSel) for (const e of visibleEmails) next.delete(e);
      else for (const e of visibleEmails) next.add(e);
      return next;
    });
  }, [visibleEmails]);

  /** Add the next `n` not-yet-selected visible prospects to the selection. */
  const selectNextBatch = useCallback(
    (n: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        let added = 0;
        for (const email of visibleEmails) {
          if (added >= n) break;
          if (!next.has(email)) {
            next.add(email);
            added += 1;
          }
        }
        return next;
      });
    },
    [visibleEmails]
  );

  const startCampaign = useCallback(async () => {
    if (creating) return;
    setError(null);
    setNotice(null);
    if (selected.size === 0) {
      setError("Select at least one person.");
      return;
    }
    if (!subject.trim()) {
      setError("Add a subject.");
      return;
    }
    if (!message.trim()) {
      setError("Write a message.");
      return;
    }
    const days = Math.ceil(selected.size / Math.max(1, dailyLimit));
    if (
      !window.confirm(
        `Start this campaign for ${selected.size} ${
          selected.size === 1 ? "person" : "people"
        }? About ${dailyLimit} will be emailed per day (~${days} day${
          days === 1 ? "" : "s"
        }), starting with today's cron run.`
      )
    ) {
      return;
    }

    setCreating(true);
    try {
      const recipients = prospects
        .filter((p) => selected.has(p.email))
        .map((p) => ({ email: p.email, firstName: p.firstName }));
      const res = await fetch("/api/affiliates/admin/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          dailyLimit,
          recipients,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setError(data?.error?.message || data?.error || "Could not start the campaign.");
        return;
      }
      setNotice(
        `Campaign started — ${selected.size} queued, ${dailyLimit} per day.`
      );
      setSubject("");
      setMessage("");
      setSelected(new Set());
      await loadCampaigns();
    } catch {
      setError("Could not start the campaign. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [creating, selected, subject, message, dailyLimit, prospects, loadCampaigns]);

  const runNow = useCallback(
    async (id: string) => {
      setBusyCampaign(id);
      setError(null);
      try {
        const res = await fetch(
          `/api/affiliates/admin/marketing/campaigns/${id}/run`,
          { method: "POST", credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          setError(data?.error?.message || "Could not send the batch.");
          return;
        }
        const r = data.result ?? {};
        setNotice(
          r.sent > 0
            ? `Sent ${r.sent} email${r.sent === 1 ? "" : "s"}${
                r.completed ? " — campaign complete." : "."
              }`
            : "Nothing left to send."
        );
        await loadCampaigns();
      } finally {
        setBusyCampaign(null);
      }
    },
    [loadCampaigns]
  );

  const setStatus = useCallback(
    async (id: string, status: "active" | "paused") => {
      setBusyCampaign(id);
      try {
        await fetch(`/api/affiliates/admin/marketing/campaigns/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        });
        await loadCampaigns();
      } finally {
        setBusyCampaign(null);
      }
    },
    [loadCampaigns]
  );

  const remove = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "Delete this campaign? People still in the queue will not be emailed."
        )
      ) {
        return;
      }
      setBusyCampaign(id);
      try {
        await fetch(`/api/affiliates/admin/marketing/campaigns/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        await loadCampaigns();
      } finally {
        setBusyCampaign(null);
      }
    },
    [loadCampaigns]
  );

  return (
    <>
      {/* Active campaigns */}
      <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          <Megaphone className="h-3.5 w-3.5" />
          Campaigns
        </div>
        {loadingCampaigns ? (
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] py-4 text-center">
            Loading…
          </p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-[#64717a]">
            No campaigns yet. Pick recipients below and start one — the sequence
            emails a batch every day automatically.
          </p>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => {
              const expanded = expandedCampaign === c.id;
              const busy = busyCampaign === c.id;
              const progress = c.total > 0 ? (c.sent + c.failed) / c.total : 0;
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-[#242526]/10 bg-white/60 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#20282c] truncate">
                          {c.subject}
                        </span>
                        {c.status === "active" && <Pill tone="success">Active</Pill>}
                        {c.status === "paused" && <Pill tone="warn">Paused</Pill>}
                        {c.status === "completed" && <Pill tone="neutral">Completed</Pill>}
                      </div>
                      <p className="text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a] mt-1.5">
                        {c.sent} sent · {c.queued} queued
                        {c.failed > 0 ? ` · ${c.failed} failed` : ""} · {c.dailyLimit}
                        /day · started {formatShortDate(c.createdAt)}
                        {c.lastSentAt ? ` · last send ${formatShortDate(c.lastSentAt)}` : ""}
                      </p>
                      <div className="mt-2.5 h-1.5 rounded-full bg-[#242526]/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#242526] transition-all"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedCampaign(expanded ? null : c.id)}
                      className="p-1.5 rounded-full hover:bg-[#242526]/5 text-[#64717a]"
                      aria-label={expanded ? "Collapse" : "Expand"}
                    >
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-[#242526]/8">
                      <p className="text-sm text-[#20282c]/80 whitespace-pre-wrap mb-4">
                        {c.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {c.status !== "completed" && c.queued > 0 && (
                          <button
                            onClick={() => runNow(c.id)}
                            disabled={busy || c.status === "paused"}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Send next {Math.min(c.dailyLimit, c.queued)} now
                          </button>
                        )}
                        {c.status === "active" && (
                          <button
                            onClick={() => setStatus(c.id, "paused")}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans glass-surface text-[#64717a] hover:text-[#20282c] transition-colors disabled:opacity-40"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            Pause
                          </button>
                        )}
                        {c.status === "paused" && (
                          <button
                            onClick={() => setStatus(c.id, "active")}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans glass-surface text-[#64717a] hover:text-[#20282c] transition-colors disabled:opacity-40"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Resume
                          </button>
                        )}
                        <button
                          onClick={() => remove(c.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-red-600/80 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          <Mail className="h-3.5 w-3.5" />
          New campaign
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Subject"
          className="w-full bg-transparent text-lg font-medium text-[#20282c] placeholder:text-[#64717a]/60 outline-none mb-3"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={20000}
          placeholder={
            "Write your message…\n\nTip: it opens with “Hi {first name},” automatically, so you can start with the body."
          }
          className="w-full rounded-lg border border-[#242526]/12 bg-white/70 p-4 text-sm leading-relaxed text-[#20282c] outline-none focus:border-[#242526]/40 resize-y"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-full bg-[#242526]/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            Per day
            <input
              type="number"
              min={1}
              max={500}
              value={dailyLimit}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setDailyLimit(Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : 25);
              }}
              className="w-14 bg-transparent text-[#20282c] outline-none text-center border-b border-[#242526]/20 focus:border-[#242526]/50"
            />
          </label>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#242526]/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            {selected.size} selected
            {selected.size > 0 &&
              ` · ~${Math.ceil(selected.size / Math.max(1, dailyLimit))} day${
                Math.ceil(selected.size / Math.max(1, dailyLimit)) === 1 ? "" : "s"
              }`}
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
            >
              Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={startCampaign}
            disabled={creating || selected.size === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Start campaign
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </p>
        )}
      </div>

      {/* Audience picker */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 w-full sm:w-auto">
          <Search className="h-3.5 w-3.5 text-[#64717a]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="bg-transparent text-sm text-[#20282c] placeholder:text-[#64717a]/60 outline-none w-full sm:w-64"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="p-1 rounded-full hover:bg-[#242526]/5"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5 text-[#64717a]" />
            </button>
          )}
        </div>
        {visible.length > 0 && (
          <>
            <button
              onClick={toggleAllVisible}
              className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
            >
              {allVisibleSelected ? "Deselect" : "Select"} all
              {search ? " matching" : ""} ({visible.length})
            </button>
            {BATCH_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => selectNextBatch(n)}
                className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
              >
                +{n}
              </button>
            ))}
          </>
        )}
      </div>

      {loadingAudience ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={prospects.length === 0 ? "No prospects right now" : "No matches"}
          description={
            prospects.length === 0
              ? "Everyone who signed up has already ordered (or is an affiliate)."
              : "No sign-ups match your search."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <ul className="divide-y divide-[#242526]/8">
            {visible.map((p) => {
              const isSelected = selected.has(p.email);
              return (
                <li key={p.email}>
                  <button
                    onClick={() => toggle(p.email)}
                    className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-[#242526]/[0.03] transition-colors"
                  >
                    <span
                      className={`shrink-0 flex items-center justify-center h-5 w-5 rounded-md border transition-colors ${
                        isSelected
                          ? "bg-[#242526] border-[#242526] text-white"
                          : "border-[#242526]/25 bg-white/70"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-[#20282c] truncate">
                        {p.name}
                      </span>
                      <span className="block text-xs text-[#64717a] truncate">
                        {p.email}
                      </span>
                    </span>
                    {p.signedUpAt && (
                      <span className="hidden sm:block shrink-0 text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a]">
                        Signed up {formatShortDate(p.signedUpAt)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {truncated && (
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Showing the most recent sign-ups — older accounts may not be included.
        </p>
      )}
    </>
  );
}
