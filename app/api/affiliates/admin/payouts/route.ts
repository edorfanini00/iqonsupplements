import {
  getAllPayouts,
  getAllAffiliates,
  getAffiliateById,
  recordPayout,
  PayoutValidationError,
  getOrdersForAffiliate,
  getAffiliateOrdersByIds,
  type PayoutMethod,
} from "@/lib/affiliates/store";
import { sendPayoutEmail } from "@/lib/affiliates/mailer";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

const VALID_METHODS: readonly PayoutMethod[] = ["bank", "paypal", "zelle", "other"];

export async function GET() {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const affiliateMap = new Map((await getAllAffiliates()).map((a) => [a.id, a]));

  const rawPayouts = (await getAllPayouts()).sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );

  // Load the orders settled by each payout so the admin UI can expand a payout
  // and show exactly which orders were paid and how much commission for each.
  const allOrderIds = [...new Set(rawPayouts.flatMap((p) => p.orderIds))];
  const orderMap = new Map(
    (await getAffiliateOrdersByIds(allOrderIds)).map((o) => [o.id, o])
  );

  const payouts = rawPayouts.map((p) => {
    const a = affiliateMap.get(p.affiliateId);
    const orders = p.orderIds
      .map((oid) => orderMap.get(oid))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .sort(
        (x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
      )
      .map((o) => ({
        id: o.id,
        orderId: o.orderId,
        shopifyOrderId: o.shopifyOrderId ?? null,
        customerName: o.customerName,
        matchType: o.matchType,
        orderTotal: o.orderTotal,
        commission: o.commission,
        couponCode: o.couponCode ?? null,
        createdAt: o.createdAt,
      }));
    return {
      ...p,
      affiliateName: a ? `${a.firstName} ${a.lastName}`.trim() : "Unknown",
      affiliateCode: a?.promoCode ?? "—",
      orders,
    };
  });

  const pendingByAffiliate = await Promise.all(
    (await getAllAffiliates())
      .filter((a) => a.role === "affiliate")
      .map(async (a) => {
        const orders = await getOrdersForAffiliate(a.id);
        const pendingOrders = orders
          .filter((o) => o.status === "pending")
          .sort(
            (x, y) =>
              new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
          );
        const pending = pendingOrders.reduce((s, o) => s + o.commission, 0);
        return {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`.trim(),
          promoCode: a.promoCode,
          pendingCommission: pending,
          pendingOrders: pendingOrders.length,
          bankInfoOnFile: Boolean(a.bankInfo),
          orders: pendingOrders.map((o) => ({
            id: o.id,
            orderId: o.orderId,
            shopifyOrderId: o.shopifyOrderId ?? null,
            customerName: o.customerName,
            matchType: o.matchType,
            orderTotal: o.orderTotal,
            commission: o.commission,
            couponCode: o.couponCode ?? null,
            createdAt: o.createdAt,
          })),
        };
      })
  );

  pendingByAffiliate.sort((a, b) => b.pendingCommission - a.pendingCommission);
  return apiSuccess({ payouts, pendingByAffiliate });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError("VALIDATION_ERROR", "Invalid payout payload", 400);
  }
  const { affiliateId, amount, method, orderIds, reference, notes, paidAt } = body;
  if (typeof affiliateId !== "string" || !affiliateId.trim() ||
      (amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)) ||
      (orderIds !== undefined && (!Array.isArray(orderIds) || !orderIds.length || orderIds.some((id: unknown) => typeof id !== "string" || !id) || new Set(orderIds).size !== orderIds.length)) ||
      [reference, notes, paidAt].some(value => value !== undefined && typeof value !== "string") ||
      (paidAt !== undefined && !Number.isFinite(new Date(paidAt).getTime()))) {
    return apiError("VALIDATION_ERROR", "Invalid payout fields or unpaid earnings selection", 400);
  }
  if (!affiliateId) {
    return apiError("VALIDATION_ERROR", "affiliateId is required", 400);
  }
  if (!VALID_METHODS.includes(method)) {
    return apiError("VALIDATION_ERROR", "Invalid payout method", 400);
  }

  let payout;
  try {
    payout = await recordPayout({
    affiliateId,
    amount: typeof amount === "number" ? amount : undefined,
    method,
    orderIds: Array.isArray(orderIds) ? orderIds : undefined,
    reference: reference || undefined,
    notes: notes || undefined,
    paidAt: paidAt || undefined,
    createdByPortalUserId: session.portalUserId,
    });
  } catch (error) {
    if (error instanceof PayoutValidationError) return apiError("VALIDATION_ERROR", error.message, 400);
    if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "")) {
      return apiError("CONFLICT", "Earnings changed or were already paid; refresh and retry", 409);
    }
    console.error("[affiliates/admin/payouts] recording failed", error);
    return apiError("INTERNAL_ERROR", "Could not record payout", 500);
  }

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "payout_record",
    targetAffiliateId: affiliateId,
    after: payout,
    request,
  });

  const affiliate = await getAffiliateById(affiliateId);
  if (affiliate && affiliate.notifyOnPayout !== false) {
    await sendPayoutEmail({
      firstName: affiliate.firstName,
      email: affiliate.email,
      amount: payout.amount,
      method: payout.method,
      reference: payout.reference,
      paidAt: payout.paidAt,
      orderCount: payout.orderIds?.length ?? 0,
    });
  }

  return apiSuccess({ payout });
}
