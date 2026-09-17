import { getCustomersForAffiliate, getOrdersForCustomer } from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requireAffiliateSession();
  if (isNextResponse(session)) return session;

  const affiliateId = sessionProfileId(session);
  const url = new URL(request.url);
  const customerKey = url.searchParams.get("customer");
  const customers = await getCustomersForAffiliate(affiliateId);

  if (customerKey) {
    const orders = await getOrdersForCustomer(affiliateId, customerKey);
    const customer = customers.find((c) => c.key === customerKey.toLowerCase());
    return apiSuccess({ customer, orders });
  }

  return apiSuccess({ customers });
}
