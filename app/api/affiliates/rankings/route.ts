/**
 * Affiliate-facing contest standing. Returns only the caller's own rank and
 * prize info — never other affiliates' numbers. The caller's own sales volume
 * is also hidden: they only get progress toward the qualifying minimum
 * (capped there once reached), so revenue figures never leave the server.
 */

import {
  getContestLeaderboard,
  getLastCycleWin,
  LEADERBOARD_RESET_DAY,
  LEADERBOARD_MIN_QUALIFYING_SALES,
} from "@/lib/affiliates/leaderboard";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAffiliateSession();
    if (isNextResponse(session)) return session;

    const affiliateId = sessionProfileId(session);
    const board = await getContestLeaderboard();
    const me = board.entries.find((e) => e.affiliateId === affiliateId);
    const rankedWithSales = board.entries.filter((e) => e.salesVolume > 0).length;

    // "You won" banner for the cycle that just closed — only during the first
    // week of the new cycle so it congratulates, then gets out of the way.
    const daysIntoCycle =
      (Date.now() - board.start.getTime()) / 86_400_000;
    const lastCycleWin =
      daysIntoCycle <= 7 ? await getLastCycleWin(affiliateId) : null;

    return apiSuccess({
      periodStart: board.start.toISOString(),
      periodEnd: board.end.toISOString(),
      resetDay: LEADERBOARD_RESET_DAY,
      prizes: board.prizes,
      lastCycleWin,
      qualifyingMinimum: LEADERBOARD_MIN_QUALIFYING_SALES,
      rank: me?.rank ?? null,
      totalRanked: board.entries.length,
      rankedWithSales,
      hasSales: (me?.salesVolume ?? 0) > 0,
      // Sales toward the prize minimum only — capped once qualified.
      qualifyProgress: Math.min(
        me?.salesVolume ?? 0,
        LEADERBOARD_MIN_QUALIFYING_SALES
      ),
      qualified: me?.qualified ?? false,
      prize: me?.prize ?? null,
    });
  } catch (err) {
    console.error("[api/affiliates/rankings]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
