"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, Save, Eye, EyeOff, Lock } from "lucide-react";
import {
  PageHeader,
  Pill,
} from "@/components/affiliates/shared/ui";

interface BankInfo {
  accountHolder?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: "checking" | "savings";
  country?: string;
  paypalEmail?: string;
  zelle?: string;
  notes?: string;
}

export default function AffiliatePaymentPage() {
  const [bank, setBank] = useState<BankInfo>({});
  const [hasInfo, setHasInfo] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/bank", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBank(data.bankInfo ?? {});
        setHasInfo(Boolean(data.hasBankInfo));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/affiliates/bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bank),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
        return;
      }
      setSuccess(true);
      load();
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] transition-colors placeholder:text-[#64717a] w-full";

  return (
    <>
      <PageHeader
        eyebrow="Payment"
        title="How you get paid"
        description="Add the account details where we should send your commissions."
        actions={
          hasInfo ? <Pill tone="success">On file</Pill> : <Pill tone="warn">Missing</Pill>
        }
      />

      {loading ? (
        <div className="glass-surface rounded-lg p-12 text-center text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <form
            onSubmit={save}
            className="glass-surface rounded-lg p-6 md:p-8 space-y-2"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
              Bank account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
              <input
                placeholder="Account holder name"
                value={bank.accountHolder ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, accountHolder: e.target.value })
                }
                className={inputClass}
              />
              <input
                placeholder="Bank name"
                value={bank.bankName ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, bankName: e.target.value })
                }
                className={inputClass}
              />
              <input
                placeholder="Routing / SWIFT"
                value={bank.routingNumber ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, routingNumber: e.target.value })
                }
                className={inputClass}
              />
              <div className="relative">
                <input
                  placeholder="Account number"
                  type={showAccountNumber ? "text" : "password"}
                  value={bank.accountNumber ?? ""}
                  onChange={(e) =>
                    setBank({ ...bank, accountNumber: e.target.value })
                  }
                  className={`${inputClass} pr-8`}
                />
                <button
                  type="button"
                  onClick={() => setShowAccountNumber((v) => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[#64717a] hover:text-[#20282c]"
                >
                  {showAccountNumber ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <select
                value={bank.accountType ?? ""}
                onChange={(e) =>
                  setBank({
                    ...bank,
                    accountType:
                      e.target.value === "checking" ||
                      e.target.value === "savings"
                        ? e.target.value
                        : undefined,
                  })
                }
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Account type</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
              <input
                placeholder="Country"
                value={bank.country ?? ""}
                onChange={(e) => setBank({ ...bank, country: e.target.value })}
                className={inputClass}
              />
            </div>

            <p className="!mt-8 text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
              Alternative
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
              <input
                placeholder="PayPal email"
                value={bank.paypalEmail ?? ""}
                onChange={(e) =>
                  setBank({ ...bank, paypalEmail: e.target.value })
                }
                className={inputClass}
              />
              <input
                placeholder="Zelle email or phone"
                value={bank.zelle ?? ""}
                onChange={(e) => setBank({ ...bank, zelle: e.target.value })}
                className={inputClass}
              />
            </div>
            <textarea
              placeholder="Notes (e.g. Venmo handle, Wise details)"
              value={bank.notes ?? ""}
              onChange={(e) => setBank({ ...bank, notes: e.target.value })}
              rows={2}
              className={`${inputClass} resize-none !mt-2`}
            />

            {error && (
              <p className="text-amber-700 text-sm mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                {error}
              </p>
            )}
            {success && (
              <p className="text-[#20282c] text-sm mt-4 p-3 bg-[#242526]/5 border border-[#242526]/10 rounded-xl">
                Saved.
              </p>
            )}

            <div className="!mt-8">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[10px] uppercase tracking-[0.18em] font-sans bg-[#242526] text-white hover:bg-[#20282c] transition-colors disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save details"}
              </button>
            </div>
          </form>

          <aside className="space-y-3">
            <div className="glass-surface rounded-lg p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#242526] text-white mb-3">
                <Lock className="h-4 w-4" />
              </div>
              <p className="font-medium leading-tight">Stored securely</p>
              <p className="text-sm text-[#64717a] mt-2 leading-relaxed">
                Your account number is never shown back to you in plain text. Only
                the last four digits are displayed once saved.
              </p>
            </div>
            <div className="glass-surface rounded-lg p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#242526]/8 text-[#20282c] mb-3">
                <CreditCard className="h-4 w-4" />
              </div>
              <p className="font-medium leading-tight">Payout schedule</p>
              <p className="text-sm text-[#64717a] mt-2 leading-relaxed">
                Commissions are paid out monthly. You can track every payout under
                the Payouts tab.
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
