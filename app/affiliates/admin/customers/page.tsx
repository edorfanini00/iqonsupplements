"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  X,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";
import {
  PageHeader,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface Customer {
  email: string;
  name: string;
  firstName: string;
  orderCount: number;
  totalSpent: number;
  currency: string;
  lastOrderDate: string;
}

interface SendResult {
  sent: number;
  failed: number;
  total: number;
  mode: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/customers", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
        setTruncated(Boolean(data.truncated));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.email].some((v) => v.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const visibleEmails = useMemo(
    () => visible.map((c) => c.email),
    [visible]
  );
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
      const allSelected = visibleEmails.every((e) => next.has(e));
      if (allSelected) {
        for (const e of visibleEmails) next.delete(e);
      } else {
        for (const e of visibleEmails) next.add(e);
      }
      return next;
    });
  }, [visibleEmails]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const send = useCallback(async () => {
    if (sending) return;
    setError(null);
    setResult(null);
    if (selected.size === 0) {
      setError("Select at least one customer.");
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
    if (
      !window.confirm(
        `Send this email to ${selected.size} ${
          selected.size === 1 ? "customer" : "customers"
        }?`
      )
    ) {
      return;
    }

    setSending(true);
    try {
      const recipients = customers
        .filter((c) => selected.has(c.email))
        .map((c) => ({ email: c.email, firstName: c.firstName }));
      const res = await fetch("/api/affiliates/admin/customers/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          recipients,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setError(data?.error?.message || data?.error || "Could not send emails.");
        return;
      }
      setResult({
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        total: data.total ?? 0,
        mode: data.mode ?? "resend",
      });
      setSubject("");
      setMessage("");
      setSelected(new Set());
    } catch {
      setError("Could not send emails. Please try again.");
    } finally {
      setSending(false);
    }
  }, [sending, selected, subject, message, customers]);

  return (
    <>
      <PageHeader
        eyebrow="Outreach"
        title="Customers"
        description="Everyone who's placed an order. Pick who to reach out to, write your message, and send — each customer gets their own personalized copy."
        actions={
          <span className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            <Users className="h-3.5 w-3.5" />
            {customers.length} {customers.length === 1 ? "customer" : "customers"}
          </span>
        }
      />

      {/* Composer */}
      <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          <Mail className="h-3.5 w-3.5" />
          Compose email
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
          <span className="inline-flex items-center gap-2 rounded-full bg-[#242526]/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            {selected.size} selected
          </span>
          {selected.size > 0 && (
            <button
              onClick={clearSelection}
              className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
            >
              Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={send}
            disabled={sending || selected.size === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send to {selected.size || ""}{" "}
                {selected.size === 1 ? "customer" : "customers"}
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
        {result && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {result.mode === "logged"
              ? `Prepared ${result.total} email${result.total === 1 ? "" : "s"} (email sending not configured — logged instead).`
              : `Sent ${result.sent} of ${result.total} email${
                  result.total === 1 ? "" : "s"
                }${result.failed ? ` · ${result.failed} failed` : ""}.`}
          </p>
        )}
      </div>

      {/* Search + select all */}
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
          <button
            onClick={toggleAllVisible}
            className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] hover:text-[#20282c] transition-colors"
          >
            {allVisibleSelected ? "Deselect" : "Select"} all
            {search ? " matching" : ""} ({visible.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={customers.length === 0 ? "No customers yet" : "No matches"}
          description={
            customers.length === 0
              ? "Customers appear here once they place a paid order."
              : "No customers match your search."
          }
        />
      ) : (
        <div className="glass-surface rounded-lg overflow-hidden">
          <ul className="divide-y divide-[#242526]/8">
            {visible.map((c) => {
              const isSelected = selected.has(c.email);
              return (
                <li key={c.email}>
                  <button
                    onClick={() => toggle(c.email)}
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
                        {c.name}
                      </span>
                      <span className="block text-xs text-[#64717a] truncate">
                        {c.email}
                      </span>
                    </span>
                    <span className="hidden sm:block text-right shrink-0">
                      <span className="block text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a]">
                        {c.orderCount} {c.orderCount === 1 ? "order" : "orders"} ·{" "}
                        {formatCurrency(c.totalSpent, c.currency)}
                      </span>
                      {c.lastOrderDate && (
                        <span className="block text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a]/70 mt-0.5">
                          Last {formatShortDate(c.lastOrderDate)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {truncated && (
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Showing the most recent customers — older orders may not be included.
        </p>
      )}
    </>
  );
}
