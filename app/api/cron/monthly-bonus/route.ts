import { sharedJobAuthorityGuard } from '@/lib/affiliates/job-authority';
/**
 * Monthly bonus cron.
 *
 * Runs daily (see vercel.json). Sales bonuses materialize once the Eastern
 * calendar month closes; TikTok bonuses materialize once a 30-day cycle
 * closes. Both are idempotent — re-runs skip anything already recorded, so
 * the daily schedule just means each period pays out the morning after it
 * ends.
 */

import { jsonNoCache } from "@/lib/api-cache-headers";
import { materializeMonthlyBonuses } from "@/lib/affiliates/bonus";
import { materializeTikTokBonuses } from "@/lib/affiliates/tiktok-bonus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.SUPPLEMENTS_CRON_SECRET?.trim();
  // Vercel Cron attaches this header to its internal invocations.

  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  // Canonical Health alone owns ingestion, settlement and scheduled sends.
  const authorityGuard = sharedJobAuthorityGuard();
  if (authorityGuard) return authorityGuard;
  if (!isAuthorized(request)) {
    return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sales = await materializeMonthlyBonuses();
    console.log("[cron/monthly-bonus] sales", {
      monthKey: sales.monthKey,
      checked: sales.checked,
      created: sales.created.length,
      alreadyRecorded: sales.alreadyRecorded,
      belowTarget: sales.belowTarget,
    });
    const tiktok = await materializeTikTokBonuses();
    console.log("[cron/monthly-bonus] tiktok", {
      cycleKey: tiktok.cycleKey,
      checked: tiktok.checked,
      created: tiktok.created.length,
      alreadyRecorded: tiktok.alreadyRecorded,
      belowTarget: tiktok.belowTarget,
    });
    return jsonNoCache({ ok: true, sales, tiktok });
  } catch (err) {
    console.error("[cron/monthly-bonus]", err);
    return jsonNoCache({ error: "Internal error" }, { status: 500 });
  }
}
