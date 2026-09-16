import {
  getAffiliateById,
  updateAffiliate,
  deleteAffiliate,
  isPromoCodeTaken,
} from "@/lib/affiliates/store";
import {
  sendApprovalEmail,
  sendAffiliateRejectionEmail,
  sendReferralAcceptedEmail,
} from "@/lib/affiliates/mailer";
import { provisionAffiliatePortalUser } from "@/lib/affiliates/portal-account";
import { syncAffiliateCoupon } from "@/lib/affiliates/coupon-sync";
import { ensureWelcomeCoupon } from "@/lib/affiliates/welcome-coupon";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { writeAuditLog } from "@/lib/affiliates/audit";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { validateReferrer, ReferralValidationError } from "@/lib/affiliates/referrals";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try { return await approve(request, context); }
  catch (error) {
    if (error instanceof ReferralValidationError) return apiError("VALIDATION_ERROR", error.message, 400);
    return apiError("INTERNAL_ERROR", "Approval could not be completed. Please try again.", 500);
  }
}

async function approve(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

  const { id } = await context.params;
  const affiliate = await getAffiliateById(id);
  if (!affiliate || affiliate.role !== "affiliate") {
    return apiError("NOT_FOUND", "Not found", 404);
  }
  if (affiliate.status !== "pending") {
    return apiError("INVALID_STATE", "This affiliate is not pending review.", 400);
  }

  const body = (await request.json().catch(() => ({}))) as {
    commissionRate?: number;
    recurringCommissionRate?: number;
    couponRate?: number;
    referrerId?: string | null;
    referralCommissionRate?: number;
    promoCode?: string;
    bonusThreshold?: number;
    bonusRate?: number;
  };

  // Admin can edit the code the applicant asked for before it goes live.
  // Normalized to letters/digits uppercase — the same shape signup produces.
  let promoCode = affiliate.promoCode;
  if (typeof body.promoCode === "string" && body.promoCode.trim()) {
    const cleaned = body.promoCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!cleaned || cleaned.length > 40) {
      return apiError("VALIDATION_ERROR", "Promo code must be 1–40 letters or digits.", 400);
    }
    if (
      cleaned !== affiliate.promoCode.toUpperCase() &&
      (await isPromoCodeTaken(cleaned))
    ) {
      return apiError("CONFLICT", `Promo code "${cleaned}" is already taken.`, 409);
    }
    promoCode = cleaned;
  }

  for (const key of ["commissionRate", "recurringCommissionRate", "couponRate", "bonusRate"] as const) {
    const value=body[key]; if(value!==undefined && (typeof value!=="number" || !Number.isFinite(value) || value<0 || value>100)) return apiError("VALIDATION_ERROR", "Rates must be between 0 and 100%.",400);
  }
  const commissionRate =
    typeof body.commissionRate === "number" && body.commissionRate >= 0
      ? body.commissionRate
      : affiliate.commissionRate;
  const recurringCommissionRate =
    typeof body.recurringCommissionRate === "number" &&
    body.recurringCommissionRate >= 0
      ? body.recurringCommissionRate
      : affiliate.recurringCommissionRate;
  const couponRate =
    typeof body.couponRate === "number" && body.couponRate >= 0
      ? body.couponRate
      : affiliate.couponRate;

  // Optional monthly sales bonus set up during onboarding: both values must be
  // present and positive for the program to be active.
  const bonusThresholdInput = Number(body.bonusThreshold);
  const bonusRateInput = Number(body.bonusRate);
  const hasBonus =
    Number.isFinite(bonusThresholdInput) &&
    bonusThresholdInput > 0 &&
    Number.isFinite(bonusRateInput) &&
    bonusRateInput > 0 &&
    bonusRateInput <= 100;

  if ("referrerId" in body && body.referrerId !== null && typeof body.referrerId !== "string") {
    return apiError("VALIDATION_ERROR", "Invalid referrer.", 400);
  }
  const referrerId = "referrerId" in body
    ? body.referrerId?.trim() || null
    : affiliate.referrerId ?? null;
  if ("referralCommissionRate" in body && (typeof body.referralCommissionRate !== "number" || !Number.isFinite(body.referralCommissionRate) || body.referralCommissionRate < 0 || body.referralCommissionRate > 100)) {
    return apiError("VALIDATION_ERROR", "Referral commission must be between 0 and 100.", 400);
  }
  const referralCommissionRate = referrerId
    ? body.referralCommissionRate ?? affiliate.referralCommissionRate ?? 5
    : affiliate.referralCommissionRate;
  await validateReferrer(id, referrerId, async (refId) => {
    const r = await getAffiliateById(refId);
    return r ? { ...r, portalRole: r.role, referrerId: r.referrerId ?? null } : null;
  });

  if (!affiliate.portalUserId) return apiError("INVALID_STATE", "Create the affiliate’s portal login before approval.", 409);
  const candidate = {...affiliate, status:"active" as const, commissionRate, recurringCommissionRate, couponRate, promoCode, referrerId:referrerId??undefined, referralCommissionRate};
  try {
    const synced=await syncAffiliateCoupon(candidate);
    if(synced.status==="error"||synced.status==="missing") return apiError("COUPON_SYNC_FAILED",synced.message??"Discount could not be created.",502);
  } catch {return apiError("COUPON_SYNC_FAILED","Connect Shopify and retry. This application remains pending.",502);}
  const updated = await updateAffiliate(id, {
    status:"active",commissionRate,recurringCommissionRate,couponRate,referrerId,referralCommissionRate,promoCode,reviewedAt:new Date().toISOString(),
    ...(hasBonus?{bonusThreshold:bonusThresholdInput,bonusRate:bonusRateInput}:{})
  });
  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "affiliate_approve",
    targetAffiliateId: id,
    before: affiliate,
    after: updated,
    request,
  });

  let referrerName: string | undefined;
  let referrerEmail: string | undefined;
  let referrerFirstName: string | undefined;
  if (referrerId) {
    const r = await getAffiliateById(referrerId);
    if (r) {
      referrerName = `${r.firstName} ${r.lastName}`.trim();
      // Skip the "referral accepted" email when the referrer is the admin —
      // the admin just performed the approval themselves.
      if (r.role === "affiliate") {
        referrerEmail = r.email;
        referrerFirstName = r.firstName;
      }
    }
  }

  const [emailResult, referrerEmailResult] = await Promise.all([
    sendApprovalEmail({
      firstName: updated?.firstName ?? affiliate.firstName,
      email: updated?.email ?? affiliate.email,
      promoCode: updated?.promoCode ?? affiliate.promoCode,
      commissionRate,
      couponRate,
      referrerName,

    }),
    referrerEmail && referrerFirstName && referralCommissionRate != null
      ? sendReferralAcceptedEmail(
          { firstName: referrerFirstName, email: referrerEmail },
          {
            name: `${updated?.firstName ?? affiliate.firstName} ${
              updated?.lastName ?? affiliate.lastName
            }`.trim(),
            promoCode: updated?.promoCode ?? affiliate.promoCode,
          },
          referralCommissionRate
        )
      : Promise.resolve(null),
  ]);

  return apiSuccess({ email: emailResult, referrerEmail: referrerEmailResult });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
  if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

  const { id } = await context.params;
  const affiliate = await getAffiliateById(id);
  if (!affiliate || affiliate.status !== "pending") {
    return apiError("NOT_FOUND", "Not found", 404);
  }

  await sendAffiliateRejectionEmail({
    firstName: affiliate.firstName,
    email: affiliate.email,
  });

  await updateAffiliate(id,{status:"disabled",reviewedAt:new Date().toISOString()});

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: "affiliate_reject",
    targetAffiliateId: id,
    before: affiliate,
    request,
  });

  return apiSuccess({});
}
