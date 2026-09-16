"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/affiliates/shared/ui";
import { usePollingInterval } from "@/components/affiliates/shared/usePollingInterval";

type SenderRole = "affiliate" | "admin";

interface Message {
  id: string;
  senderRole: SenderRole;
  body: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AffiliateMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
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
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch("/api/affiliates/messages", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    []
  );

  const didInit = useRef(false);
  const poll = useCallback(() => {
    const first = !didInit.current;
    didInit.current = true;
    load(first).then(() => {
      if (first) scrollToBottom();
    });
  }, [load, scrollToBottom]);

  // Visibility-gated: a backgrounded chat tab issues no queries.
  usePollingInterval(poll, 30000);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);

    // Optimistic append.
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      senderRole: "affiliate",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await fetch("/api/affiliates/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
        setError(data.error ?? "Couldn't send your message. Try again.");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setError("Couldn't send your message. Try again.");
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
    <>
      <PageHeader
        eyebrow="Support"
        title="Messages"
        description="Chat directly with the IQON team. We'll email you when they reply."
      />

      <div className="glass-surface rounded-lg flex flex-col h-[calc(100vh-16rem)] min-h-[420px] overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4"
        >
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-[#64717a] animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="No messages yet"
                description="Send a message below and the IQON team will get back to you."
              />
            </div>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} message={m} mine={m.senderRole === "affiliate"} />
            ))
          )}
        </div>

        <div className="border-t border-[#242526]/8 p-3 sm:p-4">
          {error && (
            <p className="text-xs text-[#b3261e] mb-2 px-1">{error}</p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Write a message…"
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
    </>
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!mine && (
          <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] px-1">
            IQON Team
          </span>
        )}
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
