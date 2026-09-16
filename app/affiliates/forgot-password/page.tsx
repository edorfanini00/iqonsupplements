"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AffiliateForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const inputClass =
    "bg-transparent border-0 border-b border-[#20282c]/20 rounded-none px-0 py-4 text-base focus-visible:ring-0 focus-visible:border-[#20282c] focus:border-[#20282c] transition-colors placeholder:text-[#64717a] h-auto";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafbfb] text-[#20282c] pt-32 pb-32">
      <div className="max-w-md mx-auto px-6 sm:px-8">
        <Link
          href="/affiliates/login"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#64717a] hover:text-[#20282c] transition-colors mb-12"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>

        <h1 className="text-4xl md:text-[3.5rem] leading-none font-medium tracking-tight mb-4">
          Reset Password
        </h1>

        {sent ? (
          <>
            <p className="text-[#64717a] text-lg mb-8">
              If an affiliate account exists for that email, we&rsquo;ve sent a
              password reset link. Check your inbox (and spam folder) and follow
              the link to choose a new password.
            </p>
            <Link
              href="/affiliates/login"
              className="inline-flex items-center justify-center w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors"
            >
              Return to Sign In
            </Link>
          </>
        ) : (
          <>
            <p className="text-[#64717a] text-lg mb-12">
              Enter the email on your affiliate account and we&rsquo;ll send you
              a link to reset your password.
            </p>

            {error && (
              <p className="text-amber-700 text-sm mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit}>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors mt-10"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
