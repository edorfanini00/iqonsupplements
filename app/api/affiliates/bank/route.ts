import { getAffiliateById, getAffiliateByEmail, maskBankInfo } from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import type { BankInfo } from "@/lib/affiliates/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAffiliateSession();
  if (isNextResponse(session)) return session;

  const affiliate = session.profile ?? (await getAffiliateById(sessionProfileId(session)));
  if (!affiliate) return apiError("NOT_FOUND", "Not found", 404);

  return apiSuccess({
    bankInfo: maskBankInfo(affiliate.bankInfo) ?? null,
    hasBankInfo: Boolean(affiliate.bankInfo),
  });
}

export async function PUT(request: Request) {
  const session = await requireAffiliateSession();
  if (isNextResponse(session)) return session;

  const affiliateId = sessionProfileId(session);
  const body = (await request.json().catch(() => ({}))) as Partial<BankInfo>;

  const sanitized: BankInfo = {
    accountHolder: body.accountHolder?.toString().trim() || undefined,
    bankName: body.bankName?.toString().trim() || undefined,
    routingNumber: body.routingNumber?.toString().trim() || undefined,
    accountNumber: body.accountNumber?.toString().trim() || undefined,
    accountType:
      body.accountType === "savings" || body.accountType === "checking"
        ? body.accountType
        : undefined,
    country: body.country?.toString().trim() || undefined,
    paypalEmail: body.paypalEmail?.toString().trim() || undefined,
    zelle: body.zelle?.toString().trim() || undefined,
    notes: body.notes?.toString().trim() || undefined,
  };

  const { updateAffiliateBankInfo } = await import("@/lib/affiliates/store");
  const updated = await updateAffiliateBankInfo(affiliateId, sanitized);
  if (!updated) return apiError("NOT_FOUND", "Not found", 404);

  return apiSuccess({ bankInfo: maskBankInfo(updated.bankInfo) });
}
