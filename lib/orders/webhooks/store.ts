/**
 * Durable idempotency ledger for customer order emails
 * (table supplements_transactional_emails).
 *
 * claim() is the only way to get permission to send. It either inserts a new
 * row (unique on kind + dedupe_key) or takes over a row that previously
 * failed or whose `sending` claim has gone stale. Both paths are a single
 * atomic statement, so concurrent duplicate deliveries yield exactly one
 * winner. A `sent` or `skipped` row is never claimed again.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { OrderSnapshot } from "../emails/types";

export type EmailKind = "order_confirmation" | "shipping_confirmation";
export type EmailStatus = "sending" | "sent" | "failed" | "skipped";

export interface ClaimInput {
  kind: EmailKind;
  dedupeKey: string;
  orderId: string;
  snapshot?: unknown;
  staleAfterMs: number;
}

export type ClaimResult =
  | { claimed: true; token: string; attempts: number }
  | { claimed: false; status: EmailStatus | "unknown" };

export interface TransactionalEmailStore {
  claim(input: ClaimInput): Promise<ClaimResult>;
  markSent(kind: EmailKind, dedupeKey: string, token: string, messageId: string | null): Promise<void>;
  markFailed(kind: EmailKind, dedupeKey: string, token: string, error: string): Promise<void>;
  markSkipped(kind: EmailKind, dedupeKey: string, token: string, reason: string): Promise<void>;
  /** Snapshot saved by orders/paid, used to build the shipping email. */
  getOrderSnapshot(orderId: string): Promise<OrderSnapshot | null>;
  /** line item id -> quantity already covered by other shipping emails for this order. */
  shippedQuantities(orderId: string, excludeDedupeKey: string): Promise<Record<string, number>>;
}

/** Shipping rows store only line item ids and quantities, to detect partial shipments. */
export interface ShipmentLedgerSnapshot {
  lineItems: { id: string; quantity: number }[];
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
        await table.create({ data: { kind, dedupeKey, orderId, status: "sending", attempts: 1, claimToken: token, claimedAt: at, snapshot: json } });
        return { claimed: true, token, attempts: 1 };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      // Single conditional UPDATE: Postgres re-checks the WHERE clause after
      // acquiring the row lock, so only one concurrent reclaim can match.
      const reclaimed = await table.updateMany({
        where: {
          kind,
          dedupeKey,
          OR: [{ status: "failed" }, { status: "sending", claimedAt: { lt: new Date(at.getTime() - staleAfterMs) } }],
        },
        data: { status: "sending", claimToken: token, claimedAt: at, attempts: { increment: 1 }, lastError: null, ...(json ? { snapshot: json } : {}) },
      });
      const row = await table.findUnique({ where: { kind_dedupeKey: { kind, dedupeKey } }, select: { status: true, attempts: true, claimToken: true } });
      if (reclaimed.count === 1 && row?.claimToken === token) return { claimed: true, token, attempts: row.attempts };
      return { claimed: false, status: (row?.status as EmailStatus | undefined) ?? "unknown" };
    },
    async markSent(kind, dedupeKey, token, messageId) {
      await table.updateMany({ where: { kind, dedupeKey, claimToken: token }, data: { status: "sent", sentAt: now(), resendMessageId: messageId, lastError: null } });
    },
    async markFailed(kind, dedupeKey, token, error) {
      await table.updateMany({ where: { kind, dedupeKey, claimToken: token, status: "sending" }, data: { status: "failed", lastError: error.slice(0, MAX_ERROR) } });
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
        where: { kind: "shipping_confirmation", orderId, status: { in: ["sent", "sending"] }, dedupeKey: { not: excludeDedupeKey } },
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
