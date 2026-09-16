/**
 * Affiliate of the month — monthly sales-volume contest.
 *
 * The contest cycle resets on the 13th of each month (Eastern time): the
 * current period runs from the most recent 13th at 00:00 ET to the next
 * 13th, and every affiliate starts each period from zero. Rankings count
 * the affiliate's own attributed sales (code + recurring order revenue);
 * referral cuts from other people's sales are excluded on purpose.
 *
 * Server-only.
 */

import { prisma } from "@/lib/db/prisma";
import { zonedDate, BUSINESS_TIME_ZONE } from "@/lib/affiliates/time-series";

/** Day of the month (ET) the contest resets. */
export const LEADERBOARD_RESET_DAY = 13;

/** Default prize money for ranks #1, #2, #3 (used until the admin edits). */
export const LEADERBOARD_PRIZES = [500, 100, 50] as const;

/** Minimum sales volume in a cycle to qualify for a prize. */
export const LEADERBOARD_MIN_QUALIFYING_SALES = 1500;

const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Current contest window: most recent reset day → next reset day (ET). */
export function contestPeriod(now: Date = new Date()): { start: Date; end: Date } {
  const parts = DAY_FMT.formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");

  if (day >= LEADERBOARD_RESET_DAY) {
    return {
      start: zonedDate(year, month, LEADERBOARD_RESET_DAY),
      end: zonedDate(year, month + 1, LEADERBOARD_RESET_DAY),
    };
  }
  return {
    start: zonedDate(year, month - 1, LEADERBOARD_RESET_DAY),
    end: zonedDate(year, month, LEADERBOARD_RESET_DAY),
  };
}

/** The contest cycle that ended when the current one started. */
export function previousContestPeriod(
  now: Date = new Date()
): { start: Date; end: Date } {
  const { start } = contestPeriod(now);
  return contestPeriod(new Date(start.getTime() - 86_400_000));
}

/** Stable identifier for the cycle containing `start`, e.g. "2026-07". */
export function cycleKeyFor(start: Date): string {
  const parts = DAY_FMT.formatToParts(start);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return `${get("year")}-${String(get("month")).padStart(2, "0")}`;
}

/**
 * Prizes for the cycle starting at `start`: the config set in that cycle, or
 * the most recent earlier one, or the defaults. String ordering works because
 * cycle keys are zero-padded YYYY-MM.
 */
export async function getPrizesForPeriod(start: Date, db: Pick<typeof prisma, "leaderboardPrizeConfig" | "affiliateProfile" | "affiliateOrder"> = prisma): Promise<number[]> {
  const row = await db.leaderboardPrizeConfig.findFirst({
    where: { cycleKey: { lte: cycleKeyFor(start) } }, orderBy: { cycleKey: "desc" },
  });
  const prizes = row ? [row.first, row.second, row.third] : [...LEADERBOARD_PRIZES];
  validatePrizes(prizes);
  return prizes;
}

export function validatePrizes(prizes: number[]) {
  if (prizes.length !== 3 || prizes.some(p => !Number.isFinite(p) || p < 0 || p > 1_000_000 || Math.abs(p * 100 - Math.round(p * 100)) > 0.000001) || prizes[0] < prizes[1] || prizes[1] < prizes[2]) {
    throw new Error("Invalid leaderboard prize configuration");
  }
}

/** Set the prizes from the current cycle onward. */
export async function setPrizesForCurrentCycle(
  prizes: [number, number, number],
  now: Date = new Date()
): Promise<number[]> {
  validatePrizes(prizes);
  const key = cycleKeyFor(contestPeriod(now).start);
  const row = await prisma.leaderboardPrizeConfig.upsert({
    where: { cycleKey: key },
    create: { cycleKey: key, first: prizes[0], second: prizes[1], third: prizes[2] },
    update: { first: prizes[0], second: prizes[1], third: prizes[2] },
  });
  return [row.first, row.second, row.third];
}

export interface LeaderboardEntry {
  affiliateId: string;
  name: string;
  promoCode: string;
  salesVolume: number;
  orders: number;
  rank: number;
  /** Met the minimum sales volume to be eligible for a prize. */
  qualified: boolean;
  /** Prize money for this rank, only while the rank holder qualifies. */
  prize: number | null;
}

export interface Leaderboard {
  start: Date;
  end: Date;
  /** Prize money for ranks #1..#3, as configured for this cycle. */
  prizes: number[];
  entries: LeaderboardEntry[];
}

export async function getContestLeaderboard(
  now: Date = new Date(),
  periodOverride?: { start: Date; end: Date },
  db: Pick<typeof prisma, "leaderboardPrizeConfig" | "affiliateProfile" | "affiliateOrder"> = prisma
): Promise<Leaderboard> {
  const { start, end } = periodOverride ?? contestPeriod(now);
  const prizes = await getPrizesForPeriod(start, db);

  const [profiles, orderRows] = await Promise.all([
    db.affiliateProfile.findMany({
      where: { portalRole: "affiliate", status: "active" },
      select: { id: true, firstName: true, lastName: true, promoCode: true },
    }),
    db.affiliateOrder.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        matchType: { in: ["code", "recurring"] },
      },
      select: { affiliateId: true, orderTotal: true },
    }),
  ]);

  const totals = new Map<string, { volume: number; orders: number }>();
  for (const row of orderRows) {
    const t = totals.get(row.affiliateId) ?? { volume: 0, orders: 0 };
    t.volume += row.orderTotal;
    t.orders += 1;
    totals.set(row.affiliateId, t);
  }

  const entries = profiles
    .map((p) => {
      const t = totals.get(p.id);
      return {
        affiliateId: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
        promoCode: p.promoCode,
        salesVolume: Math.round((t?.volume ?? 0) * 100) / 100,
        orders: t?.orders ?? 0,
      };
    })
    .sort(
      (a, b) => b.salesVolume - a.salesVolume || a.name.localeCompare(b.name) || a.affiliateId.localeCompare(b.affiliateId)
    )
    .map((e, i) => {
      const qualified = e.salesVolume >= LEADERBOARD_MIN_QUALIFYING_SALES;
      return {
        ...e,
        rank: i + 1,
        qualified,
        prize: i < prizes.length && qualified ? prizes[i] : null,
      };
    });

  return { start, end, prizes, entries };
}

/**
 * The caller's win in the cycle that just ended, if any — used for the
 * "you won, congratulations" banner shown at the start of the new cycle.
 */
export async function getLastCycleWin(
  affiliateId: string,
  now: Date = new Date()
): Promise<{ rank: number; prize: number; endedAt: string } | null> {
  const period = previousContestPeriod(now);
  const { getHistoricalLeaderboard } = await import("./leaderboard-settlement");
  const board = await getHistoricalLeaderboard(period, now);
  if (board.source !== "snapshot") return null;
  const me = board.entries.find((e) => e.affiliateId === affiliateId);
  if (!me || me.rank > 3 || !me.qualified || !me.prize) return null;
  return { rank: me.rank, prize: me.prize, endedAt: period.end.toISOString() };
}
