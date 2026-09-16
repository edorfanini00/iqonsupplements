import {
  isNextResponse,
  requireAdminBadgeSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { prisma } from "@/lib/db/prisma";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

/**
 * Consolidated sidebar badge counts for admins. All counts are computed in a
 * SINGLE database round trip via subqueries (one billed Prisma operation), and
 * the session is authorized from the signed snapshot cookie (no DB lookup).
 * This is the most frequent admin poll, so collapsing it to one query is the
 * biggest remaining saving.
 *
 * pendingPayouts = affiliates (non-admin) with at least one unpaid commission
 * row — the same "awaiting payout" set shown on the Payouts page. Clears when
 * those commissions are recorded as paid.
 */
export async function GET() {
  try {
    const auth = await requireAdminBadgeSession();
    if (isNextResponse(auth)) return auth;

    const rows = await prisma.$queryRaw<
      Array<{
        pending: number;
        contact: number;
        chat: number;
        payouts: number;
      }>
    >`
      SELECT
        (SELECT count(*)::int FROM affiliate_profiles
           WHERE portal_role = 'affiliate' AND status = 'pending') AS pending,
        (SELECT count(*)::int FROM contact_messages
           WHERE status = 'new') AS contact,
        (SELECT count(*)::int FROM affiliate_messages
           WHERE sender_role = 'affiliate' AND read_by_admin = false) AS chat,
        (SELECT count(DISTINCT o.affiliate_id)::int
           FROM affiliate_orders o
           INNER JOIN affiliate_profiles p ON p.id = o.affiliate_id
           WHERE o.status = 'pending'
             AND o.commission > 0
             AND p.portal_role <> 'admin') AS payouts
    `;
    const row = rows[0];

    return apiSuccess({
      pendingRequests: Number(row?.pending ?? 0),
      unreadMessages: Number(row?.contact ?? 0),
      unreadAffiliateMessages: Number(row?.chat ?? 0),
      pendingPayouts: Number(row?.payouts ?? 0),
    });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/badges]", err);
    return apiError("INTERNAL", "Failed to load badges.", 500);
  }
}
