import {
  getAllAffiliates,
  getAffiliateStats,
  getPayoutsForAffiliate,
} from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const affiliates = await Promise.all(
      (await getAllAffiliates())
        .filter((a) => a.role === "affiliate")
        .map(async (a) => {
          const stats = await getAffiliateStats(a.id);
          const payouts = await getPayoutsForAffiliate(a.id);
          return {
            id: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email,
            phone: a.phone,
            whatsapp: a.whatsapp,
            promoCode: a.promoCode,
            instagram: a.instagram,
            tiktok: a.tiktok,
            website: a.website,
            status: a.status,
            commissionRate: a.commissionRate,
            recurringCommissionRate: a.recurringCommissionRate,
            couponRate: a.couponRate,
            referrerId: a.referrerId ?? null,
            referralCommissionRate: a.referralCommissionRate ?? null,
            bonusThreshold: a.bonusThreshold ?? null,
            bonusRate: a.bonusRate ?? null,
            createdAt: a.createdAt,
            bankInfo: a.bankInfo ?? null,
            stats,
            lastPayoutAt: payouts[0]?.paidAt ?? null,
          };
        })
    );

    affiliates.sort((x, y) => y.stats.totalCommission - x.stats.totalCommission);
    return apiSuccess({ affiliates });
  } catch (err) {
    console.error("[api/affiliates/admin/affiliates]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
