/**
 * GET /api/affiliates/admin/marketing/audience — people who signed up (created
 * a store account) but never placed a paid order. Excludes affiliates.
 * Admin-only; drives the Email marketing tab recipient picker.
 */

import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { listSignupProspects } from "@/lib/marketing/audience";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const { prospects, truncated } = await listSignupProspects();
    return apiSuccess({ prospects, truncated });
  } catch (err) {
    console.error("[api/affiliates/admin/marketing/audience]", err);
    return apiError("INTERNAL", "Failed to load audience.", 500);
  }
}
