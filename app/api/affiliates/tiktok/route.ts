/**
 * TikTok bonus — affiliate side.
 *
 * GET  → this month's submissions, goal progress, streak and current reward.
 * POST → submit a TikTok link (counts toward the current ET month).
 */

import { prisma } from "@/lib/db/prisma";
import {
  isNextResponse,
  requireAffiliateSession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import {
  currentTiktokCycle,
  getStreaksEnteringCycle,
  getTikTokLadder,
  normalizeTiktokUrl,
  rewardForStreakMonth,
  TIKTOK_BASE_REWARD,
  TIKTOK_CYCLE_DAYS,
  TIKTOK_MONTHLY_GOAL,
} from "@/lib/affiliates/tiktok-bonus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function cyclePayload(affiliateId: string) {
  const cycle = currentTiktokCycle();
  const [submissions, ladder, streaks] = await Promise.all([
    prisma.tikTokSubmission.findMany({
      where: {
        affiliateId,
        createdAt: { gte: cycle.start, lt: cycle.end },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, createdAt: true },
    }),
    getTikTokLadder(),
    getStreaksEnteringCycle(),
  ]);
  const count = submissions.length;
  // This cycle is streak position (consecutive hit cycles before it) + 1.
  const streakMonth = (streaks.get(affiliateId) ?? 0) + 1;
  const reward = rewardForStreakMonth(ladder, streakMonth);
  return {
    cycleLabel: cycle.label,
    cycleDays: TIKTOK_CYCLE_DAYS,
    daysLeft: cycle.daysLeft,
    goal: TIKTOK_MONTHLY_GOAL,
    count,
    hit: count >= TIKTOK_MONTHLY_GOAL,
    reward,
    baseReward: TIKTOK_BASE_REWARD,
    streakMonth,
    nextReward: rewardForStreakMonth(ladder, streakMonth + 1),
    submissions: submissions.map((s) => ({
      id: s.id,
      url: s.url,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export async function GET() {
  try {
    const session = await requireAffiliateSession();
    if (isNextResponse(session)) return session;
    const affiliateId = sessionProfileId(session);

    return apiSuccess(await cyclePayload(affiliateId));
  } catch (err) {
    console.error("[affiliates/tiktok] GET failed", err);
    return apiError("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAffiliateSession();
    if (isNextResponse(session)) return session;
    const affiliateId = sessionProfileId(session);

    const rate = await enforceRateLimit(request, "tiktok-submit", 30, 60_000);
    if (!rate.allowed) {
      return apiError("RATE_LIMITED", "Too many requests — try again shortly.", 429);
    }

    const body = (await request.json().catch(() => ({}))) as { url?: unknown };
    const raw = typeof body.url === "string" ? body.url.trim() : "";
    if (!raw) {
      return apiError("VALIDATION_ERROR", "Paste the link to your TikTok.", 400);
    }
    // Strict: only links to actual TikTok posts count, stored in canonical
    // form so the same video can't be resubmitted with different tracking
    // parameters.
    const url = normalizeTiktokUrl(raw);
    if (!url) {
      return apiError(
        "VALIDATION_ERROR",
        "That's not a TikTok video link. Open your TikTok, tap Share → Copy link, and paste it here (it looks like tiktok.com/@you/video/… or vm.tiktok.com/…).",
        400
      );
    }

    try {
      await prisma.tikTokSubmission.create({
        data: { affiliateId, url },
      });
    } catch (err) {
      // Unique constraint: same link submitted before.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        return apiError(
          "DUPLICATE",
          "You already submitted this TikTok link.",
          409
        );
      }
      throw err;
    }

    return apiSuccess(await cyclePayload(affiliateId));
  } catch (err) {
    console.error("[affiliates/tiktok] POST failed", err);
    return apiError("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
