"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StickyNote,
  Plus,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Loader2,
  Tag,
} from "lucide-react";
import {
  PageHeader,
  Pill,
  EmptyState,
  formatShortDate,
} from "@/components/affiliates/shared/ui";

interface AdminNote {
  id: string;
  title: string | null;
  body: string;
  tag: string | null;
  pinned: boolean;
  authorEmail: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Composer
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTag, setEditTag] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/notes", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortNotes = (list: AdminNote[]) =>
    [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const addNote = useCallback(async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim() || undefined,
          body: text,
          tag: tag.trim() || undefined,
          pinned,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setError(data?.error?.message || data?.error || "Could not save note.");
        return;
      }
      if (data.note) setNotes((prev) => sortNotes([data.note, ...prev]));
      setTitle("");
      setBody("");
      setTag("");
      setPinned(false);
    } catch {
      setError("Could not save note. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [title, body, tag, pinned, saving]);

  const togglePin = useCallback(async (note: AdminNote) => {
    const next = !note.pinned;
    setNotes((prev) =>
      sortNotes(prev.map((n) => (n.id === note.id ? { ...n, pinned: next } : n)))
    );
    await fetch(`/api/affiliates/admin/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pinned: next }),
    }).catch(() => {});
  }, []);

  const removeNote = useCallback(async (id: string) => {
    if (!window.confirm("Delete this note permanently?")) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingId === id) setEditingId(null);
    await fetch(`/api/affiliates/admin/notes/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
  }, [editingId]);

  function startEdit(note: AdminNote) {
    setEditingId(note.id);
    setEditTitle(note.title ?? "");
    setEditBody(note.body);
    setEditTag(note.tag ?? "");
  }

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const text = editBody.trim();
    if (!text) return;
    const id = editingId;
    const patch = {
      title: editTitle.trim() || null,
      body: text,
      tag: editTag.trim() || null,
    };
    setNotes((prev) =>
      sortNotes(
        prev.map((n) =>
          n.id === id
            ? { ...n, ...patch, updatedAt: new Date().toISOString() }
            : n
        )
      )
    );
    setEditingId(null);
    await fetch(`/api/affiliates/admin/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, [editingId, editTitle, editBody, editTag]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.title, n.body, n.tag, n.authorName, n.authorEmail]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [notes, search]);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Notes"
        description="Internal notes for the team — track anything about orders, customers, or operations. Only admins can see these."
        actions={
          <span className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            <StickyNote className="h-3.5 w-3.5" />
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </span>
        }
      />

      {/* Composer */}
      <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Title (optional)"
          className="w-full bg-transparent text-lg font-medium text-[#20282c] placeholder:text-[#64717a]/60 outline-none mb-2"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote();
          }}
          rows={3}
          maxLength={10000}
          placeholder="Write a note… e.g. “Order #665 — customer asked to delay shipping until Friday.”"
          className="w-full rounded-lg border border-[#242526]/12 bg-white/70 p-4 text-sm leading-relaxed text-[#20282c] outline-none focus:border-[#242526]/40 resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-[#242526]/12 px-3 py-2">
            <Tag className="h-3.5 w-3.5 text-[#64717a]" />
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              maxLength={120}
              placeholder="Related to (e.g. Order #665)"
              className="bg-transparent text-sm text-[#20282c] placeholder:text-[#64717a]/60 outline-none w-52 max-w-[60vw]"
            />
          </div>
          <button
            onClick={() => setPinned((p) => !p)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-sans transition-colors ${
              pinned
                ? "bg-[#242526] text-white"
                : "bg-[#242526]/5 text-[#64717a] hover:text-[#20282c]"
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
            {pinned ? "Pinned" : "Pin"}
          </button>
          <div className="flex-1" />
          <button
            onClick={addNote}
            disabled={saving || !body.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add note
              </>
            )}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Search */}
      {notes.length > 0 && (
        <div className="mb-5 inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 w-full sm:w-auto">
          <Search className="h-3.5 w-3.5 text-[#64717a]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
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
      )}

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={notes.length === 0 ? "No notes yet" : "No matches"}
          description={
            notes.length === 0
              ? "Add your first note above — anything the team should remember about orders or customers."
              : "No notes match your search."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((note) => {
            const editing = editingId === note.id;
            return (
              <li
                key={note.id}
                className="glass-surface rounded-lg p-5 sm:p-6 flex flex-col"
              >
                {editing ? (
                  <>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={200}
                      placeholder="Title (optional)"
                      className="w-full bg-transparent text-base font-medium text-[#20282c] placeholder:text-[#64717a]/60 outline-none mb-2"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      rows={4}
                      maxLength={10000}
                      className="w-full rounded-lg border border-[#242526]/12 bg-white/70 p-3 text-sm leading-relaxed text-[#20282c] outline-none focus:border-[#242526]/40 resize-y"
                    />
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/70 border border-[#242526]/12 px-3 py-1.5 w-fit">
                      <Tag className="h-3.5 w-3.5 text-[#64717a]" />
                      <input
                        value={editTag}
                        onChange={(e) => setEditTag(e.target.value)}
                        maxLength={120}
                        placeholder="Related to"
                        className="bg-transparent text-sm text-[#20282c] placeholder:text-[#64717a]/60 outline-none w-40"
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={!editBody.trim()}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526]/5 text-[#20282c] hover:bg-[#242526]/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {note.title && (
                          <h3 className="font-semibold text-[#20282c] truncate">
                            {note.title}
                          </h3>
                        )}
                        {note.tag && (
                          <div className="mt-1">
                            <Pill tone="neutral">{note.tag}</Pill>
                          </div>
                        )}
                      </div>
                      {note.pinned && (
                        <Pin className="h-3.5 w-3.5 text-[#242526] shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-[#20282c]/90 whitespace-pre-wrap mt-3 flex-1">
                      {note.body}
                    </p>
                    <div className="mt-4 pt-3 border-t border-[#242526]/8 flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] font-sans text-[#64717a] truncate">
                        {note.authorName || note.authorEmail} ·{" "}
                        {formatShortDate(note.updatedAt)}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => togglePin(note)}
                          className="p-2 rounded-full hover:bg-[#242526]/5"
                          title={note.pinned ? "Unpin" : "Pin"}
                        >
                          {note.pinned ? (
                            <PinOff className="h-3.5 w-3.5 text-[#64717a]" />
                          ) : (
                            <Pin className="h-3.5 w-3.5 text-[#64717a]" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(note)}
                          className="p-2 rounded-full hover:bg-[#242526]/5"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#64717a]" />
                        </button>
                        <button
                          onClick={() => removeNote(note.id)}
                          className="p-2 rounded-full hover:bg-[#242526]/5"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[#64717a]" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
