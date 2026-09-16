import { getAffiliateSession } from "@/lib/affiliates/session";
import { getAffiliateByPortalUserId, getAffiliateByEmail } from "@/lib/affiliates/store";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { getInviteUrl } from "@/lib/affiliates/mailer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getAffiliateSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    let profile =
      session.profile ??
      (await getAffiliateByPortalUserId(session.portalUserId)) ??
      (session.email ? await getAffiliateByEmail(session.email) : null);

    if (session.role === "admin" && !profile) {
      return apiSuccess({
        user: {
          id: String(session.portalUserId),
          firstName: "",
          lastName: "",
          email: session.email,
          phone: "",
          promoCode: "",
          role: "admin",
          status: "active",
          commissionRate: 0,
          couponRate: 0,
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (session.role === "shop_manager" && !profile) {
      return apiSuccess({
        user: {
          id: String(session.portalUserId),
          firstName: "",
          lastName: "",
          email: session.email,
          phone: "",
          promoCode: "",
          role: "shop_manager",
          status: "active",
          commissionRate: 0,
          couponRate: 0,
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (!profile) {
      return apiError("UNAUTHORIZED", "Affiliate profile not found", 401);
    }

    return apiSuccess({
      user: {
        id: profile.id,
        inviteUrl: getInviteUrl(profile.id),
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        promoCode: profile.promoCode,
        instagram: profile.instagram,
        tiktok: profile.tiktok,
        website: profile.website,
        role: session.role,
        status: profile.status,
        commissionRate: profile.commissionRate,
        recurringCommissionRate: profile.recurringCommissionRate,
        couponRate: profile.couponRate,
        createdAt: profile.createdAt,
      },
    });
  } catch (err) {
    console.error("[api/affiliates/me]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
