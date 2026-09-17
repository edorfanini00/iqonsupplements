"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Human label for a bonus commission row's payment reason, derived from its
 * synthetic order id ("TIKTOK-C3" for TikTok cycles, "BONUS-2026-07" for
 * monthly sales bonuses).
 */
export function bonusKindLabel(orderId: string): string {
  if (orderId.startsWith("SHOPIFY-ADJUSTMENT-")) return "Refund adjustment";
  if (orderId.startsWith("LEADERBOARD-")) return "Leaderboard prize";
  if (orderId.startsWith("TIKTOK-")) return "TikTok bonus";
  if (orderId.startsWith("BONUS-")) return "Sales bonus";
  if (orderId.startsWith("APP-")) return "App commission";
  return "Bonus";
}

export function formatShortDate(iso: string): string {
  // Date-only strings ("2026-07-08") must be read as local calendar days —
  // new Date() would parse them as UTC midnight, which shows the previous
  // day in timezones behind UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
      <div>
        {eyebrow && (
          <div className="inline-flex items-center gap-2 glass-surface rounded-full px-3 py-1 mb-4 border border-[#242526]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#242526]" />
            <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c]/70">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="text-3xl md:text-[2.75rem] leading-[1.05] font-medium tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[#64717a] mt-2 max-w-xl text-base">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 self-start md:self-auto">{actions}</div>
      )}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  accent = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  accent?: boolean;
}) {
  if (accent) {
    return (
      <div className="glass-accent rounded-lg p-5 md:p-6 flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-white/55">
            {label}
          </span>
          {Icon && <Icon className="h-4 w-4 text-white/55" />}
        </div>
        <div className="mt-3">
          <p className="text-2xl md:text-3xl font-medium font-sans tracking-tight text-white">
            {value}
          </p>
          {(hint || delta != null) && (
            <p className="text-xs text-white/50 mt-1.5 font-sans flex items-center gap-2">
              {delta != null && <DeltaPill delta={delta} dark />}
              {hint}
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="glass-surface rounded-lg p-5 md:p-6 flex flex-col justify-between min-h-[124px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-[#64717a]" />}
      </div>
      <div className="mt-3">
        <p className="text-2xl md:text-3xl font-medium font-sans tracking-tight">
          {value}
        </p>
        {(hint || delta != null) && (
          <p className="text-xs text-[#64717a] mt-1.5 font-sans flex items-center gap-2">
            {delta != null && <DeltaPill delta={delta} />}
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ delta, dark = false }: { delta: number; dark?: boolean }) {
  const positive = delta >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  if (dark) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-[0.16em] font-sans px-1.5 py-0.5 rounded-full border border-white/15 text-white/80">
        <Icon className="h-2.5 w-2.5" />
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] uppercase tracking-[0.16em] font-sans px-1.5 py-0.5 rounded-full border ${
        positive
          ? "bg-[#242526]/8 text-[#20282c] border-[#242526]/12"
          : "bg-[#64717a]/10 text-[#64717a] border-[#64717a]/20"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-5 gap-4">
      <div>
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl md:text-2xl font-medium tracking-tight mt-1">
          {title}
        </h2>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone,
  icon: Icon,
}: {
  children: React.ReactNode;
  tone: "dark" | "neutral" | "success" | "warn" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const tones: Record<typeof tone, string> = {
    dark: "bg-[#242526] text-white border-[#242526]",
    neutral: "bg-[#242526]/5 text-[#20282c] border-[#242526]/10",
    success: "bg-[#242526]/8 text-[#20282c] border-[#242526]/12",
    warn: "bg-[#64717a]/10 text-[#64717a] border-[#64717a]/20",
    danger: "bg-red-600/10 text-red-700 border-red-600/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-sans px-2.5 py-1 rounded-full border ${tones[tone]}`}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="glass-surface rounded-lg p-10 md:p-14 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#242526]/5 mb-4">
        <Icon className="h-5 w-5 text-[#64717a]" />
      </div>
      <p className="text-[#20282c] font-medium">{title}</p>
      {description && (
        <p className="text-[#64717a] text-sm mt-2 max-w-sm mx-auto">{description}</p>
      )}
    </div>
  );
}
