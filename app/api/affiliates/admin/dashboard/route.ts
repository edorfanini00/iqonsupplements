import {
  getAdminStats,
  getAllAffiliates,
  getAllOrders,
  getAllPayouts,
  getAffiliateRanking,
  getTimeSeries,
  resolveRange,
} from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { getStoreRevenueSummary } from "@/lib/portal-commerce";
import { toShopifyLocalDate } from "@/lib/affiliates/time-series";
import { fetchAppRevenueChart } from "@/lib/app-portal/analytics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const url = new URL(request.url);
    const {
      start,
      end,
      granularity,
      value: preset,
    } = resolveRange(url.searchParams.get("range"));
    const range = { start: start.toISOString(), end: end.toISOString() };

    const stats = await getAdminStats(range);
    const everyone = await getAllAffiliates();
    // House (admin) referral commissions are never paid out, so they don't
    // belong on the commission trend either.
    const adminIds = new Set(
      everyone.filter((a) => a.role === "admin").map((a) => a.id)
    );
    const affiliates = everyone
      .filter((a) => a.role === "affiliate")
      .map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        promoCode: a.promoCode,
        status: a.status,
        commissionRate: a.commissionRate,
        couponRate: a.couponRate,
        createdAt: a.createdAt,
      }));
    const allOrders = await getAllOrders();
    // A single sale can produce a primary row plus a "referral" mirror row
    // (referrer's cut) carrying the same order total, and "bonus" rows are
    // commission-only. Only direct sales contribute revenue to the chart —
    // otherwise the affiliate-revenue line double-counts referred sales.
    const chartOrders = allOrders.map((o) => ({
      createdAt: o.createdAt,
      orderTotal:
        o.matchType === "code" || o.matchType === "recurring" ? o.orderTotal : 0,
      commission: adminIds.has(o.affiliateId) ? 0 : o.commission,
    }));
    const recentOrders = [...allOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
    const ranking = await getAffiliateRanking(range);
    const series = await getTimeSeries({ start, end, granularity });
    const payouts = (await getAllPayouts())
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .slice(0, 25);

    // Store-wide revenue/orders (all processing + completed orders) from
    // Shopify, so the dashboard can show total store revenue with an
    // affiliate breakout. Falls back to null if Shopify is unreachable — the rest
    // of the dashboard still renders from local data.
    let storeStats: {
      totalRevenue: number;
      totalOrders: number;
      truncated: boolean;
    } | null = null;
    // Per-order (date, total) pairs so the trend chart can plot store-wide
    // total revenue alongside affiliate revenue and commission.
    let storeChartOrders: { createdAt: string; total: number }[] = [];
    try {
      // Shopify compares after/before against store-local (Eastern) order dates,
      // so send Eastern wall-clock strings rather than UTC instants.
      const summary = await getStoreRevenueSummary({
        after: toShopifyLocalDate(start),
        before: toShopifyLocalDate(end),
      });
      storeStats = {
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        truncated: summary.truncated,
      };
      storeChartOrders = summary.orders.map((o) => ({
        createdAt: o.dateCreated,
        total: o.total,
      }));
    } catch (err) {
      console.error("[api/affiliates/admin/dashboard] store revenue", err);
    }

    // SUPPLEMENTS_APP app revenue for the same range (RevenueCat): range total plus the
    // daily series for the trend chart. Null when the integration isn't
    // configured or RevenueCat is unreachable — the overview simply omits the
    // app/combined breakdown in that case.
    let appRevenue: number | null = null;
    let appRevenueSeries: { date: string; value: number }[] = [];
    try {
      const appChart = await fetchAppRevenueChart(start, end);
      if (appChart) {
        appRevenue = appChart.total;
        appRevenueSeries = appChart.points;
      }
    } catch (err) {
      console.error("[api/affiliates/admin/dashboard] app revenue", err);
    }

    return apiSuccess({
      stats,
      storeStats,
      storeChartOrders,
      appRevenue,
      appRevenueSeries,
      affiliates,
      chartOrders,
      recentOrders,
      ranking,
      series,
      granularity,
      payouts,
      preset,
    });
  } catch (err) {
    console.error("[api/affiliates/admin/dashboard]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
