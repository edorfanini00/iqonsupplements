/**
 * GET /api/affiliates/admin/orders — store orders (processing, completed,
 * pending payment, on hold, refunded) with line items, totals, and the
 * affiliate (if any) attributed to them. Orders come live from Shopify; affiliate
 * attribution is cross-joined from the local AffiliateOrder table by Shopify
 * order id. The client filters by status and defaults to paid orders only.
 */

import {
  getAllAffiliates,
  getAllOrders,
  resolveRange,
} from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { listPaidOrders } from "@/lib/portal-commerce";
import { toShopifyLocalDate } from "@/lib/affiliates/time-series";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const url = new URL(request.url);
    const { start, end, value: preset } = resolveRange(
      url.searchParams.get("range")
    );

    const [shopifyResult, historyResult, localOrders, affiliates] = await Promise.all([
      // Shopify compares after/before against store-local (Eastern) order dates.
      // Pending/on-hold are included so the UI can filter by payment status;
      // the client defaults to paid (processing + completed) views.
      listPaidOrders({
        after: toShopifyLocalDate(start),
        before: toShopifyLocalDate(end),
        statuses: ["processing", "completed", "pending", "on-hold", "refunded"],
        // meta_data carries the "_iqon_returned" flag set by the refund action.
        fields:
          "id,status,currency,total,date_created,date_paid,billing,line_items,coupon_lines,meta_data",
      }),
      // Lightweight full paid history (email + date only) so each order can be
      // classified as the customer's first ("new") or a repeat ("recurring").
      listPaidOrders({ fields: "id,billing,date_created" }),
      getAllOrders(),
      getAllAffiliates(),
    ]);

    // Earliest paid order per customer email.
    const firstOrder = new Map<string, { id: number; time: number }>();
    for (const h of historyResult.orders) {
      const email = h.billing?.email?.toLowerCase().trim();
      if (!email) continue;
      const time = new Date(h.date_created ?? 0).getTime();
      const prev = firstOrder.get(email);
      if (!prev || time < prev.time || (time === prev.time && h.id < prev.id)) {
        firstOrder.set(email, { id: h.id, time });
      }
    }

    /** "new" when this is the customer's earliest paid order we know of. */
    const customerType = (o: {
      id: number;
      billing?: { email?: string };
      date_created?: string;
    }): "new" | "recurring" => {
      const email = o.billing?.email?.toLowerCase().trim();
      if (!email) return "new";
      const first = firstOrder.get(email);
      if (!first) return "new";
      if (first.id === o.id) return "new";
      const time = new Date(o.date_created ?? 0).getTime();
      return time > first.time || (time === first.time && o.id > first.id)
        ? "recurring"
        : "new";
    };

    const affById = new Map(affiliates.map((a) => [a.id, a]));
    // shopifyOrderId -> attribution, using the direct (non-referral) row so the
    // affiliate credited with the sale is shown, not the referrer mirror.
    // `affiliateId` lets the UI preselect the current affiliate; `locked` marks
    // orders whose commission is already settled in a payout (can't reassign).
    const attribution = new Map<
      number,
      {
        affiliateId: string;
        name: string;
        promoCode: string;
        commission: number;
        matchType: string;
        locked: boolean;
      }
    >();
    for (const o of localOrders) {
      if (o.shopifyOrderId == null || o.matchType === "referral") continue;
      if (attribution.has(o.shopifyOrderId)) continue;
      const a = affById.get(o.affiliateId);
      attribution.set(o.shopifyOrderId, {
        affiliateId: o.affiliateId,
        name: a ? `${a.firstName} ${a.lastName}`.trim() : o.customerName,
        promoCode: a?.promoCode ?? o.couponCode ?? "",
        commission: o.commission,
        matchType: o.matchType,
        locked: o.status === "paid",
      });
    }
    // A referral row can be settled even when the primary is still pending;
    // treat the whole order as locked if ANY of its rows is paid out.
    for (const o of localOrders) {
      if (o.shopifyOrderId == null || o.status !== "paid") continue;
      const existing = attribution.get(o.shopifyOrderId);
      if (existing) existing.locked = true;
    }

    const orders = shopifyResult.orders.map((o) => ({
      id: o.id,
      status: o.status,
      date: o.date_paid || o.date_created,
      total: o.total,
      currency: o.currency ?? "USD",
      customerName: `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim(),
      customerEmail: o.billing?.email ?? "",
      items: (o.line_items ?? []).map((li) => ({
        name: li.name ?? `#${li.product_id}`,
        quantity: li.quantity,
        total: li.total ?? "",
      })),
      couponCodes: (o.coupon_lines ?? [])
        .map((c) => c.code)
        .filter((c): c is string => Boolean(c)),
      customerType: customerType(o),
      returned: (o.meta_data ?? []).some(
        (m) => m.key === "_iqon_returned" && String(m.value) === "yes"
      ),
      affiliate: attribution.get(o.id) ?? null,
    }));

    // Active affiliates for the manual-attribution picker (id, name, code).
    const affiliateOptions = affiliates
      .filter((a) => a.role === "affiliate" && a.status === "active")
      .map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`.trim(),
        promoCode: a.promoCode,
      }))
      .sort((x, y) => x.name.localeCompare(y.name));

    return apiSuccess({
      orders,
      affiliates: affiliateOptions,
      truncated: shopifyResult.truncated,
      preset,
    });
  } catch (err) {
    console.error("[api/affiliates/admin/orders]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
