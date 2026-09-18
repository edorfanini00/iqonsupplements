"use client";
import { nativeMutationFetch } from "@/lib/affiliates/native-mutation-fetch";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const inputClass =
    "bg-transparent border-0 border-b border-[#20282c]/20 rounded-none px-0 py-4 text-base focus-visible:ring-0 focus-visible:border-[#20282c] focus:border-[#20282c] transition-colors placeholder:text-[#64717a] h-auto";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await nativeMutationFetch("/api/affiliates/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/affiliates/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 sm:px-8">
      <Link
        href="/affiliates/login"
        className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#64717a] hover:text-[#20282c] transition-colors mb-12"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sign In
      </Link>

      <h1 className="text-4xl md:text-[3.5rem] leading-none font-medium tracking-tight mb-4">
        New Password
      </h1>

      {done ? (
        <>
          <p className="text-[#64717a] text-lg mb-8">
            Your password has been updated. Redirecting you to sign in&hellip;
          </p>
          <Link
            href="/affiliates/login"
            className="inline-flex items-center justify-center w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors"
          >
            Sign In
          </Link>
        </>
      ) : !token ? (
        <>
          <p className="text-[#64717a] text-lg mb-8">
            This reset link is missing or invalid. Please request a new one.
          </p>
          <Link
            href="/affiliates/forgot-password"
            className="inline-flex items-center justify-center w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors"
          >
            Request New Link
          </Link>
        </>
      ) : (
        <>
          <p className="text-[#64717a] text-lg mb-12">
            Choose a new password for your affiliate account.
          </p>

          {error && (
            <p className="text-amber-700 text-sm mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
                className={inputClass}
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors mt-10"
            >
              {loading ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

export default function AffiliateResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#fafbfb] text-[#20282c] pt-32 pb-32">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
