import { getAllAffiliates } from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const all = await getAllAffiliates();
    const affiliateMap = new Map(all.map((a) => [a.id, a]));

    const requests = all
    .filter((a) => a.role === "affiliate" && a.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((a) => {
      const referrer = a.referrerId ? affiliateMap.get(a.referrerId) : null;
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
        createdAt: a.createdAt,
        referralCommissionRate: a.referralCommissionRate ?? null,
        suggestedReferrer:
          referrer
            ? {
                id: referrer.id,
                name: `${referrer.firstName} ${referrer.lastName}`.trim(),
                promoCode: referrer.promoCode,
                source: "invite-link" as const,
              }
            : null,
      };
    });

  // Admins are valid referrers too, so the house account can take the
  // referral cut when nobody else referred the applicant.
  const referrerOptions = all
    .filter((a) => a.status === "active" || a.status === "pending")
    .map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`.trim(),
      promoCode: a.promoCode,
      isAdmin: a.role === "admin",
    }))
    .sort(
      (a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name)
    );

    return apiSuccess({ requests, referrerOptions });
  } catch (err) {
    console.error("[api/affiliates/admin/requests]", err);
    if (isPrismaConnectionError(err)) {
      return apiError(
        "SERVICE_UNAVAILABLE",
        "Affiliate database is unreachable. Check DATABASE_URL and restart the dev server.",
        503
      );
    }
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
