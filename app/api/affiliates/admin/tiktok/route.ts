/**
 * TikTok bonus — admin monitoring and reward ladder.
 *
 * GET   → every active affiliate with their video count for the 30-day
 *         cycle, streak position and the reward they're playing for
 *         (?period=current|previous), including the submitted links.
 * PATCH → update the reward ladder (amount per consecutive streak cycle).
 */

import { prisma } from "@/lib/db/prisma";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import {
  currentTiktokCycle,
  getStreaksEnteringCycle,
  getTikTokLadder,
  previousTiktokCycle,
  rewardForStreakMonth,
  setTikTokLadder,
  TIKTOK_CYCLE_DAYS,
  TIKTOK_MONTHLY_GOAL,
} from "@/lib/affiliates/tiktok-bonus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period") === "previous"
      ? "previous"
      : "current";
    // Before the first cycle has closed, "previous" falls back to the
    // current one so the toggle never breaks.
    const window =
      periodParam === "previous"
        ? previousTiktokCycle() ?? currentTiktokCycle()
        : currentTiktokCycle();

    const [affiliates, submissions, ladder, streaksEntering] =
      await Promise.all([
        prisma.affiliateProfile.findMany({
          where: { portalRole: "affiliate", status: "active" },
          select: { id: true, firstName: true, lastName: true, promoCode: true },
        }),
        prisma.tikTokSubmission.findMany({
          where: { createdAt: { gte: window.start, lt: window.end } },
          orderBy: { createdAt: "desc" },
          select: { id: true, affiliateId: true, url: true, createdAt: true },
        }),
        getTikTokLadder(),
        // Streaks entering the viewed cycle, so its reward step is streak + 1.
        getStreaksEnteringCycle(window.start),
      ]);

    const byAffiliate = new Map<
      string,
      { id: string; url: string; createdAt: string }[]
    >();
    for (const s of submissions) {
      const list = byAffiliate.get(s.affiliateId) ?? [];
      list.push({ id: s.id, url: s.url, createdAt: s.createdAt.toISOString() });
      byAffiliate.set(s.affiliateId, list);
    }

    const entries = affiliates
      .map((a) => {
        const subs = byAffiliate.get(a.id) ?? [];
        const count = subs.length;
        const hit = count >= TIKTOK_MONTHLY_GOAL;
        const streakMonth = (streaksEntering.get(a.id) ?? 0) + 1;
        return {
          affiliateId: a.id,
          name: `${a.firstName} ${a.lastName}`.trim(),
          promoCode: a.promoCode ?? "",
          count,
          hit,
          streakMonth,
          reward: rewardForStreakMonth(ladder, streakMonth),
          submissions: subs,
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return apiSuccess({
      period: periodParam,
      cycleLabel: window.label,
      cycleDays: TIKTOK_CYCLE_DAYS,
      daysLeft: window.daysLeft,
      goal: TIKTOK_MONTHLY_GOAL,
      ladder,
      totalSubmissions: submissions.length,
      totalBonus: entries.reduce((acc, e) => acc + (e.hit ? e.reward : 0), 0),
      entries,
    });
  } catch (err) {
    console.error("[admin/tiktok] GET failed", err);
    return apiError("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-tiktok-ladder", 20, 60_000);
    if (!rate.allowed) {
      return apiError("RATE_LIMITED", "Too many requests — try again shortly.", 429);
    }

    const body = (await request.json().catch(() => ({}))) as {
      amounts?: unknown;
    };
    if (!Array.isArray(body.amounts)) {
      return apiError("VALIDATION_ERROR", "Send the reward amounts as a list.", 400);
    }
    const amounts = body.amounts.map((n) => Number(n));
    if (
      amounts.length === 0 ||
      amounts.length > 24 ||
      amounts.some((n) => !Number.isFinite(n) || n <= 0 || n > 100_000)
    ) {
      return apiError(
        "VALIDATION_ERROR",
        "Each streak cycle needs a reward between $1 and $100,000.",
        400
      );
    }

    const ladder = await setTikTokLadder(amounts);
    return apiSuccess({ ladder });
  } catch (err) {
    console.error("[admin/tiktok] PATCH failed", err);
    return apiError("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
