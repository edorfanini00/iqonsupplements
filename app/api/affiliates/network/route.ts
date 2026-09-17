import {
  getAffiliateById,
  getReferralBreakdownForAffiliate,
  getOrdersForAffiliate,
} from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAffiliateSession();
  if (isNextResponse(session)) return session;

  const affiliateId = sessionProfileId(session);
  const affiliate = session.profile ?? (await getAffiliateById(affiliateId));
  if (!affiliate) return apiError("UNAUTHORIZED", "Unauthorized", 401);

  const breakdown = await getReferralBreakdownForAffiliate(affiliateId);
  const referralOrders = (await getOrdersForAffiliate(affiliateId))
    .filter((o) => o.matchType === "referral")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  const refereeMap = new Map<string, { name: string; promoCode: string }>();
  for (const r of breakdown) {
    refereeMap.set(r.refereeId, {
      name: r.refereeName,
      promoCode: r.refereePromoCode,
    });
  }

  let referredBy: { name: string; promoCode: string; rate: number } | null = null;
  if (affiliate.referrerId) {
    const referrer = await getAffiliateById(affiliate.referrerId);
    if (referrer) {
      referredBy = {
        name: `${referrer.firstName} ${referrer.lastName}`.trim(),
        promoCode: referrer.promoCode,
        rate: affiliate.referralCommissionRate ?? 0,
      };
    }
  }

  // The % this affiliate earns on a referred friend's sales. The exact rate is
  // set by the admin per referee at approval; before their first referral we
  // preview the standard default used in the admin tooling.
  const referralRatePreview =
    breakdown.length > 0
      ? Math.max(...breakdown.map((r) => r.referralRate))
      : 5;

  return apiSuccess({
    referralRatePreview,
    breakdown,
    recentReferralOrders: referralOrders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      customerName: o.customerName,
      orderTotal: o.orderTotal,
      commission: o.commission,
      status: o.status,
      createdAt: o.createdAt,
      sourceAffiliateId: o.sourceAffiliateId,
      sourceAffiliateName: o.sourceAffiliateId
        ? refereeMap.get(o.sourceAffiliateId)?.name ?? null
        : null,
      sourceAffiliateCode: o.sourceAffiliateId
        ? refereeMap.get(o.sourceAffiliateId)?.promoCode ?? null
        : null,
    })),
    referredBy,
  });
}
