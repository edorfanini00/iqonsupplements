import { createExpense, listExpenses } from "@/lib/accounting/store";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { isPrismaConnectionError } from "@/lib/db/database";

export const runtime = "nodejs";

const MAX_LABEL = 200;
const MAX_CATEGORY = 100;
const MAX_NOTE = 1_000;

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const expenses = await listExpenses();
    return apiSuccess({ expenses });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/expenses GET]", err);
    return apiError("INTERNAL", "Failed to load expenses.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      category?: string;
      amount?: number;
      incurredAt?: string;
      note?: string;
    };

    const label = (body.label ?? "").trim();
    if (!label || label.length > MAX_LABEL) {
      return apiError("INVALID_LABEL", "Add a short description for the expense.", 400);
    }
    if (body.category && body.category.length > MAX_CATEGORY) {
      return apiError("INVALID_CATEGORY", "Category is too long.", 400);
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return apiError("INVALID_AMOUNT", "Enter a valid amount.", 400);
    }
    const incurredAt = body.incurredAt ? new Date(body.incurredAt) : new Date();
    if (Number.isNaN(incurredAt.getTime())) {
      return apiError("INVALID_DATE", "Invalid expense date.", 400);
    }
    if (body.note && body.note.length > MAX_NOTE) {
      return apiError("INVALID_NOTE", "Note is too long.", 400);
    }

    const expense = await createExpense({
      label,
      category: body.category,
      amount,
      incurredAt,
      note: body.note,
    });

    return apiSuccess({ expense });
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      return apiError("SERVICE_UNAVAILABLE", "Database unavailable.", 503);
    }
    console.error("[api/affiliates/admin/accounting/expenses POST]", err);
    return apiError("INTERNAL", "Failed to record expense.", 500);
  }
}
