/**
 * App commission cron.
 *
 * Runs daily (see vercel.json). Books affiliate commissions for SUPPLEMENTS_APP app
 * subscription charges: any app subscriber whose store orders are attributed
 * to an affiliate earns that affiliate `app gross × app rate`, and each
 * renewal charge produces a new pending commission on the next run.
 * Idempotent — the reconciler only books the difference still owed.
 */

import { jsonNoCache } from "@/lib/api-cache-headers";
import { reconcileAppCommissions } from "@/lib/app-portal/reconcile";

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
  if (!isAuthorized(request)) {
    return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileAppCommissions();
    console.log("[cron/app-commissions]", result);
    return jsonNoCache({ ok: true, result });
  } catch (err) {
    console.error("[cron/app-commissions]", err);
    return jsonNoCache({ error: "Internal error" }, { status: 500 });
  }
}
