"use client";

import { useState } from "react";
import { Lock, Save, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/affiliates/shared/ui";

export default function AffiliateSettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] transition-colors placeholder:text-[#64717a] w-full";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/affiliates/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't update your password.");
        return;
      }
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      setError("Couldn't update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Account settings"
        description="Manage your login and account security."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <form
          onSubmit={handleSubmit}
          className="glass-surface rounded-lg p-6 md:p-8 space-y-2"
        >
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
            Change password
          </p>

          <div className="space-y-2 max-w-md">
            <input
              type={show ? "text" : "password"}
              placeholder="Current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
              className={inputClass}
            />
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                placeholder="New password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className={`${inputClass} pr-8`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[#64717a] hover:text-[#20282c]"
                aria-label={show ? "Hide passwords" : "Show passwords"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              type={show ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-amber-700 text-sm mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl max-w-md">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[#20282c] text-sm mt-4 p-3 bg-[#242526]/5 border border-[#242526]/10 rounded-xl max-w-md">
              Your password has been updated. We&rsquo;ve emailed you a confirmation.
            </p>
          )}

          <div className="!mt-8">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>

        <aside className="space-y-3">
          <div className="glass-surface rounded-lg p-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#242526] text-white mb-3">
              <Lock className="h-4 w-4" />
            </div>
            <p className="font-medium leading-tight">Keep it secure</p>
            <p className="text-sm text-[#64717a] mt-2 leading-relaxed">
              Use at least 8 characters. Your new password updates everywhere you
              sign in with this account.
            </p>
          </div>
          <div className="glass-surface rounded-lg p-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#242526]/8 text-[#20282c] mb-3">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="font-medium leading-tight">We&rsquo;ll confirm by email</p>
            <p className="text-sm text-[#64717a] mt-2 leading-relaxed">
              Every time your password changes, we email you a confirmation so you
              always know about account activity.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
