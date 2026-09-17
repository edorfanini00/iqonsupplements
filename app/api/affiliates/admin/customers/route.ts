/**
 * GET /api/affiliates/admin/customers — deduped directory of everyone who has
 * placed a paid order, so an admin can pick recipients for outbound emails.
 * Admin-only.
 */

import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { listCustomers } from "@/lib/customers/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const { customers, truncated } = await listCustomers();
    return apiSuccess({ customers, truncated });
  } catch (err) {
    console.error("[api/affiliates/admin/customers]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
