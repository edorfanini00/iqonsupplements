/**
 * TikTok bonus — admin removes a submission (bogus/duplicate link), which
 * takes it out of the affiliate's monthly count.
 */

import { prisma } from "@/lib/db/prisma";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "admin-tiktok-delete", 60, 60_000);
    if (!rate.allowed) {
      return apiError("RATE_LIMITED", "Too many requests — try again shortly.", 429);
    }

    const { id } = await params;
    const deleted = await prisma.tikTokSubmission.deleteMany({ where: { id } });
    if (deleted.count === 0) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[admin/tiktok] DELETE failed", err);
    return apiError("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
