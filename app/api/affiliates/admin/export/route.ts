import {
  getAllAffiliates,
  getAllOrders,
  getAllPayouts,
} from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const body = rows
    .map((r) => headers.map((h) => csvEscape(r[h])).join(","))
    .join("\n");
  return `${headers.join(",")}\n${body}`;
}

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "orders";
  const affiliateMap = new Map((await getAllAffiliates()).map((a) => [a.id, a]));

  let csv = "";
  let filename = "export.csv";

  if (type === "orders") {
    const rows = (await getAllOrders()).map((o) => {
      const a = affiliateMap.get(o.affiliateId);
      return {
        order_id: o.orderId,
        affiliate_name: a ? `${a.firstName} ${a.lastName}`.trim() : "",
        affiliate_email: a?.email ?? "",
        promo_code: a?.promoCode ?? "",
        customer_name: o.customerName,
        customer_email: o.customerEmail,
        order_total: o.orderTotal,
        commission: o.commission,
        match_type: o.matchType,
        status: o.status,
        created_at: o.createdAt,
      };
    });
    csv = toCsv(rows);
    filename = `iqon-affiliate-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "payouts") {
    const rows = (await getAllPayouts()).map((p) => {
      const a = affiliateMap.get(p.affiliateId);
      return {
        payout_id: p.id,
        affiliate_name: a ? `${a.firstName} ${a.lastName}`.trim() : "",
        affiliate_email: a?.email ?? "",
        amount: p.amount,
        method: p.method,
        reference: p.reference ?? "",
        notes: p.notes ?? "",
        order_count: p.orderIds.length,
        paid_at: p.paidAt,
      };
    });
    csv = toCsv(rows);
    filename = `iqon-affiliate-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "affiliates") {
    const rows = (await getAllAffiliates())
      .filter((a) => a.role === "affiliate")
      .map((a) => ({
        first_name: a.firstName,
        last_name: a.lastName,
        email: a.email,
        phone: a.phone,
        promo_code: a.promoCode,
        status: a.status,
        commission_rate: a.commissionRate,
        coupon_rate: a.couponRate,
        bank_name: a.bankInfo?.bankName ?? "",
        account_holder: a.bankInfo?.accountHolder ?? "",
        account_type: a.bankInfo?.accountType ?? "",
        routing_number: a.bankInfo?.routingNumber ?? "",
        account_last4: a.bankInfo?.accountNumber
          ? a.bankInfo.accountNumber.slice(-4)
          : "",
        paypal_email: a.bankInfo?.paypalEmail ?? "",
        zelle: a.bankInfo?.zelle ?? "",
        created_at: a.createdAt,
      }));
    csv = toCsv(rows);
    filename = `iqon-affiliates-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    return apiError("VALIDATION_ERROR", "Invalid export type", 400);
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
