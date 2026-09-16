import { syncAffiliateCoupons } from "@/lib/affiliates/coupon-sync";
import { writeAuditLog } from "@/lib/affiliates/audit";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const dryRun = true;
  const result = await syncAffiliateCoupons({ dryRun });
  return apiSuccess(result);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (isNextResponse(session)) return session;

  const rate = await enforceRateLimit(request, "affiliates-coupon-sync", 5, 60_000);
  if (!rate.allowed) {
    return apiError("RATE_LIMITED", "Too many sync requests.", 429);
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const affiliateId = url.searchParams.get("affiliate_id") ?? undefined;

  const result = await syncAffiliateCoupons({ dryRun, affiliateId });
  if (!result.configured) {
    return apiError("NOT_CONFIGURED", "Shopify credentials are not configured.", 400);
  }

  await writeAuditLog({
    actorPortalUserId: session.portalUserId,
    actorEmail: session.email,
    action: dryRun ? "coupon_sync_dry_run" : "coupon_sync",
    after: { summary: result.results },
    request,
  });

  return apiSuccess(result);
}
