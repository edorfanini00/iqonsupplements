import {
  deleteContactMessage,
  setContactMessageStatus,
  type ContactMessageStatus,
} from "@/lib/contact/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const VALID_STATUSES: ContactMessageStatus[] = ["new", "read", "replied", "archived"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = body.status as ContactMessageStatus;
    if (!VALID_STATUSES.includes(status)) {
      return apiError("INVALID_STATUS", "Invalid status.", 400);
    }

    const updated = await setContactMessageStatus(id, status);
    if (!updated) return apiError("NOT_FOUND", "Message not found.", 404);

    return apiSuccess({ message: updated });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/messages/:id PATCH]", err);
    return apiError("INTERNAL", "Failed to update message.", 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const { id } = await context.params;
    const ok = await deleteContactMessage(id);
    if (!ok) return apiError("NOT_FOUND", "Message not found.", 404);

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/messages/:id DELETE]", err);
    return apiError("INTERNAL", "Failed to delete message.", 500);
  }
}
