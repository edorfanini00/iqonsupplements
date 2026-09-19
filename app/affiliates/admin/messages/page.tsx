"use client";
import {nonproviderMutationFetch} from "@/lib/affiliates/nonprovider-mutation-fetch";
import { nativeMutationFetch } from "@/lib/affiliates/native-mutation-fetch";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Mail,
  MailOpen,
  Inbox,
  X,
  Archive,
  Trash2,
  Reply,
  RotateCcw,
  Send,
  Check,
  Loader2,
  Paperclip,
  FileText,
  Megaphone,
} from "lucide-react";
import {
  PageHeader,
  Pill,
  EmptyState,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import EmailMarketingTab from "@/components/affiliates/admin/EmailMarketingTab";

type MessageStatus = "new" | "read" | "replied" | "archived";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: MessageStatus;
  readAt: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  order: "Order inquiry",
  coa: "COA request",
  general: "General inquiry",
  other: "Other",
};

function subjectLabel(subject: string | null): string {
  if (!subject) return "No subject";
  return SUBJECT_LABELS[subject] ?? subject;
}

type Filter = "all" | "new" | "archived";

interface PendingAttachment {
  filename: string;
  contentType: string;
  /** Base64 file content (no data-URL prefix), as the reply API expects. */
  content: string;
  size: number;
  /** Object URL for image thumbnails; null for non-images. */
  previewUrl: string | null;
}

const MAX_REPLY_ATTACHMENTS = 5;
const MAX_REPLY_ATTACHMENT_BYTES = 3 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type Section = "inbox" | "marketing";

export default function AdminMessagesPage() {
  const [section, setSection] = useState<Section>("inbox");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<ContactMessage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/messages", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = useCallback(
    async (id: string, status: MessageStatus) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, status, readAt: status === "new" ? null : new Date().toISOString() }
            : m
        )
      );
      setActive((cur) => (cur && cur.id === id ? { ...cur, status } : cur));
      await fetch(`/api/affiliates/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      }).catch(() => {});
    },
    []
  );

  const removeMessage = useCallback(async (id: string) => {
    if (!window.confirm("Delete this message permanently?")) return;
    try {
      const response = await nonproviderMutationFetch(`/api/affiliates/admin/messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setActive((cur) => (cur && cur.id === id ? null : cur));
    } catch {
      // Keep the original control and operation UUID for an unchanged retry.
    }
  }, []);

  function openMessage(m: ContactMessage) {
    setActive(m);
    if (m.status === "new") updateStatus(m.id, "read");
  }

  const unreadCount = useMemo(
    () => messages.filter((m) => m.status === "new").length,
    [messages]
  );

  const visible = useMemo(() => {
    if (filter === "new") return messages.filter((m) => m.status === "new");
    if (filter === "archived")
      return messages.filter((m) => m.status === "archived");
    return messages.filter((m) => m.status !== "archived");
  }, [messages, filter]);

  const filters: { key: Filter; label: string; count: number }[] = [
    {
      key: "all",
      label: "Inbox",
      count: messages.filter((m) => m.status !== "archived").length,
    },
    { key: "new", label: "Unread", count: unreadCount },
    {
      key: "archived",
      label: "Archived",
      count: messages.filter((m) => m.status === "archived").length,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title={section === "inbox" ? "Contact messages" : "Email marketing"}
        description={
          section === "inbox"
            ? "Everything submitted through the public Contact form lands here."
            : "Reach people who signed up but never ordered. Start a drip campaign and a batch goes out every day."
        }
        actions={
          section === "inbox" ? (
            <span className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
              <Mail className="h-3.5 w-3.5" />
              {unreadCount} unread
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {(
          [
            { key: "inbox" as Section, label: "Inbox", icon: Inbox },
            { key: "marketing" as Section, label: "Email marketing", icon: Megaphone },
          ]
        ).map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
              section === s.key
                ? "bg-[#242526] text-white"
                : "glass-surface text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {section === "marketing" && <EmailMarketingTab />}

      {section === "inbox" && (
        <>
      <div className="flex flex-wrap gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
              filter === f.key
                ? "bg-[#242526] text-white"
                : "glass-surface text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            {f.label}
            <span
              className={`px-1.5 py-0.5 rounded-full leading-none ${
                filter === f.key ? "bg-white/15 text-white" : "bg-[#242526]/8 text-[#64717a]"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing here"
          description={
            filter === "archived"
              ? "No archived messages."
              : "No messages yet. Submissions from the Contact page will appear here."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((m) => {
            const unread = m.status === "new";
            return (
              <li key={m.id}>
                <button
                  onClick={() => openMessage(m)}
                  className="w-full text-left glass-surface rounded-lg p-5 sm:p-6 flex items-start gap-4 hover:bg-[#242526]/[0.03] transition-colors"
                >
                  <div
                    className={`mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                      unread ? "bg-[#242526] text-white" : "bg-[#242526]/6 text-[#64717a]"
                    }`}
                  >
                    {unread ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MailOpen className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3
                        className={`truncate ${
                          unread ? "font-semibold text-[#20282c]" : "font-medium text-[#20282c]"
                        }`}
                      >
                        {m.name}
                      </h3>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                        {formatShortDate(m.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#64717a] truncate mt-0.5">
                      {m.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Pill tone={unread ? "dark" : "neutral"}>
                        {subjectLabel(m.subject)}
                      </Pill>
                      {m.status === "replied" && (
                        <Pill tone="success">Replied</Pill>
                      )}
                      {m.status === "archived" && (
                        <Pill tone="warn">Archived</Pill>
                      )}
                    </div>
                    <p className="text-sm text-[#20282c]/80 mt-3 line-clamp-2">
                      {m.message}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <MessageDrawer
          message={active}
          onClose={() => setActive(null)}
          onArchive={() =>
            updateStatus(
              active.id,
              active.status === "archived" ? "read" : "archived"
            )
          }
          onDelete={() => removeMessage(active.id)}
          onReplied={() => {
            // The reply endpoint already marks the row as replied server-side;
            // mirror that locally without another PATCH.
            const now = new Date().toISOString();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === active.id
                  ? { ...m, status: "replied", readAt: m.readAt ?? now, repliedAt: now }
                  : m
              )
            );
            setActive((cur) =>
              cur && cur.id === active.id ? { ...cur, status: "replied" } : cur
            );
          }}
        />
      )}
        </>
      )}
    </>
  );
}

function MessageDrawer({
  message,
  onClose,
  onArchive,
  onDelete,
  onReplied,
}: {
  message: ContactMessage;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReplied: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke image preview object URLs when the drawer unmounts.
  useEffect(() => {
    return () => {
      setAttachments((prev) => {
        prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        return prev;
      });
    };
  }, []);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const current = [...attachments];
      let totalBytes = current.reduce((acc, a) => acc + a.size, 0);

      for (const file of Array.from(files)) {
        if (current.length >= MAX_REPLY_ATTACHMENTS) {
          setError(`Up to ${MAX_REPLY_ATTACHMENTS} attachments per reply.`);
          break;
        }
        if (totalBytes + file.size > MAX_REPLY_ATTACHMENT_BYTES) {
          setError("Attachments are too large — 3MB total max.");
          break;
        }
        try {
          const content = await readFileAsBase64(file);
          current.push({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            content,
            size: file.size,
            previewUrl: file.type.startsWith("image/")
              ? URL.createObjectURL(file)
              : null,
          });
          totalBytes += file.size;
        } catch {
          setError(`Could not read "${file.name}".`);
        }
      }
      setAttachments(current);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [attachments]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await nativeMutationFetch(
        `/api/affiliates/admin/messages/${message.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reply: text,
            attachments: attachments.map((a) => ({
              filename: a.filename,
              contentType: a.contentType,
              content: a.content,
            })),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setError(data?.error?.message || data?.error || "Could not send reply.");
        return;
      }
      setSent(true);
      onReplied();
    } catch {
      setError("Could not send reply. Please try again.");
    } finally {
      setSending(false);
    }
  }, [reply, sending, message.id, onReplied, attachments]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#20282c]/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-surface-strong rounded-lg p-7 md:p-9 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#242526]/5"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1">
          {formatShortDate(message.createdAt)}
        </p>
        <h3 className="text-2xl font-medium tracking-tight">{message.name}</h3>
        <a
          href={`mailto:${message.email}`}
          className="text-sm text-[#64717a] hover:underline mt-0.5 inline-block"
        >
          {message.email}
        </a>

        <div className="mt-4">
          <Pill tone="neutral">{subjectLabel(message.subject)}</Pill>
        </div>

        <div className="mt-5 rounded-lg bg-[#242526]/4 border border-[#242526]/8 p-5">
          <p className="text-sm leading-relaxed text-[#20282c] whitespace-pre-wrap">
            {message.message}
          </p>
        </div>

        {composing && !sent && (
          <div className="mt-5">
            <label className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-2 block">
              Reply to {message.name.split(/\s+/)[0] || message.email}
            </label>
            <textarea
              autoFocus
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendReply();
              }}
              rows={5}
              maxLength={10000}
              placeholder="Type your reply… it will be emailed to the customer."
              className="w-full rounded-lg border border-[#242526]/12 bg-white/70 p-4 text-sm leading-relaxed text-[#20282c] outline-none focus:border-[#242526]/40 resize-y"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                Sends from your IQON support email · ⌘/Ctrl + Enter
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || attachments.length >= MAX_REPLY_ATTACHMENTS}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] hover:text-[#20282c] hover:bg-[#242526]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attach
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {attachments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {attachments.map((a, i) => (
                  <li
                    key={`${a.filename}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-[#242526]/10 bg-white/70 px-3 py-2"
                  >
                    {a.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.previewUrl}
                        alt={a.filename}
                        className="h-10 w-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <span className="h-10 w-10 rounded-lg bg-[#242526]/6 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-[#64717a]" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-[#20282c] truncate">
                        {a.filename}
                      </span>
                      <span className="block text-[10px] font-sans text-[#64717a]">
                        {formatFileSize(a.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      disabled={sending}
                      className="p-1.5 rounded-full text-[#64717a] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      aria-label={`Remove ${a.filename}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {sent && (
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-600/20 p-4 text-sm text-emerald-700">
            <Check className="h-4 w-4 shrink-0" />
            Reply sent to {message.email}.
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          {sent ? null : composing ? (
            <>
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send reply
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setComposing(false);
                  setError(null);
                  setAttachments((prev) => {
                    prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
                    return [];
                  });
                }}
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setComposing(true)}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          )}

          {!composing && !sent && (
            <>
              <button
                onClick={onArchive}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
              >
                {message.status === "archived" ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </>
                )}
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#64717a]/10 text-[#64717a] hover:bg-[#64717a]/15 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}

          {sent && (
            <button
              onClick={onClose}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
