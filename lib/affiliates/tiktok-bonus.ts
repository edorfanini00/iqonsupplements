/**
 * TikTok bonus program — streak-based, on fixed 30-day cycles.
 *
 * Cycles are 30 days each, anchored at July 23, 2026 (Eastern midnight): the
 * counter resets to zero at each cycle boundary. The goal is fixed — 15
 * TikToks per cycle. Hitting it pays a reward that climbs the longer the
 * affiliate keeps the streak alive: the admin sets the amount for each
 * consecutive streak cycle from the dashboard (cycle 1 is $100 by default).
 * Missing the goal for a cycle breaks the streak — the next hit starts over
 * at cycle 1's reward.
 *
 * When a cycle closes, `materializeTikTokBonuses` writes a synthetic
 * `affiliate_orders` row with matchType "bonus" (orderId TIKTOK-C{index}) so
 * the money flows through the normal payout pipeline: pending balances, the
 * admin payouts page, and payout recording.
 *
 * Server-only.
 */

import { prisma } from "@/lib/db/prisma";
import { zonedDate, BUSINESS_TIME_ZONE } from "@/lib/affiliates/time-series";

/** Videos required per cycle — fixed; only the reward ladder is editable. */
export const TIKTOK_MONTHLY_GOAL = 15;

/** Length of a bonus cycle. The counter resets at each boundary. */
export const TIKTOK_CYCLE_DAYS = 30;

const CYCLE_MS = TIKTOK_CYCLE_DAYS * 86_400_000;

/** Cycle 0 starts July 23, 2026 at midnight Eastern ("starting today"). */
const CYCLE_ANCHOR = zonedDate(2026, 7, 23, 0);

/** Reward for the first month on a streak (and the reset value). */
export const TIKTOK_BASE_REWARD = 100;

/** How many past cycles streaks are traced through. */
const STREAK_LOOKBACK_CYCLES = 24;

const CONFIG_ID = "default";
const MAX_LADDER_STEPS = 24;

const TIKTOK_HOST_RE = /^([a-z0-9-]+\.)*tiktok\.com$/;

/**
 * Strict TikTok link validation + canonicalization. Only links that point at
 * actual TikTok content are accepted:
 *
 *   - tiktok.com/@user/video/123… (and /photo/ posts)
 *   - tiktok.com/t/CODE and vm.tiktok.com/CODE / vt.tiktok.com/CODE share links
 *   - legacy m.tiktok.com/v/123….html
 *
 * Profile pages, the TikTok homepage and anything off tiktok.com are
 * rejected. Returns the canonical form (protocol/host normalized, tracking
 * query params and hash stripped) so the per-affiliate unique constraint
 * catches the same video shared with different parameters — or null when the
 * link isn't recognized as TikTok content.
 */
export function normalizeTiktokUrl(raw: string): string | null {
  const input = raw.trim();
  if (!input || input.length > 500) return null;

  // Be forgiving about a missing protocol ("www.tiktok.com/…" pastes fine).
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // Reject userinfo tricks like https://tiktok.com@evil.com/…
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (!TIKTOK_HOST_RE.test(host)) return null;

  const path = url.pathname.replace(/\/+$/, "");

  // App share short links: vm.tiktok.com/CODE, vt.tiktok.com/CODE
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    const short = path.match(/^\/([A-Za-z0-9]{5,})$/);
    return short ? `https://${host}/${short[1]}` : null;
  }

  // Full post links: /@user/video/ID or /@user/photo/ID
  const post = path.match(/^\/(@[A-Za-z0-9._-]{1,60})\/(video|photo)\/(\d{5,})$/);
  if (post) {
    return `https://www.tiktok.com/${post[1]}/${post[2]}/${post[3]}`;
  }

  // Web share short links: /t/CODE
  const webShort = path.match(/^\/t\/([A-Za-z0-9]{5,})$/);
  if (webShort) return `https://www.tiktok.com/t/${webShort[1]}`;

  // Legacy mobile links: /v/ID(.html)
  const legacy = path.match(/^\/v\/(\d{5,})(?:\.html)?$/);
  if (legacy) return `https://www.tiktok.com/v/${legacy[1]}`;

  return null;
}

/**
 * The reward ladder: index 0 = 1st month on a streak, index 1 = 2nd
 * consecutive month, etc. Streaks longer than the ladder pay the last step.
 */
export async function getTikTokLadder(): Promise<number[]> {
  try {
    const row = await prisma.tikTokBonusConfig.findUnique({
      where: { id: CONFIG_ID },
    });
    if (row) {
      const parsed: unknown = JSON.parse(row.amountsJson);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
      ) {
        return parsed as number[];
      }
    }
  } catch (err) {
    console.error("[tiktok-bonus] ladder config lookup failed", err);
  }
  return [TIKTOK_BASE_REWARD];
}

export async function setTikTokLadder(amounts: number[]): Promise<number[]> {
  const clean = amounts.map((n) => Math.round(n * 100) / 100);
  if (
    clean.length === 0 ||
    clean.length > MAX_LADDER_STEPS ||
    clean.some((n) => !Number.isFinite(n) || n <= 0 || n > 100_000)
  ) {
    throw new Error("Invalid ladder amounts");
  }
  const amountsJson = JSON.stringify(clean);
  await prisma.tikTokBonusConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, amountsJson },
    update: { amountsJson },
  });
  return clean;
}

/** Reward for a 1-based streak month, clamped to the ladder's last step. */
export function rewardForStreakMonth(ladder: number[], streakMonth: number): number {
  const idx = Math.min(Math.max(streakMonth, 1), ladder.length) - 1;
  return ladder[idx] ?? TIKTOK_BASE_REWARD;
}

export interface TikTokCycle {
  /** 0-based cycle number since the July 23, 2026 anchor. */
  index: number;
  start: Date;
  end: Date;
  /** Stable id used in bonus order ids, e.g. "C3". */
  key: string;
  /** Human label, e.g. "Jul 23 – Aug 21". */
  label: string;
  /** Whole days until the counter resets (0 once the cycle has ended). */
  daysLeft: number;
}

const CYCLE_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "short",
  day: "numeric",
});

function cycleIndexFor(now: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - CYCLE_ANCHOR.getTime()) / CYCLE_MS)
  );
}

function cycleAt(index: number, now: Date): TikTokCycle {
  const start = new Date(CYCLE_ANCHOR.getTime() + index * CYCLE_MS);
  const end = new Date(start.getTime() + CYCLE_MS);
  const lastDay = new Date(end.getTime() - 86_400_000);
  return {
    index,
    start,
    end,
    key: `C${index}`,
    label: `${CYCLE_LABEL_FMT.format(start)} – ${CYCLE_LABEL_FMT.format(lastDay)}`,
    daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000)),
  };
}

/** The running 30-day cycle. */
export function currentTiktokCycle(now: Date = new Date()): TikTokCycle {
  return cycleAt(cycleIndexFor(now), now);
}

/** The cycle that just closed relative to `now`, or null before any closed. */
export function previousTiktokCycle(now: Date = new Date()): TikTokCycle | null {
  const index = cycleIndexFor(now);
  if (index === 0) return null;
  return cycleAt(index - 1, now);
}

/**
 * Streaks entering the cycle that contains `at`: for each affiliate, how many
 * consecutive cycles immediately before it hit the goal. 0 = fresh start, so
 * that cycle is streak position `value + 1`.
 */
export async function getStreaksEnteringCycle(
  at: Date = new Date()
): Promise<Map<string, number>> {
  const index = cycleIndexFor(at);
  const streaks = new Map<string, number>();
  if (index === 0) return streaks;

  const lookback = Math.min(index, STREAK_LOOKBACK_CYCLES);
  const windowStart = new Date(
    CYCLE_ANCHOR.getTime() + (index - lookback) * CYCLE_MS
  );
  const windowEnd = new Date(CYCLE_ANCHOR.getTime() + index * CYCLE_MS);
  const rows = await prisma.tikTokSubmission.findMany({
    where: { createdAt: { gte: windowStart, lt: windowEnd } },
    select: { affiliateId: true, createdAt: true },
  });

  // affiliateId → cycle index → count
  const counts = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const rowIndex = Math.floor(
      (row.createdAt.getTime() - CYCLE_ANCHOR.getTime()) / CYCLE_MS
    );
    const byCycle = counts.get(row.affiliateId) ?? new Map<number, number>();
    byCycle.set(rowIndex, (byCycle.get(rowIndex) ?? 0) + 1);
    counts.set(row.affiliateId, byCycle);
  }

  for (const [affiliateId, byCycle] of counts) {
    let streak = 0;
    for (let i = index - 1; i >= index - lookback; i--) {
      if ((byCycle.get(i) ?? 0) >= TIKTOK_MONTHLY_GOAL) streak += 1;
      else break;
    }
    streaks.set(affiliateId, streak);
  }
  return streaks;
}

export interface TikTokMaterializeResult {
  cycleKey: string;
  cycleLabel: string;
  checked: number;
  created: {
    affiliateId: string;
    name: string;
    submissions: number;
    streakMonth: number;
    bonus: number;
  }[];
  alreadyRecorded: number;
  belowTarget: number;
}

/**
 * Record the just-closed cycle's earned TikTok bonuses as pending commission
 * rows. The reward is the ladder step for the affiliate's streak position —
 * consecutive goal-hitting cycles ending with the closed one. Idempotent:
 * each affiliate gets at most one row per cycle (orderId TIKTOK-C{index}),
 * so this is safe to run daily.
 */
export async function materializeTikTokBonuses(
  now: Date = new Date()
): Promise<TikTokMaterializeResult> {
  const period = previousTiktokCycle(now);
  if (!period) {
    // Still inside the very first cycle — nothing has closed yet.
    return {
      cycleKey: "none",
      cycleLabel: "",
      checked: 0,
      created: [],
      alreadyRecorded: 0,
      belowTarget: 0,
    };
  }
  const bonusOrderId = `TIKTOK-${period.key}`;
  const ladder = await getTikTokLadder();

  const grouped = await prisma.tikTokSubmission.groupBy({
    by: ["affiliateId"],
    where: { createdAt: { gte: period.start, lt: period.end } },
    _count: { _all: true },
  });

  const result: TikTokMaterializeResult = {
    cycleKey: period.key,
    cycleLabel: period.label,
    checked: grouped.length,
    created: [],
    alreadyRecorded: 0,
    belowTarget: 0,
  };
  if (grouped.length === 0) return result;

  // Streaks entering the closed cycle, so the closed cycle itself is
  // streak position (entering streak + 1) for affiliates that hit the goal.
  const streaksEntering = await getStreaksEnteringCycle(period.start);

  const ids = grouped.map((g) => g.affiliateId);
  const profiles = await prisma.affiliateProfile.findMany({
    where: { id: { in: ids }, portalRole: "affiliate", status: "active" },
    select: { id: true, firstName: true, lastName: true },
  });
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const existing = await prisma.affiliateOrder.findMany({
    where: { affiliateId: { in: ids }, matchType: "bonus", orderId: bonusOrderId },
    select: { affiliateId: true },
  });
  const alreadyDone = new Set(existing.map((e) => e.affiliateId));

  for (const group of grouped) {
    const profile = profileById.get(group.affiliateId);
    if (!profile) continue;
    if (alreadyDone.has(group.affiliateId)) {
      result.alreadyRecorded += 1;
      continue;
    }
    const submissions = group._count._all;
    if (submissions < TIKTOK_MONTHLY_GOAL) {
      result.belowTarget += 1;
      continue;
    }
    const streakMonth = (streaksEntering.get(group.affiliateId) ?? 0) + 1;
    const bonus = rewardForStreakMonth(ladder, streakMonth);

    await prisma.affiliateOrder.create({
      data: {
        affiliateId: group.affiliateId,
        orderId: bonusOrderId,
        customerName: `TikTok bonus ${period.label} (${submissions} videos · streak ${streakMonth})`,
        customerEmail: "",
        // No order total — this is a flat bonus, not a sale.
        orderTotal: 0,
        commission: bonus,
        matchType: "bonus",
        status: "pending",
        // Dated just inside the earned cycle so range filters group it there.
        createdAt: new Date(period.end.getTime() - 1000),
      },
    });
    result.created.push({
      affiliateId: group.affiliateId,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      submissions,
      streakMonth,
      bonus,
    });
  }

  return result;
}
