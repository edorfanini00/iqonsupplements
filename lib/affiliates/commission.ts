/**
 * Commission and order math helpers (pure, testable).
 */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateCommission(orderTotal: number, ratePercent: number): number {
  return round2(orderTotal * (ratePercent / 100));
}

export interface OrderWithReferralInput {
  orderTotal: number;
  /**
   * Amount the commission percentage is applied to. This is the order subtotal
   * AFTER any coupon discount but BEFORE shipping and taxes. Falls back to
   * `orderTotal` when not provided (legacy callers).
   */
  commissionBase?: number;
  /** First-order / default commission rate for the attributed affiliate. */
  commissionRate: number;
  /** How the order matched the affiliate. Recurring orders use the recurring rate. */
  matchType?: "code" | "recurring" | "referral";
  /** Commission rate applied to recurring orders (falls back to commissionRate). */
  recurringCommissionRate?: number;
  referrerId?: string;
  referralCommissionRate?: number;
  referrerActive?: boolean;
}

export interface OrderWithReferralResult {
  primaryCommission: number;
  referralCommission?: number;
}

/**
 * Resolve the commission rate for the affiliate's own (primary) earning,
 * picking the recurring rate for recurring orders when one is configured.
 */
export function resolvePrimaryRate(input: {
  commissionRate: number;
  matchType?: "code" | "recurring" | "referral";
  recurringCommissionRate?: number;
}): number {
  if (
    input.matchType === "recurring" &&
    typeof input.recurringCommissionRate === "number"
  ) {
    return input.recurringCommissionRate;
  }
  return input.commissionRate;
}

export function computeOrderCommissions(
  input: OrderWithReferralInput
): OrderWithReferralResult {
  // Commission is earned on the discounted product subtotal — never on the
  // shipping or tax the customer pays.
  const base = input.commissionBase ?? input.orderTotal;

  const primaryCommission = calculateCommission(base, resolvePrimaryRate(input));

  if (
    !input.referrerId ||
    !input.referralCommissionRate ||
    input.referralCommissionRate <= 0 ||
    input.referrerActive === false
  ) {
    return { primaryCommission };
  }

  return {
    primaryCommission,
    referralCommission: calculateCommission(base, input.referralCommissionRate),
  };
}

export function formatPromoCode(nickname: string): string {
  const clean = nickname.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `${clean}15`;
}

/**
 * Brand terms affiliates may not claim in their promo code (matched against
 * the normalized nickname, so separators can't be used to sneak them in).
 * "iqon" also covers "iqonhealth", "iqon-health", "i.q.o.n", etc.
 */
const RESERVED_CODE_FRAGMENTS = ["iqon"];

export function isReservedPromoNickname(nickname: string): boolean {
  const clean = nickname.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return RESERVED_CODE_FRAGMENTS.some((fragment) => clean.includes(fragment));
}

export function maskAccountNumber(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}

export function maskBankInfo(info?: import("./types").BankInfo): import("./types").BankInfo | undefined {
  if (!info) return undefined;
  return {
    ...info,
    accountNumber: info.accountNumber ? maskAccountNumber(info.accountNumber) : undefined,
  };
}
