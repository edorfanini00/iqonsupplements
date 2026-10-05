/**
 * Resend delivery for order emails. Uses the same env convention as the other
 * supplements mailers (SUPPLEMENTS_RESEND_API_KEY, SUPPLEMENTS_EMAIL_FROM) with
 * an optional SUPPLEMENTS_ORDER_EMAIL_FROM override. Every send carries a
 * Resend idempotency key so a retried webhook cannot produce a second email
 * even if our own ledger update was lost.
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
  | { ok: false; retryable: boolean; error: string };

export interface EmailSender {
  send(message: OutgoingEmail, timeoutMs: number): Promise<SendOutcome>;
}

type Env = Record<string, string | undefined>;

export function orderEmailFrom(env: Env = process.env): string | null {
  return env.SUPPLEMENTS_ORDER_EMAIL_FROM?.trim() || env.SUPPLEMENTS_EMAIL_FROM?.trim() || null;
}

export function orderEmailConfigured(env: Env = process.env): boolean {
  return !!env.SUPPLEMENTS_RESEND_API_KEY?.trim() && !!orderEmailFrom(env);
}

/** Errors that will fail the same way on every retry. */
const PERMANENT = new Set(["validation_error", "invalid_parameter", "missing_required_field", "invalid_attachment", "invalid_idempotency_key"]);

type ResendLike = Pick<Resend, "emails">;

export function resendSender(env: Env = process.env, client?: ResendLike): EmailSender | null {
  if (!orderEmailConfigured(env)) return null;
  const resend = client ?? new Resend(env.SUPPLEMENTS_RESEND_API_KEY!.trim());
  const from = orderEmailFrom(env)!;
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
        // Ambiguous: the request may still land. The retry reuses the same
        // idempotency key, so Resend will not deliver twice.
        if (result === "timeout") return { ok: false, retryable: true, error: "resend_timeout" };
        if (result.error) {
          const name = result.error.name;
          // Same key was already accepted with a different body: the email went out.
          if (name === "invalid_idempotent_request") return { ok: true, id: null, duplicate: true };
          return { ok: false, retryable: !PERMANENT.has(name), error: `resend_${name}` };
        }
        return { ok: true, id: result.data?.id ?? null };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? `resend_exception:${error.message.slice(0, 120)}` : "resend_exception" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
