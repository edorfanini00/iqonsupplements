/**
 * Monthly sales bonus — target + rate set per affiliate by the admin.
 *
 * The bonus period is the calendar month in Eastern time. When a month closes,
 * `materializeMonthlyBonuses` checks every active affiliate with a bonus
 * program: if their own attributed sales (code + recurring, referral cuts
 * excluded) reached the target, a synthetic `affiliate_orders` row with
 * matchType "bonus" is created for rate % of the month's volume. From there
 * the bonus flows through the normal pipeline automatically: pending payout
 * balances, the admin payouts page, and payout recording.
 *
 * Server-only.
 */

import { prisma } from "@/lib/db/prisma";
import { zonedDate, BUSINESS_TIME_ZONE } from "@/lib/affiliates/time-series";

const MONTH_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
});

function monthOf(now: Date): { year: number; month: number } {
  const parts = MONTH_FMT.formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month") };
}

/** Current calendar month window in Eastern time — the running bonus period. */
export function bonusMonthPeriod(now: Date = new Date()): { start: Date; end: Date } {
  const { year, month } = monthOf(now);
  return { start: zonedDate(year, month, 1), end: zonedDate(year, month + 1, 1) };
}

/** The month that just closed relative to `now` (ET). */
export function previousBonusMonth(now: Date = new Date()): {
  start: Date;
  end: Date;
  key: string;
  label: string;
} {
  const { year, month } = monthOf(now);
  const start = zonedDate(year, month - 1, 1);
  const end = zonedDate(year, month, 1);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return {
    start,
    end,
    key: `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TIME_ZONE,
      month: "long",
      year: "numeric",
    }).format(start),
  };
}

export interface BonusMaterializeResult {
  monthKey: string;
  checked: number;
  created: { affiliateId: string; name: string; volume: number; bonus: number }[];
  alreadyRecorded: number;
  belowTarget: number;
}

/**
 * Record last month's earned bonuses as pending commission rows. Idempotent —
 * safe to run any number of times after the month closes; each affiliate gets
 * at most one bonus row per month (orderId BONUS-YYYY-MM).
 */
export async function materializeMonthlyBonuses(
  now: Date = new Date()
): Promise<BonusMaterializeResult> {
  const period = previousBonusMonth(now);
  const bonusOrderId = `BONUS-${period.key}`;

  const candidates = await prisma.affiliateProfile.findMany({
    where: {
      portalRole: "affiliate",
      status: "active",
      bonusThreshold: { gt: 0 },
      bonusRate: { gt: 0 },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bonusThreshold: true,
      bonusRate: true,
    },
  });

  const result: BonusMaterializeResult = {
    monthKey: period.key,
    checked: candidates.length,
    created: [],
    alreadyRecorded: 0,
    belowTarget: 0,
  };
  if (candidates.length === 0) return result;

  const orderRows = await prisma.affiliateOrder.findMany({
    where: {
      affiliateId: { in: candidates.map((c) => c.id) },
      createdAt: { gte: period.start, lt: period.end },
      matchType: { in: ["code", "recurring"] },
    },
    select: { affiliateId: true, orderTotal: true },
  });
  const volumes = new Map<string, number>();
  for (const row of orderRows) {
    volumes.set(row.affiliateId, (volumes.get(row.affiliateId) ?? 0) + row.orderTotal);
  }

  const existing = await prisma.affiliateOrder.findMany({
    where: {
      affiliateId: { in: candidates.map((c) => c.id) },
      matchType: "bonus",
      orderId: bonusOrderId,
    },
    select: { affiliateId: true },
  });
  const alreadyDone = new Set(existing.map((e) => e.affiliateId));

  for (const candidate of candidates) {
    if (alreadyDone.has(candidate.id)) {
      result.alreadyRecorded += 1;
      continue;
    }
    const volume = Math.round((volumes.get(candidate.id) ?? 0) * 100) / 100;
    if (volume < (candidate.bonusThreshold ?? Infinity)) {
      result.belowTarget += 1;
      continue;
    }
    const bonus = Math.round(volume * (candidate.bonusRate ?? 0)) / 100;
    if (bonus <= 0) {
      result.belowTarget += 1;
      continue;
    }

    await prisma.affiliateOrder.create({
      data: {
        affiliateId: candidate.id,
        orderId: bonusOrderId,
        customerName: `${period.label} sales bonus`,
        customerEmail: "",
        // orderTotal stays 0 so revenue stats never double-count the month's
        // sales; the volume lives in the description and the commission field
        // carries the actual bonus money.
        orderTotal: 0,
        commission: bonus,
        matchType: "bonus",
        status: "pending",
        // Dated just inside the earned month so range filters group it there.
        createdAt: new Date(period.end.getTime() - 1000),
      },
    });
    result.created.push({
      affiliateId: candidate.id,
      name: `${candidate.firstName} ${candidate.lastName}`.trim(),
      volume,
      bonus,
    });
  }

  return result;
}
