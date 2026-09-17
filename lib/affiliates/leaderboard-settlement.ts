import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { contestPeriod, cycleKeyFor, getContestLeaderboard, LEADERBOARD_MIN_QUALIFYING_SALES, type Leaderboard } from "./leaderboard";

type Period = { start: Date; end: Date };

/** Transaction retries encompass reads AND writes. Never retry a write alone. */
export async function settleLeaderboardCycle(period: Period, now = new Date()) {
  const canonical = contestPeriod(period.start);
  if (canonical.start.getTime() !== period.start.getTime() || canonical.end.getTime() !== period.end.getTime() || period.end > now) {
    throw new Error("Only a complete, closed contest cycle may be settled");
  }
  const cycleKey = cycleKeyFor(period.start);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const existing = await tx.leaderboardCycle.findUnique({ where: { cycleKey } });
        if (existing) return { cycleKey, created: false };
        // Config lookup deliberately fails closed. No defaults on query errors.
        const board = await getContestLeaderboard(now, period, tx);
        await tx.leaderboardCycle.create({ data: {
          cycleKey, start: period.start, end: period.end,
          snapshot: { version: 1, qualifyingMinimum: LEADERBOARD_MIN_QUALIFYING_SALES,
            prizes: board.prizes, entries: board.entries } as unknown as Prisma.InputJsonValue,
        } });
        for (const entry of board.entries) {
          if (!entry.qualified || entry.rank > 3 || !entry.prize || entry.prize <= 0) continue;
          // Reuse the existing bonus ledger: included in pending balances/manual
          // payout and reversal, excluded from attributed sales and order counts.
          await tx.affiliateOrder.create({ data: {
            affiliateId: entry.affiliateId,
            leaderboardCycleKey: cycleKey, leaderboardRank: entry.rank,
            orderId: `LEADERBOARD-${cycleKey}-${entry.rank}`,
            customerName: `Monthly leaderboard ${cycleKey} · #${entry.rank} prize`,
            customerEmail: "", orderTotal: 0, commission: entry.prize,
            matchType: "bonus", status: "pending", payoutId: null,
            createdAt: period.end,
          } });
        }
        return { cycleKey, created: true };
      }, { isolationLevel: "Serializable", timeout: 30_000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 4 || (code !== "P2034" && code !== "P2002")) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

/** Migration seeds the just-ended rollout cycle; subsequent missed cycles are
 * processed oldest first, including zero-winner cycles. Bounded per invocation. */
export async function settleEndedLeaderboardCycles(now = new Date()) {
  const state = await prisma.leaderboardSettlementState.findUniqueOrThrow({ where: { id: "default" } });
  const settled = await prisma.leaderboardCycle.findMany({ select: { cycleKey: true } });
  const keys = new Set(settled.map(c => c.cycleKey));
  const results: { cycleKey: string; created: boolean }[] = [];
  let period = contestPeriod(state.firstCycleStart);
  while (period.end <= now && results.length < 24) {
    if (!keys.has(cycleKeyFor(period.start))) results.push(await settleLeaderboardCycle(period, now));
    period = contestPeriod(period.end);
  }
  // Read persisted history even on an idempotent/no-op run, so operations can
  // verify the committed rankings and current manual-payment ledger state.
  const latest = await prisma.leaderboardCycle.findFirst({
    where: { end: { lte: now } }, orderBy: { end: "desc" },
    include: { awards: { select: { id: true, affiliateId: true, leaderboardRank: true, commission: true, status: true, payoutId: true } } },
  });
  const latestSnapshot = latest ? {
    ...latest,
    awardSummary: {
      count: latest.awards.length,
      total: latest.awards.reduce((sum, a) => sum + a.commission, 0),
      pending: latest.awards.filter(a => a.status === "pending").reduce((sum, a) => sum + a.commission, 0),
      paid: latest.awards.filter(a => a.status === "paid").reduce((sum, a) => sum + a.commission, 0),
    },
  } : null;
  return { cycles: results, hasMore: period.end <= now, latestSnapshot };
}

export async function getHistoricalLeaderboard(period: Period, now = new Date()) {
  const saved = await prisma.leaderboardCycle.findUnique({ where: { cycleKey: cycleKeyFor(period.start) } });
  if (saved) {
    const snapshot = saved.snapshot as unknown as { prizes: number[]; entries: Leaderboard["entries"]; qualifyingMinimum: number };
    return { start: saved.start, end: saved.end, ...snapshot, source: "snapshot" as const, settledAt: saved.settledAt.toISOString() };
  }
  return { ...await getContestLeaderboard(now, period), qualifyingMinimum: LEADERBOARD_MIN_QUALIFYING_SALES,
    source: period.end <= now ? "reconstructed" as const : "live" as const, settledAt: null };
}
