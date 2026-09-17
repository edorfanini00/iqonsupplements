import { countUnreadForAffiliate } from "@/lib/affiliates/messages-store";
import {
  isNextResponse,
  requireAffiliateBadgeSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

/** Lightweight unread count for the affiliate sidebar badge (no side effects). */
export async function GET() {
  try {
    const auth = await requireAffiliateBadgeSession();
    if (isNextResponse(auth)) return auth;

    const unreadCount = await countUnreadForAffiliate(auth.profileId);
    return apiSuccess({ unreadCount });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/messages/unread GET]", err);
    return apiError("INTERNAL", "Failed to load unread count.", 500);
  }
}
