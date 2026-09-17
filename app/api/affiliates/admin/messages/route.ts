import {
  countUnreadContactMessages,
  listContactMessages,
} from "@/lib/contact/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const [messages, unreadCount] = await Promise.all([
      listContactMessages(),
      countUnreadContactMessages(),
    ]);

    return apiSuccess({ messages, unreadCount });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/messages]", err);
    return apiError("INTERNAL", "Failed to load messages.", 500);
  }
}
