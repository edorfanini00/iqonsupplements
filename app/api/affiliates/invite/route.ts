import { getAffiliateById, getAffiliateByEmail } from "@/lib/affiliates/store";
import {
  isNextResponse,
  requireAffiliateOnlySession,
  sessionProfileId,
} from "@/lib/affiliates/auth-guards";
import { sendInviteEmail, getInviteUrl } from "@/lib/affiliates/mailer";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const session = await requireAffiliateOnlySession();
  if (isNextResponse(session)) return session;

  const me = session.profile ?? (await getAffiliateById(sessionProfileId(session)));
  if (!me || me.status !== "active") {
    return apiError("FORBIDDEN", "Account is not active.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = body.firstName ? String(body.firstName).trim() : undefined;
  const personalMessage = body.message ? String(body.message).trim().slice(0, 500) : undefined;

  if (!EMAIL_RE.test(email)) {
    return apiError("VALIDATION_ERROR", "Please enter a valid email address.", 400);
  }
  if (email === me.email.toLowerCase()) {
    return apiError("VALIDATION_ERROR", "You can't invite yourself.", 400);
  }

  const existing = await getAffiliateByEmail(email);
  if (existing) {
    return apiError(
      "CONFLICT",
      existing.status === "pending"
        ? "Someone with that email already has a pending application."
        : "An affiliate with that email already exists.",
      409
    );
  }

  const inviterName = `${me.firstName} ${me.lastName}`.trim();
  const inviteUrl = getInviteUrl(me.id);
  const result = await sendInviteEmail({
    to: email,
    inviteeFirstName: firstName,
    inviterName,
    inviterPromoCode: me.promoCode,
    inviterId: me.id,
    personalMessage,
  });

  return apiSuccess({ inviteUrl, delivery: result });
}

export async function GET() {
  const session = await requireAffiliateOnlySession();
  if (isNextResponse(session)) return session;

  const me = session.profile ?? (await getAffiliateById(sessionProfileId(session)));
  if (!me) return apiError("NOT_FOUND", "Not found", 404);

  return apiSuccess({
    inviteUrl: getInviteUrl(me.id),
    promoCode: me.promoCode,
    referrerName: `${me.firstName} ${me.lastName}`.trim(),
  });
}
