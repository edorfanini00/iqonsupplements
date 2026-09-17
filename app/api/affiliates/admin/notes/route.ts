import {
  createAdminNote,
  listAdminNotes,
} from "@/lib/affiliates/notes-store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_TITLE = 200;
const MAX_BODY = 10_000;
const MAX_TAG = 120;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const notes = await listAdminNotes();
    return apiSuccess({ notes });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/notes GET]", err);
    return apiError("INTERNAL", "Failed to load notes.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
      tag?: string;
      pinned?: boolean;
    };

    const noteBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!noteBody) {
      return apiError("INVALID_BODY", "Note cannot be empty.", 400);
    }
    if (noteBody.length > MAX_BODY) {
      return apiError("INVALID_BODY", "Note is too long.", 400);
    }
    if (body.title && body.title.length > MAX_TITLE) {
      return apiError("INVALID_TITLE", "Title is too long.", 400);
    }
    if (body.tag && body.tag.length > MAX_TAG) {
      return apiError("INVALID_TAG", "Tag is too long.", 400);
    }

    const authorName =
      `${session.profile?.firstName ?? ""} ${session.profile?.lastName ?? ""}`.trim() ||
      null;

    const note = await createAdminNote({
      title: body.title,
      body: noteBody,
      tag: body.tag,
      pinned: Boolean(body.pinned),
      authorEmail: session.email,
      authorName,
    });

    return apiSuccess({ note });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/notes POST]", err);
    return apiError("INTERNAL", "Failed to create note.", 500);
  }
}
