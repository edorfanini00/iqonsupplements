"use client";

import { useState } from 'react';
import { RefreshCw, Mail } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/affiliates/shared/ui';
import { SharedProgram } from '@/components/affiliates/shared/SharedProgram';

export default function AdminOverviewPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [couponSyncing, setCouponSyncing] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  async function handleTestEmail() {
    const to = window.prompt(
      "Send a test email to which address?\n(Tip: while your sending domain isn't verified in Resend, only your own Resend account email will actually arrive.)"
    );
    if (to === null) return;
    setTestingEmail(true);
    setEmailMessage(null);
    try {
      const res = await fetch("/api/affiliates/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: to.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailMessage(data.error || "Test email failed.");
      } else if (!data.apiKeyConfigured) {
        setEmailMessage(
          "RESEND_API_KEY is NOT set in this environment — nothing was sent (email was only logged). Add the key in Vercel and redeploy."
        );
      } else if (data.mode === "resend" && !data.error) {
        setEmailMessage(
          `Sent via Resend to ${data.to} from "${data.from}". If it doesn't arrive, check spam and that this domain is verified in Resend.`
        );
      } else if (data.error) {
        setEmailMessage(`Resend rejected it: ${data.error} (from "${data.from}")`);
      } else {
        setEmailMessage(`Result: ${data.mode}.`);
      }
      setTimeout(() => setEmailMessage(null), 12000);
    } catch {
      setEmailMessage("Test email request failed.");
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleCouponSync() {
    setCouponSyncing(true);
    setCouponMessage(null);
    try {
      const res = await fetch("/api/affiliates/admin/coupon-sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCouponMessage(data.error || "Coupon sync failed");
      } else {
        const created = (data.results ?? []).filter(
          (r: { status: string }) => r.status === "created" || r.status === "updated"
        ).length;
        const ok = (data.results ?? []).filter((r: { status: string }) => r.status === "ok").length;
        setCouponMessage(`Coupons verified: ${ok} ok, ${created} created/updated.`);
      }
      setTimeout(() => setCouponMessage(null), 6000);
    } finally {
      setCouponSyncing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/affiliates/admin/woocommerce-sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMessage(data.error || "Sync failed");
      } else {
        setSyncMessage(
          `Synced ${data.ingested}/${data.fetched} orders from WooCommerce.`
        );
        window.dispatchEvent(new Event('iqon-program-refresh'));
      }
      setTimeout(() => setSyncMessage(null), 6000);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Affiliate operations"
        description="Existing program operations and shared financial reporting. Financial filters and exports are in the report below."
        actions={
          <>

            <button
              onClick={handleCouponSync}
              disabled title="Store-specific coupon sync is not relayed. Select an affiliate in the shared report to verify both stores."
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${couponSyncing ? "animate-spin" : ""}`} />
              {couponSyncing ? "Verifying…" : "Peptide coupon sync — Health only"}
            </button>
            <button
              onClick={handleSync}
              disabled title="Provider-specific reconciliation must be run by the canonical Health integration owner; this portal cannot relay it."
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Peptide order sync — Health only"}
            </button>
            <button
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60"
              title="Send a test email to verify Resend delivery is working"
            >
              <Mail className={`h-3.5 w-3.5 ${testingEmail ? "animate-pulse" : ""}`} />
              {testingEmail ? "Sending…" : "Test Email"}
            </button>

          </>
        }
      />

      {emailMessage && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c] flex items-start gap-2">
          <Mail className="h-3.5 w-3.5 text-[#64717a] mt-0.5 shrink-0" />
          <span>{emailMessage}</span>
        </div>
      )}

      {couponMessage && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c] flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-[#64717a]" />
          {couponMessage}
        </div>
      )}

      {syncMessage && (
        <div className="mb-6 glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c] flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-[#64717a]" />
          {syncMessage}
        </div>
      )}

      <nav aria-label="Program operations" className="glass-hero-dark text-white rounded-lg p-6 mb-8 flex flex-wrap gap-4">
        {[
          ['requests','Applications'], ['affiliates','Affiliate directory'], ['payouts','Payout records'],
          ['integrations','Store integration status'], ['app','Existing IQONIC app'], ['rankings','Rankings & prizes'], ['tiktok','TikTok program'],
          ['messages','Messages'], ['affiliate-messages','Affiliate messages'], ['subscriptions','Subscriptions'],
          ['orders','Store order operations'], ['accounting','Accounting'], ['activity','Activity & audit'],
        ].map(([path,label]) => <Link key={path} className="underline" href={`/affiliates/admin/${path}`}>{label}</Link>)}
      </nav>
      <SharedProgram admin brand="supplements" />
    </>
  );
}
