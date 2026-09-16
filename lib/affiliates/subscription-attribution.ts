/**
 * Map subscriptions to the affiliate they're attributed to.
 *
 * Attribution comes from the affiliate-order ledger: a subscription's original
 * (or latest renewal) Shopify order carries the affiliate match. We only
 * count direct matches ("code" / "recurring"), never "referral" rows (those
 * credit the referrer, not the selling affiliate). Falls back to matching by
 * customer email when no order id lines up. Server-only.
 */

import { prisma } from "@/lib/db/prisma";

export interface SubscriptionAffiliate {
  name: string;
  code: string;
  /** Rate the selling affiliate earns on recurring (renewal) orders. */
  recurringCommissionRate: number;
  /**
   * Rate the affiliate's referrer earns on this affiliate's orders, or 0 when
   * there's no (active) referrer — i.e. the extra affiliate cost per order.
   */
  referralCommissionRate: number;
}

interface SubLike {
  id: string;
  firstOrderId: number | null;
  lastOrderId: number | null;
  customerEmail: string;
}

export async function getAffiliateAttributionForSubscriptions(
  subs: SubLike[]
): Promise<Map<string, SubscriptionAffiliate>> {
  const orderIds = new Set<number>();
  const emails = new Set<string>();
  for (const s of subs) {
    if (s.firstOrderId) orderIds.add(s.firstOrderId);
    if (s.lastOrderId) orderIds.add(s.lastOrderId);
    if (s.customerEmail) emails.add(s.customerEmail.toLowerCase().trim());
  }
  if (orderIds.size === 0 && emails.size === 0) return new Map();

  const or: Record<string, unknown>[] = [];
  if (orderIds.size) or.push({ shopifyOrderId: { in: [...orderIds] } });
  if (emails.size) or.push({ customerEmail: { in: [...emails] } });

  const rows = await prisma.affiliateOrder.findMany({
    where: { matchType: { in: ["code", "recurring"] }, OR: or },
    select: {
      shopifyOrderId: true,
      customerEmail: true,
      couponCode: true,
      createdAt: true,
      affiliate: {
        select: {
          firstName: true,
          lastName: true,
          promoCode: true,
          recurringCommissionRate: true,
          referralCommissionRate: true,
          referrerId: true,
          referrer: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const byOrder = new Map<number, SubscriptionAffiliate>();
  const byEmail = new Map<string, SubscriptionAffiliate>();
  for (const r of rows) {
    // The referrer only earns while active; otherwise there's no referral cost.
    const referrerActive =
      Boolean(r.affiliate.referrerId) && r.affiliate.referrer?.status === "active";
    const aff: SubscriptionAffiliate = {
      name: `${r.affiliate.firstName} ${r.affiliate.lastName}`.trim() || "Affiliate",
      code: (r.couponCode || r.affiliate.promoCode || "").toUpperCase(),
      recurringCommissionRate: r.affiliate.recurringCommissionRate ?? 0,
      referralCommissionRate: referrerActive
        ? r.affiliate.referralCommissionRate ?? 0
        : 0,
    };
    if (r.shopifyOrderId != null && !byOrder.has(r.shopifyOrderId)) byOrder.set(r.shopifyOrderId, aff);
    const em = r.customerEmail.toLowerCase().trim();
    if (!byEmail.has(em)) byEmail.set(em, aff);
  }

  const out = new Map<string, SubscriptionAffiliate>();
  for (const s of subs) {
    const match =
      (s.firstOrderId != null ? byOrder.get(s.firstOrderId) : undefined) ??
      (s.lastOrderId != null ? byOrder.get(s.lastOrderId) : undefined) ??
      byEmail.get(s.customerEmail.toLowerCase().trim());
    if (match) out.set(s.id, match);
  }
  return out;
}
