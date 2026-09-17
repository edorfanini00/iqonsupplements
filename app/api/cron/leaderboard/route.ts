import { sharedJobAuthorityGuard } from '@/lib/affiliates/job-authority';
import { timingSafeEqual } from "node:crypto";
import { jsonNoCache } from "@/lib/api-cache-headers";
import { settleEndedLeaderboardCycles } from "@/lib/affiliates/leaderboard-settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

export async function GET(request: Request) {
  // Canonical Health alone owns ingestion, settlement and scheduled sends.
  const authorityGuard = sharedJobAuthorityGuard();
  if (authorityGuard) return authorityGuard;
  const secret = process.env.SUPPLEMENTS_CRON_SECRET?.trim();
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  // x-vercel-cron is user-supplied and is never authentication.
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return jsonNoCache({ ok: true, ...await settleEndedLeaderboardCycles() });
  } catch (error) {
    console.error("[cron/leaderboard] settlement failed", error);
    return jsonNoCache({ error: "Leaderboard settlement failed" }, { status: 500 });
  }
}
