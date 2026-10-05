/**
 * Resend delivery for order emails. Shares SUPPLEMENTS_RESEND_API_KEY with the
 * other supplements mailers. The From is IQON <info@iqonhealth.com> (owner
 * decision, verified in Resend) unless SUPPLEMENTS_ORDER_EMAIL_FROM overrides it.
 * Every send carries a
 * Resend idempotency key (kept by Resend for 24h) so a retried webhook cannot
 * produce a second email even if our own ledger update was lost. store.ts
 * covers what happens once that window has passed.
 */
import { Resend } from "resend";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string;
  tag: string;
}

export type SendOutcome =
  | { ok: true; id: string | null; duplicate?: boolean }
  /**
   * `uncertain`: Resend may have accepted the email anyway (timeout, network error, 5xx).
   * `idempotentConflict`: Resend already holds this key with a different body. The handler
   * decides what that means from the ledger row (see deliver() in handler.ts).
   */
  | { ok: false; retryable: boolean; uncertain: boolean; error: string; idempotentConflict?: boolean };

export interface EmailSender {
  send(message: OutgoingEmail, timeoutMs: number): Promise<SendOutcome>;
}

type Env = Record<string, string | undefined>;

/**
 * Owner decision: order emails are sent from the Resend verified iqonhealth.com
 * domain. SUPPLEMENTS_EMAIL_FROM (used by the contact/affiliate mailers) is
 * deliberately NOT consulted, so changing that mailer's sender can never move
 * order mail onto an unverified domain. Override only via SUPPLEMENTS_ORDER_EMAIL_FROM.
 */
export const DEFAULT_ORDER_EMAIL_FROM = "IQON <info@iqonhealth.com>";

export function orderEmailFrom(env: Env = process.env): string {
  return env.SUPPLEMENTS_ORDER_EMAIL_FROM?.trim() || DEFAULT_ORDER_EMAIL_FROM;
}

export function orderEmailConfigured(env: Env = process.env): boolean {
  return !!env.SUPPLEMENTS_RESEND_API_KEY?.trim() && !!orderEmailFrom(env);
}

/** Rejections caused by this particular message; a retry fails the same way. */
const PERMANENT = new Set(["validation_error", "invalid_parameter", "missing_required_field", "invalid_attachment", "invalid_idempotency_key"]);
/** Account or sender setup problems (key, From domain, quota). Fixable by the owner, so Shopify should retry. */
const CONFIGURATION = new Set([
  "missing_api_key", "invalid_api_key", "restricted_api_key", "invalid_from_address", "invalid_access", "invalid_region",
  "security_error", "monthly_quota_exceeded", "daily_quota_exceeded", "rate_limit_exceeded", "not_found", "method_not_allowed",
]);
/** Resend answers these before accepting anything; every other error may have been delivered. */
const REJECTED_UNSENT = new Set([...PERMANENT, ...CONFIGURATION]);

/**
 * Resend reports an unverified From domain as a 403 validation_error. Only auth
 * statuses or wording about the sender domain / From address count as setup
 * problems; anything else about the message (e.g. the recipient) is permanent.
 */
function isConfigurationError(error: { name: string; message?: string; statusCode?: number | null }): boolean {
  if (CONFIGURATION.has(error.name)) return true;
  if (error.statusCode === 401 || error.statusCode === 403) return true;
  return /domain is not verified|verify (?:a|your) domain|`?from`? (?:address|field)/i.test(error.message ?? "");
}

export function classifyResendError(error: { name: string; message?: string; statusCode?: number | null }): Extract<SendOutcome, { ok: false }> {
  const uncertain = !REJECTED_UNSENT.has(error.name);
  const permanent = PERMANENT.has(error.name) && !isConfigurationError(error);
  return { ok: false, retryable: !permanent, uncertain, error: `resend_${error.name}` };
}

type ResendLike = Pick<Resend, "emails">;

export function resendSender(env: Env = process.env, client?: ResendLike): EmailSender | null {
  if (!orderEmailConfigured(env)) return null;
  const resend = client ?? new Resend(env.SUPPLEMENTS_RESEND_API_KEY!.trim());
  const from = orderEmailFrom(env);
  return {
    async send(message, timeoutMs) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), timeoutMs); });
      try {
        const result = await Promise.race([
          resend.emails.send(
            {
              from,
              to: message.to,
              subject: message.subject,
              html: message.html,
              text: message.text,
              ...(message.replyTo ? { replyTo: message.replyTo } : {}),
              tags: [{ name: "category", value: message.tag }],
            },
            { idempotencyKey: message.idempotencyKey },
          ),
          timeout,
        ]);
        // Ambiguous: the request may still land. A retry within 24h reuses the
        // same idempotency key, so Resend will not deliver twice.
        if (result === "timeout") return { ok: false, retryable: true, uncertain: true, error: "resend_timeout" };
        if (result.error) {
          // Same key already used with a different body. Only proof of delivery if an
          // earlier attempt was uncertain; the handler checks the ledger for that.
          if (result.error.name === "invalid_idempotent_request") {
            return { ok: false, retryable: true, uncertain: true, error: "resend_invalid_idempotent_request", idempotentConflict: true };
          }
          return classifyResendError(result.error);
        }
        return { ok: true, id: result.data?.id ?? null };
      } catch (error) {
        return { ok: false, retryable: true, uncertain: true, error: error instanceof Error ? `resend_exception:${error.message.slice(0, 120)}` : "resend_exception" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
