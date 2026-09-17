import { sharedJobAuthorityGuard } from '@/lib/affiliates/job-authority';
/**
 * Email-marketing drip cron.
 *
 * Runs daily (see vercel.json). For every active campaign it sends the next
 * batch of queued recipients (up to the campaign's dailyLimit). A campaign
 * that already sent today is skipped, so retries can't double-send.
 */

import { jsonNoCache } from "@/lib/api-cache-headers";
import { processDueCampaigns } from "@/lib/marketing/campaigns";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

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
    const results = await processDueCampaigns();
    const summary = {
      campaigns: results.length,
      sent: results.reduce((n, r) => n + r.sent, 0),
      failed: results.reduce((n, r) => n + r.failed, 0),
      results,
    };
    console.info("[cron/email-campaigns] done", summary);
    return jsonNoCache({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/email-campaigns] fatal", err);
    return jsonNoCache({ ok: false, error: "Cron failed" }, { status: 500 });
  }
}
