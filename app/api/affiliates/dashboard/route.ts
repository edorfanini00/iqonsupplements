import {
  getAffiliateById,
  getAffiliateStats,
  getOrdersForAffiliate,
  getPayoutsForAffiliate,
  getReferralBreakdownForAffiliate,
  getTimeSeries,
  resolveRange,
} from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { BUSINESS_TIME_ZONE } from "@/lib/affiliates/time-series";
import { bonusMonthPeriod } from "@/lib/affiliates/bonus";
import {
  fetchAppUsers,
  getAppIntegrationStatus,
} from "@/lib/app-portal/analytics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireAffiliateSession();
    if (isNextResponse(session)) return session;

    const affiliateId = sessionProfileId(session);
    const affiliate = session.profile ?? (await getAffiliateById(affiliateId));
    if (!affiliate) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const url = new URL(request.url);
    const {
      start,
      end,
      granularity,
      value: preset,
    } = resolveRange(url.searchParams.get("range"));

    const stats = await getAffiliateStats(affiliateId, {
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const orders = (await getOrdersForAffiliate(affiliateId)).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const payouts = await getPayoutsForAffiliate(affiliateId);
    const series = await getTimeSeries({ start, end, granularity }, affiliateId);
    const referralBreakdown = await getReferralBreakdownForAffiliate(affiliateId, {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    // Bonus config is read fresh from the DB (not the session snapshot) so a
    // bonus the admin just set shows up without the affiliate re-logging in.
    let bonus: {
      threshold: number;
      rate: number;
      monthSales: number;
      reached: boolean;
      projectedBonus: number;
      monthLabel: string;
    } | null = null;
    const freshProfile = await getAffiliateById(affiliateId);
    const bonusSource = freshProfile ?? affiliate;
    if (
      bonusSource.bonusThreshold != null &&
      bonusSource.bonusThreshold > 0 &&
      bonusSource.bonusRate != null &&
      bonusSource.bonusRate > 0
    ) {
      const period = bonusMonthPeriod();
      // Own attributed sales only (code + recurring) — referral cuts from
      // other affiliates' orders don't count toward the target.
      const monthSales = orders
        .filter((o) => {
          if (o.matchType !== "code" && o.matchType !== "recurring") return false;
          const at = new Date(o.createdAt).getTime();
          return at >= period.start.getTime() && at < period.end.getTime();
        })
        .reduce((acc, o) => acc + o.orderTotal, 0);
      const reached = monthSales >= bonusSource.bonusThreshold;
      bonus = {
        threshold: bonusSource.bonusThreshold,
        rate: bonusSource.bonusRate,
        monthSales: Math.round(monthSales * 100) / 100,
        reached,
        projectedBonus: reached
          ? Math.round(monthSales * bonusSource.bonusRate) / 100
          : 0,
        monthLabel: new Intl.DateTimeFormat("en-US", {
          timeZone: BUSINESS_TIME_ZONE,
          month: "long",
        }).format(new Date()),
      };
    }

    // SUPPLEMENTS_APP app stats for this affiliate: customers of theirs who are on the
    // app, how many subscribed (have app commission rows), and app earnings.
    const appRows = orders.filter((o) => o.orderId.startsWith("APP-"));
    const appSubscriberEmails = new Set(
      appRows.map((o) => o.customerEmail.toLowerCase().trim()).filter(Boolean)
    );
    const appEarnings =
      Math.round(appRows.reduce((s, o) => s + o.commission, 0) * 100) / 100;
    let usersOnApp: number | null = null;
    try {
      if (getAppIntegrationStatus().supabaseConfigured) {
        const { users } = await fetchAppUsers();
        const appEmails = new Set(users.map((u) => u.email).filter(Boolean));
        const myCustomerEmails = new Set(
          orders
            .filter((o) => o.matchType === "code" || o.matchType === "recurring")
            .map((o) => o.customerEmail.toLowerCase().trim())
            .filter(Boolean)
        );
        usersOnApp = [...myCustomerEmails].filter((e) => appEmails.has(e)).length;
      }
    } catch {
      // App stats are additive — never block the dashboard on them.
    }
    const appStats = {
      usersOnApp,
      subscribers: appSubscriberEmails.size,
      earnings: appEarnings,
    };

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

    return apiSuccess({
      stats,
      orders,
      payouts,
      series,
      granularity,
      preset,
      account: {
        commissionRate: affiliate.commissionRate,
        recurringCommissionRate: affiliate.recurringCommissionRate,
        couponRate: affiliate.couponRate,
        referralCommissionRate: affiliate.referralCommissionRate ?? 0,
        referredBy,
      },
      bonus,
      referralBreakdown,
      appStats,
    });
  } catch (err) {
    console.error("[api/affiliates/dashboard]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
