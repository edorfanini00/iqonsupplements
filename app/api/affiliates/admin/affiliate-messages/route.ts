import { listAdminThreads } from "@/lib/affiliates/messages-store";
import { listAffiliateDirectory } from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAdminBadgeSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminBadgeSession();
    if (isNextResponse(auth)) return auth;

    // Threads come back fully enriched (name/email/promo + counts) from one
    // query, and the unread total is derived from them — so a poll is a single
    // database operation. The recipient roster (for starting brand-new
    // conversations) is only needed on first load, requested via ?meta=1.
    const withMeta = new URL(request.url).searchParams.get("meta") === "1";

    const threads = await listAdminThreads();
    const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0);

    if (!withMeta) {
      return apiSuccess({ threads, unreadCount });
    }

    const directory = await listAffiliateDirectory();
    const recipients = directory
      .filter((a) => a.role === "affiliate")
      .map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        promoCode: a.promoCode,
        status: a.status,
      }));

    return apiSuccess({ threads, recipients, unreadCount });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/affiliate-messages GET]", err);
    return apiError("INTERNAL", "Failed to load conversations.", 500);
  }
}
