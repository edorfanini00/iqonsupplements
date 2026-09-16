"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  MessageSquare,
  Loader2,
  ArrowLeft,
  Mail,
  Plus,
  Search,
  X,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/affiliates/shared/ui";
import { usePollingInterval } from "@/components/affiliates/shared/usePollingInterval";

type SenderRole = "affiliate" | "admin";

interface Message {
  id: string;
  senderRole: SenderRole;
  body: string;
  createdAt: string;
}

interface Thread {
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  promoCode: string;
  lastMessage: string;
  lastSenderRole: SenderRole;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
}

interface ActiveAffiliate {
  id: string;
  name: string;
  email: string;
  promoCode: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  promoCode: string;
  status: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdminAffiliateMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const loadThreads = useCallback(
    async (showSpinner = false, withMeta = false) => {
      if (showSpinner) setLoadingThreads(true);
      try {
        const res = await fetch(
          `/api/affiliates/admin/affiliate-messages${withMeta ? "?meta=1" : ""}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setThreads(data.threads ?? []);
          // Roster is only returned on the metadata load; keep the cached copy
          // on plain polls.
          if (data.recipients) setRecipients(data.recipients);
        }
      } finally {
        if (showSpinner) setLoadingThreads(false);
      }
    },
    []
  );

  const threadsInit = useRef(false);
  const pollThreads = useCallback(() => {
    const first = !threadsInit.current;
    threadsInit.current = true;
    // Fetch the recipient roster only on the first load.
    loadThreads(first, first);
  }, [loadThreads]);

  // Visibility-gated: a backgrounded inbox tab issues no queries.
  usePollingInterval(pollThreads, 30000);

  const handleOpened = useCallback((affiliateId: string) => {
    // Clear unread badge locally once admin opens the thread.
    setThreads((prev) =>
      prev.map((t) =>
        t.affiliateId === affiliateId ? { ...t, unreadCount: 0 } : t
      )
    );
  }, []);

  const handleSent = useCallback((affiliateId: string, body: string) => {
    setThreads((prev) => {
      const exists = prev.some((t) => t.affiliateId === affiliateId);
      if (!exists) {
        // Refresh the list to pick up affiliate metadata for a brand-new thread.
        loadThreads(false);
        return prev;
      }
      return prev
        .map((t) =>
          t.affiliateId === affiliateId
            ? {
                ...t,
                lastMessage: body,
                lastSenderRole: "admin" as SenderRole,
                lastMessageAt: new Date().toISOString(),
                totalMessages: t.totalMessages + 1,
              }
            : t
        )
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime()
        );
    });
  }, [loadThreads]);

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Affiliate messages"
        description="Direct conversations with your affiliates. They get an email each time you reply."
        actions={
          <>
            <span className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              <Mail className="h-3.5 w-3.5" />
              {totalUnread} unread
            </span>
            <button
              onClick={() => setBroadcastOpen(true)}
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-[#242526]/5 transition-colors"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Message all
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#242526] text-white px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-[#20282c] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New message
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-16rem)] min-h-[460px]">
        {/* Thread list */}
        <div
          className={`glass-surface rounded-lg overflow-hidden flex-col ${
            activeId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="flex-1 overflow-y-auto p-2">
            {loadingThreads ? (
              <div className="h-full flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-[#64717a] animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-[#64717a] mb-3">No conversations yet.</p>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#242526] text-white px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-[#20282c] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Message an affiliate
                </button>
              </div>
            ) : (
              <ul className="space-y-1">
                {threads.map((t) => {
                  const active = t.affiliateId === activeId;
                  return (
                    <li key={t.affiliateId}>
                      <button
                        onClick={() => {
                          setActiveId(t.affiliateId);
                          handleOpened(t.affiliateId);
                        }}
                        className={`w-full text-left rounded-lg px-3 py-3 transition-colors ${
                          active ? "bg-[#242526] text-white" : "hover:bg-[#242526]/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate font-medium text-sm ${
                              active ? "text-white" : "text-[#20282c]"
                            }`}
                          >
                            {t.affiliateName}
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-sans ${
                              active ? "text-white/60" : "text-[#64717a]"
                            }`}
                          >
                            {formatRelative(t.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span
                            className={`truncate text-xs ${
                              active ? "text-white/70" : "text-[#64717a]"
                            }`}
                          >
                            {t.lastSenderRole === "admin" ? "You: " : ""}
                            {t.lastMessage}
                          </span>
                          {t.unreadCount > 0 && !active && (
                            <span className="shrink-0 text-[10px] font-sans px-1.5 py-0.5 rounded-full bg-[#242526] text-white leading-none">
                              {t.unreadCount}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={`${activeId ? "flex" : "hidden lg:flex"} min-h-0`}>
          {activeId ? (
            <Conversation
              key={activeId}
              affiliateId={activeId}
              onBack={() => setActiveId(null)}
              onSent={(body) => handleSent(activeId, body)}
            />
          ) : (
            <div className="glass-surface rounded-lg w-full flex flex-col items-center justify-center gap-5 p-6">
              <EmptyState
                icon={MessageSquare}
                title="Select a conversation"
                description="Choose an affiliate on the left, or start a new message."
              />
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#242526] text-white px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-[#20282c] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New message
              </button>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <RecipientPicker
          recipients={recipients}
          onClose={() => setPickerOpen(false)}
          onSelect={(id) => {
            setPickerOpen(false);
            setActiveId(id);
            handleOpened(id);
          }}
        />
      )}

      {broadcastOpen && (
        <BroadcastComposer
          recipientCount={recipients.filter((r) => r.status === "active").length}
          onClose={() => setBroadcastOpen(false)}
          onSent={() => loadThreads(false)}
        />
      )}
    </>
  );
}

function BroadcastComposer({
  recipientCount,
  onClose,
  onSent,
}: {
  recipientCount: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recipients: number; emailed: number } | null>(
    null
  );

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/admin/affiliate-messages/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({
          recipients: data.recipients ?? 0,
          emailed: data.emailed ?? 0,
        });
        onSent();
      } else {
        setError(data.error ?? "Couldn't send. Try again.");
      }
    } catch {
      setError("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#20282c]/50 backdrop-blur-sm"
        onClick={sending ? undefined : onClose}
      />
      <div className="relative glass-surface-strong rounded-lg w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <Megaphone className="h-4 w-4 text-[#64717a]" />
            <h3 className="text-xl font-medium tracking-tight">Message all affiliates</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-[#242526]/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="px-6 pb-6 pt-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-5 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#20282c]">
                  Broadcast sent to {result.recipients} affiliate
                  {result.recipients === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-[#64717a] mt-1">
                  Delivered to every thread · {result.emailed} email notification
                  {result.emailed === 1 ? "" : "s"} sent.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full inline-flex items-center justify-center rounded-xl bg-[#242526] text-white px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-[#20282c] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <p className="text-sm text-[#64717a] mb-4">
              This lands in every active affiliate&apos;s inbox
              {recipientCount > 0 ? ` (${recipientCount})` : ""} and each one gets
              an email notification.
            </p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Write your announcement…"
              className="w-full resize-none rounded-lg bg-white/60 border border-[#242526]/10 px-4 py-3 text-sm text-[#20282c] placeholder:text-[#64717a]/70 focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
            />
            {error && <p className="text-xs text-[#b3261e] mt-2">{error}</p>}
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={sending}
                className="inline-flex items-center rounded-xl px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#242526] text-white px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending to all…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send to all
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipientPicker({
  recipients,
  onClose,
  onSelect,
}: {
  recipients: Recipient[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.promoCode.toLowerCase().includes(q)
    );
  }, [recipients, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#20282c]/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-surface-strong rounded-lg w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-xl font-medium tracking-tight">New message</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-[#242526]/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64717a]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search affiliates…"
              className="w-full rounded-lg bg-white/60 border border-[#242526]/10 pl-10 pr-4 py-3 text-sm text-[#20282c] placeholder:text-[#64717a]/70 focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#64717a]">
              No affiliates found.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    className="w-full text-left rounded-lg px-3 py-3 hover:bg-[#242526]/5 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 shrink-0 rounded-full bg-[#242526] text-white flex items-center justify-center text-xs font-sans">
                      {r.name.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#20282c] truncate">
                        {r.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-[#64717a] truncate">
                        {r.email}
                        {r.promoCode ? ` · ${r.promoCode}` : ""}
                      </p>
                    </div>
                    {r.status !== "active" && (
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a]">
                        {r.status}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Conversation({
  affiliateId,
  onBack,
  onSent,
}: {
  affiliateId: string;
  onBack: () => void;
  onSent: (body: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [affiliate, setAffiliate] = useState<ActiveAffiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const load = useCallback(
    async (showSpinner = false, withMeta = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(
          `/api/affiliates/admin/affiliate-messages/${affiliateId}${
            withMeta ? "?meta=1" : ""
          }`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
          // Header info comes only with the metadata load; keep it on polls.
          if (data.affiliate) setAffiliate(data.affiliate);
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [affiliateId]
  );

  const convoInit = useRef(false);
  const poll = useCallback(() => {
    const first = !convoInit.current;
    convoInit.current = true;
    // Fetch the affiliate header only on the first load.
    load(first, first).then(() => {
      if (first) scrollToBottom();
    });
  }, [load, scrollToBottom]);

  // Visibility-gated: a backgrounded conversation issues no queries.
  usePollingInterval(poll, 30000);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      senderRole: "admin",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await fetch(
        `/api/affiliates/admin/affiliate-messages/${affiliateId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ body }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        onSent(body);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
        setError(data.error ?? "Couldn't send. Try again.");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setError("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="glass-surface rounded-lg w-full flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-[#242526]/8">
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 rounded-full hover:bg-[#242526]/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#20282c] truncate">
            {affiliate?.name ?? "Affiliate"}
          </p>
          <p className="text-xs text-[#64717a] truncate">
            {affiliate?.email}
            {affiliate?.promoCode ? ` · ${affiliate.promoCode}` : ""}
          </p>
        </div>
        {affiliate?.email && (
          <a
            href={`mailto:${affiliate.email}`}
            className="p-2 rounded-full hover:bg-[#242526]/5 text-[#64717a]"
            title="Email instead"
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-[#64717a] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Start the conversation below."
            />
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.senderRole === "admin"} />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#242526]/8 p-3 sm:p-4">
        {error && <p className="text-xs text-[#b3261e] mb-2 px-1">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Write a reply…"
            className="flex-1 resize-none max-h-40 rounded-lg bg-white/60 border border-[#242526]/10 px-4 py-3 text-sm text-[#20282c] placeholder:text-[#64717a]/70 focus:outline-none focus:ring-2 focus:ring-[#242526]/15"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#242526] text-white h-11 px-5 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            mine
              ? "bg-[#242526] text-white rounded-br-md"
              : "bg-white/70 text-[#20282c] border border-[#242526]/8 rounded-bl-md"
          }`}
        >
          {message.body}
        </div>
        <span className="text-[10px] font-sans text-[#64717a]/70 px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
