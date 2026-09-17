import { getAllAffiliates } from "@/lib/affiliates/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  // Admins are valid referrers too: assigning the house (admin) account keeps
  // the referral cut in-house instead of paying it to another affiliate.
  const options = (await getAllAffiliates())
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

  return apiSuccess({ options });
}
