/**
 * App-portal settings and app-subscription commissions.
 *
 * The commission rate on SUPPLEMENTS_APP app subscriptions is a single admin-editable
 * number (default 10%). Recorded commissions become AffiliateOrder rows with
 * matchType "bonus" and an "APP-" order id prefix, so they flow through the
 * existing payout pipeline (pending balance, payout modal, affiliate dashboard)
 * without touching store revenue: bonus rows carry orderTotal 0 and are already
 * excluded from every revenue and order-count figure.
 */

import { prisma } from "@/lib/db/prisma";

const CONFIG_ID = "app-portal";
export const DEFAULT_APP_COMMISSION_RATE = 10;

interface AppPortalSettings {
  commissionRate: number;
}

export async function getAppCommissionRate(): Promise<number> {
  try {
    const row = await prisma.appPortalConfig.findUnique({ where: { id: CONFIG_ID } });
    if (!row) return DEFAULT_APP_COMMISSION_RATE;
    const parsed = JSON.parse(row.json) as Partial<AppPortalSettings>;
    const rate = Number(parsed.commissionRate);
    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) return rate;
  } catch {
    // Table may not exist yet (migration pending) — use the default.
  }
  return DEFAULT_APP_COMMISSION_RATE;
}

export async function setAppCommissionRate(rate: number): Promise<void> {
  const json = JSON.stringify({ commissionRate: rate } satisfies AppPortalSettings);
  await prisma.appPortalConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, json },
    update: { json },
  });
}

/** "jane@x.com" -> "jane-x-com" — stable slug for idempotent order ids. */
function emailSlug(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** One commission per customer per month: APP-2026-09-jane-x-com. */
export function appCommissionOrderId(customerEmail: string, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `APP-${y}-${m}-${emailSlug(customerEmail)}`;
}

export interface RecordAppCommissionInput {
  affiliateId: string;
  customerEmail: string;
  customerName: string;
  /** The app subscription amount the commission is computed on (e.g. 12.99). */
  amount: number;
  /** Percent, e.g. 10 for 10%. */
  rate: number;
}

export interface RecordAppCommissionResult {
  ok: boolean;
  reason?: string;
  commission?: number;
  orderId?: string;
}

export async function recordAppCommission(
  input: RecordAppCommissionInput
): Promise<RecordAppCommissionResult> {
  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { id: input.affiliateId },
    select: { id: true, status: true, firstName: true, lastName: true },
  });
  if (!affiliate) return { ok: false, reason: "Affiliate not found." };
  if (affiliate.status !== "active") {
    return { ok: false, reason: "Affiliate is not active." };
  }

  const commission = Math.round(input.amount * input.rate) / 100;
  if (commission <= 0) return { ok: false, reason: "Commission comes out to $0." };

  const orderId = appCommissionOrderId(input.customerEmail);
  const existing = await prisma.affiliateOrder.findFirst({
    where: { orderId },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      reason: "A commission for this app customer was already recorded this month.",
    };
  }

  await prisma.affiliateOrder.create({
    data: {
      affiliateId: affiliate.id,
      orderId,
      customerName: `SUPPLEMENTS_APP app · ${input.customerName || input.customerEmail}`,
      customerEmail: input.customerEmail.toLowerCase().trim(),
      // orderTotal stays 0 — app revenue is tracked from RevenueCat, never
      // from these rows; commission carries the actual payout money.
      orderTotal: 0,
      commission,
      matchType: "bonus",
      status: "pending",
    },
  });

  return { ok: true, commission, orderId };
}

export interface RecordedAppCommission {
  id: string;
  orderId: string;
  affiliateId: string;
  affiliateName: string;
  customerName: string;
  customerEmail: string;
  commission: number;
  status: string;
  createdAt: string;
}

export async function listAppCommissions(limit = 200): Promise<RecordedAppCommission[]> {
  const rows = await prisma.affiliateOrder.findMany({
    where: { orderId: { startsWith: "APP-" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { affiliate: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    affiliateId: r.affiliateId,
    affiliateName: `${r.affiliate.firstName} ${r.affiliate.lastName}`.trim(),
    customerName: r.customerName.replace(/^SUPPLEMENTS_APP app · /, ""),
    customerEmail: r.customerEmail,
    commission: r.commission,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}
