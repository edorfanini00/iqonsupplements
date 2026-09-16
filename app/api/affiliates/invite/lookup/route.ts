import { getAffiliateById, getAffiliateByPromoCode } from "@/lib/affiliates/store";
import { apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref")?.trim();
  if (!ref) {
    return apiSuccess({ referrer: null });
  }

  const a = (await getAffiliateByPromoCode(ref)) ?? (await getAffiliateById(ref)) ?? null;
  if (!a || a.role !== "affiliate" || (a.status !== "active" && a.status !== "pending")) {
    return apiSuccess({ referrer: null });
  }

  return apiSuccess({
    referrer: {
      id: a.id,
      name: `${a.firstName} ${a.lastName}`.trim(),
      promoCode: a.promoCode,
    },
  });
}
