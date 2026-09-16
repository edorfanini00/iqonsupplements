import {
  getAffiliateById,
  getCustomersForAffiliate,
  getOrdersForCustomer,
  getRecruitmentNetwork,
} from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { getInviteUrl } from "@/lib/affiliates/mailer";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const { id } = await context.params;
  const affiliate = await getAffiliateById(id);
  if (!affiliate) return apiError("NOT_FOUND", "Not found", 404);

  const url = new URL(request.url);
  const customerKey = url.searchParams.get("customer");
  const customers = await getCustomersForAffiliate(id);
  const network = await getRecruitmentNetwork(id);
  const referees = network.referees;

  const affiliatePayload = {
    id: affiliate.id,
    inviteUrl: getInviteUrl(affiliate.id),
    name: `${affiliate.firstName} ${affiliate.lastName}`.trim(),
    promoCode: affiliate.promoCode,
  };

  if (customerKey) {
    const orders = await getOrdersForCustomer(id, customerKey);
    const customer = customers.find((c) => c.key === customerKey.toLowerCase());
    return apiSuccess({ affiliate: affiliatePayload, customer, orders, referees });
  }

  return apiSuccess({ affiliate: affiliatePayload, customers, referees, network });
}
