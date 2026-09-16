"use client";

import { useState } from "react";
import { RecruitmentLink } from "@/components/affiliates/RecruitmentLink";
import { affiliatePath, useRecruitmentRef } from "@/lib/affiliates/recruitment-links";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export default function AffiliateLoginPage() {
  const ref = useRecruitmentRef();
  const [pendingLink, setPendingLink] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });


  const inputClass =
    "bg-transparent border-0 border-b border-[#20282c]/20 rounded-none px-0 py-4 text-base focus-visible:ring-0 focus-visible:border-[#20282c] focus:border-[#20282c] transition-colors placeholder:text-[#64717a] h-auto";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingLink("");
    setLoading(true);

    try {
      const res = await fetch("/api/affiliates/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        return;
      }
      if (data.role === "admin") {
        setPendingLink("");
        router.push("/affiliates/admin");
      } else if (data.role === "shop_manager") {
        router.push("/affiliates/shop-manager");
      } else if (data.pending && data.inviteUrl) {
        setPendingLink(data.inviteUrl);
      } else {
        router.push("/affiliates/dashboard");
      }
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
          href="/affiliates"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#64717a] hover:text-[#20282c] transition-colors mb-12"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Affiliates
        </Link>

        <h1 className="text-4xl md:text-[3.5rem] leading-none font-medium tracking-tight mb-4">
          Sign In
        </h1>
        <p className="text-[#64717a] text-lg mb-12">
          Access your affiliate dashboard or management portal.
        </p>

        {error && (
          <p className="text-amber-700 text-sm mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            {error}
          </p>
        )}

        {pendingLink && <><p>Your application is still under review. We will email you once approved.</p><RecruitmentLink inviteUrl={pendingLink} /></>}
        <form onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Username or Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              autoComplete="username"
              className={inputClass}
            />
            <Input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors mt-10"
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>

          <p className="text-center text-sm text-[#64717a] mt-6">
            <Link
              href="/affiliates/forgot-password"
              className="text-[#20282c] underline hover:no-underline"
            >
              Forgot your password?
            </Link>
          </p>

          <p className="text-center text-sm text-[#64717a] mt-3">
            Don't have an account?{" "}
            <Link href={affiliatePath("/affiliates/signup", ref)} className="text-[#20282c] underline hover:no-underline">
              Apply now
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
