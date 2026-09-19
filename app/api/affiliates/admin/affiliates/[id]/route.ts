import {
  getAffiliateById,
  getAffiliateByPromoCode,
  getAffiliateStats,
  getOrdersForAffiliate,
  getPayoutsForAffiliate,
  updateAffiliate,

  deleteAffiliate,
  getAffiliateCategoryRates,
} from "@/lib/affiliates/store";
import { isReservedPromoNickname } from "@/lib/affiliates/commission";
import { retireShopifyCoupon, syncAffiliateCoupons } from "@/lib/affiliates/coupon-sync";
import { sendReferralAssignedEmail } from "@/lib/affiliates/mailer";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { ReferralValidationError } from "@/lib/affiliates/referrals";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const { id } = await context.params;
  const affiliate = await getAffiliateById(id);
  if (!affiliate || affiliate.role !== "affiliate") {
    return apiError("NOT_FOUND", "Not found", 404);
  }

  const categoryRates = await getAffiliateCategoryRates(id);

  return apiSuccess({
    affiliate: {
      id: affiliate.id,
      firstName: affiliate.firstName,
      lastName: affiliate.lastName,
      email: affiliate.email,
      phone: affiliate.phone,
      promoCode: affiliate.promoCode,
      instagram: affiliate.instagram,
      tiktok: affiliate.tiktok,
      website: affiliate.website,
      status: affiliate.status,
      commissionRate: affiliate.commissionRate,
      recurringCommissionRate: affiliate.recurringCommissionRate,
      couponRate: affiliate.couponRate,
      referrerId: affiliate.referrerId ?? null,
      referralCommissionRate: affiliate.referralCommissionRate ?? null,
      bonusThreshold: affiliate.bonusThreshold ?? null,
      bonusRate: affiliate.bonusRate ?? null,
      supplementsCommissionRate: categoryRates.supplementsCommissionRate,
      skincareCommissionRate: categoryRates.skincareCommissionRate,
      bankInfo: affiliate.bankInfo ?? null,
      createdAt: affiliate.createdAt,
    },
    stats: await getAffiliateStats(affiliate.id),
    orders: (await getOrdersForAffiliate(affiliate.id)).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    payouts: await getPayoutsForAffiliate(affiliate.id),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try { return await patchAffiliate(request, context); }
  catch (error) {
    if (error instanceof ReferralValidationError) return apiError("VALIDATION_ERROR", error.message, 400);
    throw error;
  }
}

async function patchAffiliate(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) {
    return apiError("RATE_LIMITED", "Too many requests.", 429);
  }

  const { id } = await context.params;
  const before = await getAffiliateById(id);
  if (!before) return apiError("NOT_FOUND", "Not found", 404);

  const body = await request.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "firstName",
    "lastName",
    "email",
    "phone",
    "instagram",
    "tiktok",
    "website",
    "status",
    "commissionRate",
    "recurringCommissionRate",
    "couponRate",
    "supplementsCommissionRate",
    "skincareCommissionRate",
    "bankInfo",
  ]) {
    if (key in body) allowed[key] = body[key];
  }

  // Monthly sales bonus: threshold + rate travel together. A missing/zero
  // threshold clears the whole program for this affiliate.
  if ("bonusThreshold" in body || "bonusRate" in body) {
    const threshold = Number(body.bonusThreshold);
    const rateValue = Number(body.bonusRate);
    const hasThreshold = Number.isFinite(threshold) && threshold > 0;
    const hasRate = Number.isFinite(rateValue) && rateValue > 0 && rateValue <= 100;
    if (hasThreshold && !hasRate) {
      return apiError(
        "VALIDATION_ERROR",
        "Set a bonus % between 0 and 100 to go with the sales target.",
        400
      );
    }
    if (hasThreshold && threshold > 10_000_000) {
      return apiError("VALIDATION_ERROR", "Bonus sales target is too large.", 400);
    }
    allowed.bonusThreshold = hasThreshold ? threshold : null;
    allowed.bonusRate = hasThreshold ? rateValue : null;
  }

  // Promo code rename: validated here, the new Shopify coupon is created (and the
  // old one retired) after the profile row is updated below.
  let promoCodeChanged = false;
  if ("promoCode" in body) {
    const newCode = String(body.promoCode ?? "").trim().toUpperCase();
    if (newCode !== before.promoCode.toUpperCase()) {
      if (!/^[A-Z0-9]{3,20}$/.test(newCode)) {
        return apiError(
          "VALIDATION_ERROR",
          "Promo code must be 3–20 letters/numbers with no spaces.",
          400
        );
      }
      if (isReservedPromoNickname(newCode)) {
        return apiError(
          "VALIDATION_ERROR",
          "That code uses a reserved brand term.",
          400
        );
      }
      const taken = await getAffiliateByPromoCode(newCode);
      if (taken && taken.id !== id) {
        return apiError(
          "VALIDATION_ERROR",
          `Code ${newCode} is already used by ${taken.firstName} ${taken.lastName}.`,
          400
        );
      }
      allowed.promoCode = newCode;
      promoCodeChanged = true;
    }
  }

  // Referrer (re)assignment — allowed at any time, even after approval.
  let newReferrer: Awaited<ReturnType<typeof getAffiliateById>> = null;
  let referrerChanged = false;
  let effectiveReferralRate = 5;
  if ("referrerId" in body) {
    if (body.referrerId !== null && typeof body.referrerId !== "string") return apiError("VALIDATION_ERROR", "Invalid referrer.", 400);
    if ("referralCommissionRate" in body && (typeof body.referralCommissionRate !== "number" || !Number.isFinite(body.referralCommissionRate) || body.referralCommissionRate < 0 || body.referralCommissionRate > 100)) return apiError("VALIDATION_ERROR", "Referral commission must be between 0 and 100.", 400);
    const newReferrerId =
      typeof body.referrerId === "string" && body.referrerId.trim()
        ? body.referrerId.trim()
        : null;

    if (newReferrerId) {
      if (newReferrerId === id) {
        return apiError("VALIDATION_ERROR", "An affiliate cannot refer themselves.", 400);
      }
      newReferrer = await getAffiliateById(newReferrerId);
      if (!newReferrer || !["active", "pending"].includes(newReferrer.status)) {
        return apiError("VALIDATION_ERROR", "Referrer must be an active or pending affiliate, or an admin.", 400);
      }
    }

    const rateInput =
      typeof body.referralCommissionRate === "number" &&
      body.referralCommissionRate >= 0 &&
      body.referralCommissionRate <= 100
        ? body.referralCommissionRate
        : undefined;
    effectiveReferralRate = rateInput ?? before.referralCommissionRate ?? 5;

    referrerChanged = (before.referrerId ?? null) !== newReferrerId;
    // Commit profile edits and the validated graph edge together. Historical
    // commission rows are deliberately never rewritten.
    allowed.referrerId = newReferrerId;
    if (newReferrerId || rateInput !== undefined) allowed.referralCommissionRate = newReferrerId ? effectiveReferralRate : rateInput;
  }

  const updated = await updateAffiliate(id, allowed);
  if (!updated) return apiError("NOT_FOUND", "Not found", 404);

  // With the profile now on the new code, create its Shopify coupon (same
  // discount rules) and retire the old coupon so it stops working at checkout.
  // Sales attribute by looking the coupon code up against the profile, so all
  // future orders credit this affiliate through the new code only.
  let couponWarning: string | null = null;
  if (promoCodeChanged || "couponRate" in body || "status" in body) {
    try {
      const sync = await syncAffiliateCoupons({ affiliateId: id });
      const result = sync.results[0];
      if (!sync.configured) {
        couponWarning = "Shopify is not configured; coupon was not created.";
      } else if (result && result.status === "error") {
        couponWarning = `New coupon could not be created: ${result.message}`;
      } else if (!result) {
        // syncAffiliateCoupons only covers active affiliates.
        couponWarning =
          "Coupon not created because the affiliate is not active; it will be created on activation via coupon sync.";
      }
    } catch (err) {
      couponWarning = err instanceof Error ? err.message : "Coupon sync failed";
    }

    const retire = (promoCodeChanged || updated.status!=="active") ? await retireShopifyCoupon(before.promoCode) : {ok:true,message:"Unchanged"};
    if (!retire.ok) {
      couponWarning = [
        couponWarning,
        `Old coupon ${before.promoCode} could not be removed: ${retire.message}`,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  // Tell the newly assigned referrer they now earn the referral cut on this
  // affiliate's sales. Skipped for the house (admin) account and no-op saves.
  if (referrerChanged && newReferrer && newReferrer.role !== "admin") {
    await sendReferralAssignedEmail(
      { firstName: newReferrer.firstName, email: newReferrer.email },
      {
        name: `${updated.firstName} ${updated.lastName}`.trim(),
        promoCode: updated.promoCode,
      },
      effectiveReferralRate
    ).catch((err) =>
      console.warn("[admin/affiliates PATCH] referral email failed", { id, err })
    );
  }

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "affiliate_update",
    targetAffiliateId: id,
    before,
    after: updated,
    request,
  });

  return apiSuccess({ couponWarning });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) {
    return apiError("RATE_LIMITED", "Too many requests.", 429);
  }

  const { id } = await context.params;
  const before = await getAffiliateById(id);
  if(before?.role==="affiliate" && before.status==="active"){const result=await retireShopifyCoupon(before.promoCode);if(!result.ok)return apiError("COUPON_SYNC_FAILED",result.message,502);}
  const ok = await deleteAffiliate(id);
  if (!ok) return apiError("NOT_FOUND", "Not found", 404);

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "affiliate_delete",
    targetAffiliateId: id,
    before,
    request,
  });

  return apiSuccess({});
}
