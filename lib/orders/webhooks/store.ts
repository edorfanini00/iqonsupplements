/**
 * Durable idempotency ledger for customer order emails
 * (table supplements_transactional_emails).
 *
 * claim() is the only way to get permission to send. It either inserts a new
 * row (unique on kind + dedupe_key) or takes over a row that previously
 * failed or whose `sending` claim has gone stale. Every path is a single
 * atomic statement, so concurrent duplicate deliveries yield exactly one
 * winner. `sent`, `skipped` and `sent_unconfirmed` rows are never claimed again.
 *
 * Resend only remembers an idempotency key for 24 hours. A stale `sending`
 * row (the outcome update was lost) or a failure that may still have been
 * delivered (timeout, network error, 5xx) marks the row `send_uncertain`.
 * Such a row is retried only within AMBIGUOUS_SEND_WINDOW_MS of its first
 * claim (created_at), while the key still protects the customer. After that
 * it becomes the terminal `sent_unconfirmed`: a later fulfillments/update (shipment_status
 * changes arrive days later) must never produce a second email.
 *
 * The window deliberately starts at the first claim, not at the first
 * uncertain attempt: that is when the key was first used, so it is the
 * conservative choice. An uncertain attempt made more than 23h after the first
 * claim (a shipment refused for a day, then a retry that timed out) is
 * therefore never retried either.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { OrderSnapshot } from "../emails/types";

export type EmailKind = "order_confirmation" | "shipping_confirmation";
export type EmailStatus = "sending" | "sent" | "failed" | "skipped" | "sent_unconfirmed";
export const TERMINAL_STATUSES: readonly EmailStatus[] = ["sent", "skipped", "sent_unconfirmed"];

/** Under Resend's 24h idempotency key lifetime, measured from the first claim. */
export const AMBIGUOUS_SEND_WINDOW_MS = 23 * 3600_000;

export interface ClaimInput {
  kind: EmailKind;
  dedupeKey: string;
  orderId: string;
  snapshot?: unknown;
  staleAfterMs: number;
}

export type ClaimResult =
  /**
   * `sendUncertain`: an earlier attempt may have reached the customer. Only then
   * is `snapshot` the one of that attempt (kept so a retry sends the same body);
   * a reclaim after certain failures stores the new snapshot instead.
   * `previousError`: last_error of the attempt before this one (null on a first claim).
   */
  | { claimed: true; token: string; attempts: number; snapshot: unknown; sendUncertain: boolean; previousError: string | null }
  | { claimed: false; status: EmailStatus | "unknown" };

export interface TransactionalEmailStore {
  claim(input: ClaimInput): Promise<ClaimResult>;
  markSent(kind: EmailKind, dedupeKey: string, token: string, messageId: string | null): Promise<void>;
  /** `uncertain`: the email may have been accepted by Resend (timeout, network error, 5xx). */
  markFailed(kind: EmailKind, dedupeKey: string, token: string, error: string, uncertain: boolean): Promise<void>;
  markSkipped(kind: EmailKind, dedupeKey: string, token: string, reason: string): Promise<void>;
  /** Snapshot saved by orders/paid, used to build the shipping email. */
  getOrderSnapshot(orderId: string): Promise<OrderSnapshot | null>;
  /** line item id -> quantity already covered by other shipping emails for this order. */
  shippedQuantities(orderId: string, excludeDedupeKey: string): Promise<Record<string, number>>;
}

/** Shipping rows store only line item ids and quantities, to detect partial shipments. */
export interface ShipmentLedgerSnapshot {
  lineItems: { id: string; quantity: number }[];
  /** Exact render input of the first attempt, so a retry sends the same body. */
  shipment?: unknown;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: string }).code === "P2002";
}

const MAX_ERROR = 300;

export function prismaTransactionalEmailStore(prisma: PrismaClient, now: () => Date = () => new Date()): TransactionalEmailStore {
  const table = prisma.transactionalEmail;
  return {
    async claim({ kind, dedupeKey, orderId, snapshot, staleAfterMs }) {
      const token = randomUUID();
      const at = now();
      const json = snapshot === undefined ? undefined : (JSON.parse(JSON.stringify(snapshot)) as object);
      try {
        await table.create({ data: { kind, dedupeKey, orderId, status: "sending", attempts: 1, claimToken: token, claimedAt: at, createdAt: at, snapshot: json } });
        return { claimed: true, token, attempts: 1, snapshot: json ?? null, sendUncertain: false, previousError: null };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      const stale = new Date(at.getTime() - staleAfterMs);
      const windowStart = new Date(at.getTime() - AMBIGUOUS_SEND_WINDOW_MS);
      // last_error is kept until this attempt's outcome overwrites it (see previousError).
      const take = { status: "sending", claimToken: token, claimedAt: at, attempts: { increment: 1 } };
      // Each step is one conditional UPDATE: Postgres re-checks the WHERE clause
      // after acquiring the row lock, so only one concurrent claimer can match.
      // Nothing reached the customer yet: retry with the current snapshot.
      let reclaimed = await table.updateMany({ where: { kind, dedupeKey, status: "failed", sendUncertain: false }, data: { ...take, snapshot: json } });
      if (reclaimed.count === 0) {
        reclaimed = await table.updateMany({ where: { kind, dedupeKey, status: "failed", sendUncertain: true, createdAt: { gte: windowStart } }, data: take });
      }
      if (reclaimed.count === 0) {
        // The previous owner vanished mid send: it may have been delivered.
        reclaimed = await table.updateMany({
          where: { kind, dedupeKey, status: "sending", claimedAt: { lt: stale }, createdAt: { gte: windowStart } },
          data: { ...take, sendUncertain: true },
        });
      }
      if (reclaimed.count === 0) {
        await table.updateMany({
          where: {
            kind,
            dedupeKey,
            createdAt: { lt: windowStart },
            OR: [{ status: "failed", sendUncertain: true }, { status: "sending", claimedAt: { lt: stale } }],
          },
          data: { status: "sent_unconfirmed", claimToken: null, sendUncertain: true, lastError: "ambiguous_send_expired" },
        });
      }
      const row = await table.findUnique({
        where: { kind_dedupeKey: { kind, dedupeKey } },
        select: { status: true, attempts: true, claimToken: true, snapshot: true, sendUncertain: true, lastError: true },
      });
      if (reclaimed.count === 1 && row?.claimToken === token) {
        return { claimed: true, token, attempts: row.attempts, snapshot: row.snapshot ?? null, sendUncertain: row.sendUncertain, previousError: row.lastError };
      }
      return { claimed: false, status: (row?.status as EmailStatus | undefined) ?? "unknown" };
    },
    async markSent(kind, dedupeKey, token, messageId) {
      await table.updateMany({ where: { kind, dedupeKey, claimToken: token }, data: { status: "sent", sentAt: now(), resendMessageId: messageId, lastError: null } });
    },
    async markFailed(kind, dedupeKey, token, error, uncertain) {
      await table.updateMany({
        where: { kind, dedupeKey, claimToken: token, status: "sending" },
        data: { status: "failed", lastError: error.slice(0, MAX_ERROR), ...(uncertain ? { sendUncertain: true } : {}) },
      });
    },
    async markSkipped(kind, dedupeKey, token, reason) {
      await table.updateMany({ where: { kind, dedupeKey, claimToken: token, status: "sending" }, data: { status: "skipped", lastError: reason.slice(0, MAX_ERROR) } });
    },
    async getOrderSnapshot(orderId) {
      const row = await table.findUnique({ where: { kind_dedupeKey: { kind: "order_confirmation", dedupeKey: orderId } }, select: { snapshot: true } });
      const snapshot = row?.snapshot as OrderSnapshot | null | undefined;
      return snapshot && typeof snapshot === "object" && Array.isArray(snapshot.lineItems) ? snapshot : null;
    },
    async shippedQuantities(orderId, excludeDedupeKey) {
      const rows = await table.findMany({
        where: { kind: "shipping_confirmation", orderId, status: { in: ["sent", "sending", "sent_unconfirmed"] }, dedupeKey: { not: excludeDedupeKey } },
        select: { snapshot: true },
        take: 50,
      });
      const totals: Record<string, number> = {};
      for (const row of rows) {
        const lines = (row.snapshot as ShipmentLedgerSnapshot | null)?.lineItems ?? [];
        for (const line of lines) if (line && typeof line.id === "string" && Number.isInteger(line.quantity)) totals[line.id] = (totals[line.id] ?? 0) + line.quantity;
      }
      return totals;
    },
  };
}
