import {
  deleteAdminNote,
  updateAdminNote,
} from "@/lib/affiliates/notes-store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_TITLE = 200;
const MAX_BODY = 10_000;
const MAX_TAG = 120;

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
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
      tag?: string;
      pinned?: boolean;
    };

    if (body.body !== undefined) {
      const trimmed = body.body.trim();
      if (!trimmed) return apiError("INVALID_BODY", "Note cannot be empty.", 400);
      if (trimmed.length > MAX_BODY) {
        return apiError("INVALID_BODY", "Note is too long.", 400);
      }
    }
    if (body.title && body.title.length > MAX_TITLE) {
      return apiError("INVALID_TITLE", "Title is too long.", 400);
    }
    if (body.tag && body.tag.length > MAX_TAG) {
      return apiError("INVALID_TAG", "Tag is too long.", 400);
    }

    const updated = await updateAdminNote(id, {
      title: body.title,
      body: body.body,
      tag: body.tag,
      pinned: body.pinned,
    });
    if (!updated) return apiError("NOT_FOUND", "Note not found.", 404);

    return apiSuccess({ note: updated });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/notes/:id PATCH]", err);
    return apiError("INTERNAL", "Failed to update note.", 500);
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
    const ok = await deleteAdminNote(id);
    if (!ok) return apiError("NOT_FOUND", "Note not found.", 404);

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/notes/:id DELETE]", err);
    return apiError("INTERNAL", "Failed to delete note.", 500);
  }
}
