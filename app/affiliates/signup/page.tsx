"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { RecruitmentLink } from "@/components/affiliates/RecruitmentLink";
import { useRecruitmentRef } from "@/lib/affiliates/recruitment-links";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, UserPlus, Search, X, Users, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isReservedPromoNickname } from "@/lib/affiliates/commission";

interface ReferrerMatch {
  id: string;
  name: string;
  promoCode: string;
}

export default function AffiliateSignUpPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fafbfb] text-[#20282c] pt-32 pb-32" />
      }
    >
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const searchParams = useSearchParams();
  const storedRef = useRecruitmentRef();
  const ref = searchParams.get("ref")?.trim() ?? storedRef;
  const [referrerChoice, setReferrerChoice] = useState<"" | "affiliate" | "none">("");
  const [selectedReferrer, setSelectedReferrer] = useState<ReferrerMatch | null>(null);
  const [referrerQuery, setReferrerQuery] = useState("");
  const [referrerResults, setReferrerResults] = useState<ReferrerMatch[]>([]);
  const [searchingReferrer, setSearchingReferrer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    inviteUrl: string;
    promoCode: string;
    message: string;
  } | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    whatsapp: "",
    password: "",
    confirmPassword: "",
    nickname: "",
    instagram: "",
    tiktok: "",
    website: "",
  });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(false);
  const [showWhatsappHelp, setShowWhatsappHelp] = useState(false);

  // When "same as phone" is on, keep WhatsApp mirrored to the phone field.
  const whatsappValue = whatsappSameAsPhone ? form.phone : form.whatsapp;

  const promoPreview = useMemo(() => {
    const clean = form.nickname.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return clean ? `${clean}15` : "";
  }, [form.nickname]);

  // Invite links (?ref=) pre-select the referrer for the applicant.
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    fetch(`/api/affiliates/invite/lookup?ref=${encodeURIComponent(ref)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data?.referrer) {
          setError("This recruitment link is invalid or unavailable. Please select a referrer or explicitly choose no referrer.");
          return;
        }
        setSelectedReferrer({
          id: data.referrer.id,
          name: data.referrer.name,
          promoCode: data.referrer.promoCode,
        });
        setReferrerChoice("affiliate");
      })
      .catch(() => { if (!cancelled) setError("Could not check the recruitment link. Please try again or select a referrer."); });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  // Debounced typeahead search for the referrer field.
  useEffect(() => {
    if (referrerChoice !== "affiliate" || selectedReferrer) {
      setReferrerResults([]);
      return;
    }
    const q = referrerQuery.trim();
    if (q.length < 2) {
      setReferrerResults([]);
      setSearchingReferrer(false);
      return;
    }
    let cancelled = false;
    setSearchingReferrer(true);
    const t = setTimeout(() => {
      fetch(`/api/affiliates/referrer-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled) return;
          setReferrerResults(data?.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setReferrerResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchingReferrer(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [referrerQuery, referrerChoice, selectedReferrer]);

  const inputClass =
    "bg-transparent border-0 border-b border-[#20282c]/20 rounded-none px-0 py-4 text-base focus-visible:ring-0 focus-visible:border-[#20282c] focus:border-[#20282c] transition-colors placeholder:text-[#64717a] h-auto";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }
    if (!form.nickname.trim()) {
      setError("Please enter a nickname for your promo code");
      return;
    }
    if (isReservedPromoNickname(form.nickname)) {
      setError(
        "That nickname isn't available — names containing our brand can't be used. Try a different nickname."
      );
      return;
    }
    if (!referrerChoice) {
      setError("Please tell us who referred you, or choose “No one referred me”.");
      return;
    }
    if (referrerChoice === "affiliate" && !selectedReferrer) {
      setError("Please select the affiliate who referred you from the list, or choose “No one referred me”.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/affiliates/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          whatsapp: whatsappValue || undefined,
          password: form.password,
          nickname: form.nickname,
          instagram: form.instagram || undefined,
          tiktok: form.tiktok || undefined,
          website: form.website || undefined,
          ref:
            referrerChoice === "affiliate" && selectedReferrer
              ? selectedReferrer.id
              : undefined,
          noReferrer: referrerChoice === "none",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSuccess({
        inviteUrl: data.inviteUrl,
        promoCode: data.promoCode,
        message:
          data.message ||
          "Your application has been submitted. We'll review it and notify you once approved.",
      });
      try { sessionStorage.removeItem("iqon-recruitment-ref"); } catch { /* storage may be disabled */ }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#fafbfb] text-[#20282c] pt-32 pb-32">
        <div className="max-w-xl mx-auto px-6 sm:px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#242526] flex items-center justify-center mx-auto mb-8">
            <Check className="h-8 w-8 text-white" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-sans text-[#64717a] mb-3">
            Application received
          </p>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">
            Your request has been sent
          </h1>
          <p className="text-[#64717a] text-lg mb-10 max-w-md mx-auto leading-relaxed">
            {success.message}
          </p>
          <div className="bg-[#20282c] text-white rounded-lg p-7 mb-10">
            <p className="text-[10px] uppercase tracking-[0.2em] font-sans text-white/55 mb-2">
              Your provisional code
            </p>
            <p className="text-3xl font-sans font-medium tracking-wider">
              {success.promoCode}
            </p>
            <p className="text-xs text-white/55 mt-4 leading-relaxed">
              We'll lock this in once your account is approved. The final
              commission rate is set by our team during review.
            </p>
          </div>
          <RecruitmentLink inviteUrl={success.inviteUrl} />
          <Link
            href="/affiliates"
            className="text-sm text-[#20282c] underline hover:no-underline"
          >
            Back to affiliates
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafbfb] text-[#20282c] pt-32 pb-32">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <Link
          href="/affiliates"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#64717a] hover:text-[#20282c] transition-colors mb-12"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Affiliates
        </Link>

        <h1 className="text-4xl md:text-[3.5rem] leading-none font-medium tracking-tight mb-4">
          Join the Program
        </h1>
        <p className="text-[#64717a] text-lg mb-6">
          Fill out the form below to create your affiliate account and get your
          unique promo code.
        </p>

        {error && (
          <p className="text-amber-700 text-sm mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {/* Personal Info */}
          <div className="mb-12">
            <h2 className="text-sm uppercase tracking-widest font-medium mb-6 flex items-center gap-4">
              <span className="text-[#64717a]">1</span> Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Input
                placeholder="First name*"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                className={inputClass}
              />
              <Input
                placeholder="Last name*"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
                className={inputClass}
              />
              <div className="sm:col-span-2">
                <Input
                  type="email"
                  placeholder="Email*"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  type="tel"
                  placeholder="Phone*"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 mt-4 mb-1">
                  <span className="text-xs uppercase tracking-widest text-[#64717a]">
                    WhatsApp number
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowWhatsappHelp((v) => !v)}
                    className="text-[#64717a] hover:text-[#20282c] transition-colors"
                    aria-label="Why do we ask for this?"
                    aria-expanded={showWhatsappHelp}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                {showWhatsappHelp && (
                  <p className="text-xs text-[#64717a] leading-relaxed mb-2 p-3 rounded-lg bg-[#EAE8E3]/50 border border-[#20282c]/10">
                    Why do we ask for this? So we can add you to our affiliate
                    group chat, where we share drops, promos, and selling tips.
                  </p>
                )}
                <Input
                  type="tel"
                  placeholder="WhatsApp number"
                  value={whatsappValue}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  disabled={whatsappSameAsPhone}
                  className={`${inputClass} ${whatsappSameAsPhone ? "opacity-50" : ""}`}
                />
                <label className="mt-3 inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      whatsappSameAsPhone
                        ? "bg-[#20282c] border-[#20282c]"
                        : "border-[#20282c]/30"
                    }`}
                  >
                    {whatsappSameAsPhone && <Check className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <input
                    type="checkbox"
                    checked={whatsappSameAsPhone}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setWhatsappSameAsPhone(on);
                      if (on) setForm((f) => ({ ...f, whatsapp: f.phone }));
                    }}
                    className="sr-only"
                  />
                  <span className="text-sm text-[#64717a]">Same as phone number</span>
                </label>
              </div>
              <Input
                type="password"
                placeholder="Password*"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                className={inputClass}
              />
              <Input
                type="password"
                placeholder="Confirm password*"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Promo Code */}
          <div className="mb-12">
            <h2 className="text-sm uppercase tracking-widest font-medium mb-6 flex items-center gap-4">
              <span className="text-[#64717a]">2</span> Your Promo Code
            </h2>
            <p className="text-sm text-[#64717a] mb-4">
              Choose a nickname or name for your code. We'll add "15" to the end
              automatically. This code will give your audience 15% off.
            </p>
            <Input
              placeholder="Your nickname or name*"
              value={form.nickname}
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
              required
              className={inputClass}
            />
            {promoPreview && (
              <div className="mt-6 bg-[#20282c] text-white rounded-xl p-5">
                <p className="text-xs uppercase tracking-widest text-white/60 mb-1">
                  Your code will be
                </p>
                <p className="text-2xl font-sans font-bold tracking-wider">
                  {promoPreview}
                </p>
                <p className="text-xs text-white/50 mt-2">
                  Customers use this code for 15% off. You earn commission on every sale + recurring purchases.
                </p>
              </div>
            )}
          </div>

          {/* Who referred you */}
          <div className="mb-12">
            <h2 className="text-sm uppercase tracking-widest font-medium mb-6 flex items-center gap-4">
              <span className="text-[#64717a]">3</span> Who Referred You?
            </h2>
            <p className="text-sm text-[#64717a] mb-5">
              Let us know which affiliate told you about IQON so we can credit
              them. If you found us on your own, just choose “No one”.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              <button
                type="button"
                onClick={() => setReferrerChoice("affiliate")}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  referrerChoice === "affiliate"
                    ? "border-[#20282c] bg-[#20282c]/5"
                    : "border-[#20282c]/15 hover:border-[#20282c]/30"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      referrerChoice === "affiliate"
                        ? "bg-[#20282c] text-white"
                        : "bg-[#20282c]/8 text-[#20282c]"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium">An affiliate referred me</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReferrerChoice("none");
                  setSelectedReferrer(null);
                  setReferrerQuery("");
                  setReferrerResults([]);
                }}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  referrerChoice === "none"
                    ? "border-[#20282c] bg-[#20282c]/5"
                    : "border-[#20282c]/15 hover:border-[#20282c]/30"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      referrerChoice === "none"
                        ? "bg-[#20282c] text-white"
                        : "bg-[#20282c]/8 text-[#20282c]"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium">No one — I found IQON on my own</span>
                </span>
              </button>
            </div>

            {referrerChoice === "affiliate" && (
              <div className="mt-4">
                {selectedReferrer ? (
                  <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-[#20282c]/5 border border-[#20282c]/10">
                    <span className="w-8 h-8 rounded-full bg-[#20282c] text-white flex items-center justify-center">
                      <UserPlus className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm">
                      <span className="text-[#20282c] font-medium">
                        {selectedReferrer.name}
                      </span>
                      <span className="text-[#64717a]"> · {selectedReferrer.promoCode}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReferrer(null);
                        setReferrerQuery("");
                      }}
                      className="ml-1 p-1 rounded-full hover:bg-[#20282c]/10 text-[#64717a]"
                      aria-label="Clear referrer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64717a]" />
                      <Input
                        placeholder="Search by name or promo code…"
                        value={referrerQuery}
                        onChange={(e) => setReferrerQuery(e.target.value)}
                        className={`${inputClass} pl-6`}
                      />
                    </div>
                    {referrerQuery.trim().length >= 2 && (
                      <div className="mt-2 rounded-lg border border-[#20282c]/10 bg-white overflow-hidden">
                        {searchingReferrer ? (
                          <p className="px-4 py-3 text-sm text-[#64717a]">Searching…</p>
                        ) : referrerResults.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-[#64717a]">
                            No affiliate found. Check the spelling, or choose “No one”.
                          </p>
                        ) : (
                          <ul className="max-h-60 overflow-y-auto">
                            {referrerResults.map((r) => (
                              <li key={r.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedReferrer(r);
                                    setReferrerResults([]);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-[#20282c]/5 transition-colors flex items-center justify-between gap-3"
                                >
                                  <span className="text-sm font-medium text-[#20282c]">
                                    {r.name}
                                  </span>
                                  <span className="text-xs font-sans text-[#64717a]">
                                    {r.promoCode}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Social / Optional */}
          <div className="mb-12">
            <h2 className="text-sm uppercase tracking-widest font-medium mb-6 flex items-center gap-4">
              <span className="text-[#64717a]">4</span> Social & Platform{" "}
              <span className="text-xs text-[#64717a] font-normal normal-case tracking-normal">(optional)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Input
                placeholder="Instagram handle"
                value={form.instagram}
                onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                className={inputClass}
              />
              <Input
                placeholder="TikTok handle"
                value={form.tiktok}
                onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))}
                className={inputClass}
              />
              <div className="sm:col-span-2">
                <Input
                  placeholder="Website URL"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="mb-8 p-5 rounded-xl border border-[#20282c]/10 bg-[#EAE8E3]/30">
            <p className="text-sm text-[#64717a] leading-relaxed">
              By signing up, you agree to our affiliate terms. You will earn
              commission on all orders attributed to your promo code. Repeat
              customers matched by name/email will also earn you recurring
              commissions. Payouts are processed monthly.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#20282c] text-white rounded-full h-14 text-sm uppercase tracking-wider hover:bg-[#20282c]/90 transition-colors"
          >
            {loading ? "Creating account…" : "Create Affiliate Account"}
          </Button>

          <p className="text-center text-sm text-[#64717a] mt-6">
            Already have an account?{" "}
            <Link href="/affiliates/login" className="text-[#20282c] underline hover:no-underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
