import {
  contestPeriod,
  cycleKeyFor,
  previousContestPeriod,
  setPrizesForCurrentCycle,
  LEADERBOARD_RESET_DAY,
  LEADERBOARD_MIN_QUALIFYING_SALES,
} from "@/lib/affiliates/leaderboard";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

import { prisma } from "@/lib/db/prisma";
import { zonedDate } from "@/lib/affiliates/time-series";
import { getHistoricalLeaderboard } from "@/lib/affiliates/leaderboard-settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const now = new Date();
    const current = contestPeriod(now);
    const currentKey = cycleKeyFor(current.start);
    const key = new URL(request.url).searchParams.get("cycle") ?? currentKey;
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(key) || key > currentKey) {
      return apiError("VALIDATION_ERROR", "Invalid or future contest cycle", 400);
    }
    const [year, month] = key.split("-").map(Number);
    const period = contestPeriod(zonedDate(year, month, 13));
    const [board, oldestOrder, snapshots] = await Promise.all([
      getHistoricalLeaderboard(period, now),
      prisma.affiliateOrder.findFirst({ where: { matchType: { in: ["code", "recurring"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.leaderboardCycle.findMany({ select: { cycleKey: true, start: true } }),
    ]);
    const floor = Math.min(previousContestPeriod(now).start.getTime(), oldestOrder?.createdAt.getTime() ?? Infinity, ...snapshots.map(s => s.start.getTime()));
    const availableCycles: { key: string; start: string; end: string }[] = [];
    let cursor = current;
    while (cursor.end.getTime() > floor && availableCycles.length < 1200) {
      availableCycles.push({ key: cycleKeyFor(cursor.start), start: cursor.start.toISOString(), end: cursor.end.toISOString() });
      cursor = previousContestPeriod(cursor.start);
    }
    return apiSuccess({
      cycleKey: key, currentCycleKey: currentKey, availableCycles,
      source: board.source, settledAt: board.settledAt,
      periodStart: board.start.toISOString(),
      periodEnd: board.end.toISOString(),
      resetDay: LEADERBOARD_RESET_DAY,
      prizes: board.prizes,
      qualifyingMinimum: board.qualifyingMinimum,
      entries: board.entries,
    });
  } catch (err) {
    console.error("[api/affiliates/admin/rankings]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

/** Update prize money for #1/#2/#3 from the current cycle onward. */
export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const body = (await request.json().catch(() => ({}))) as {
      prizes?: unknown;
    };
    const raw = Array.isArray(body.prizes) ? body.prizes : [];
    const prizes = raw.map((p) => Number(p));
    if (
      prizes.length !== 3 ||
      prizes.some((p) => !Number.isFinite(p) || p < 0 || p > 1_000_000 || Math.abs(p * 100 - Math.round(p * 100)) > 0.000001)
    ) {
      return apiError(
        "VALIDATION_ERROR",
        "Provide three prize amounts (0 or more) for #1, #2 and #3.",
        400
      );
    }
    if (prizes[0] < prizes[1] || prizes[1] < prizes[2]) {
      return apiError(
        "VALIDATION_ERROR",
        "Prizes must not increase down the ranks (#1 ≥ #2 ≥ #3).",
        400
      );
    }

    const saved = await setPrizesForCurrentCycle([
      prizes[0],
      prizes[1],
      prizes[2],
    ]);
    return apiSuccess({ prizes: saved });
  } catch (err) {
    console.error("[api/affiliates/admin/rankings] PATCH", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
