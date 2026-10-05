/** In-memory store and sender with the same claim semantics as the Prisma store, for unit tests. */
import { randomUUID } from "node:crypto";
import type { OrderSnapshot } from "../../lib/orders/emails/types";
import type { EmailSender, OutgoingEmail, SendOutcome } from "../../lib/orders/webhooks/sender";
import type { ClaimInput, ClaimResult, EmailKind, EmailStatus, ShipmentLedgerSnapshot, TransactionalEmailStore } from "../../lib/orders/webhooks/store";

export interface Row {
  kind: EmailKind;
  dedupeKey: string;
  orderId: string;
  status: EmailStatus;
  attempts: number;
  claimToken: string | null;
  claimedAt: number;
  snapshot: unknown;
  messageId: string | null;
  lastError: string | null;
}

export class MemoryStore implements TransactionalEmailStore {
  rows = new Map<string, Row>();
  constructor(public clock: () => number = Date.now) {}
  key(kind: string, dedupeKey: string) { return `${kind}:${dedupeKey}`; }
  get(kind: EmailKind, dedupeKey: string) { return this.rows.get(this.key(kind, dedupeKey)); }

  async claim({ kind, dedupeKey, orderId, snapshot, staleAfterMs }: ClaimInput): Promise<ClaimResult> {
    await Promise.resolve();
    const k = this.key(kind, dedupeKey);
    const token = randomUUID();
    const now = this.clock();
    const existing = this.rows.get(k);
    const copy = snapshot === undefined ? null : JSON.parse(JSON.stringify(snapshot));
    if (!existing) {
      this.rows.set(k, { kind, dedupeKey, orderId, status: "sending", attempts: 1, claimToken: token, claimedAt: now, snapshot: copy, messageId: null, lastError: null });
      return { claimed: true, token, attempts: 1 };
    }
    if (existing.status === "failed" || (existing.status === "sending" && existing.claimedAt < now - staleAfterMs)) {
      Object.assign(existing, { status: "sending", attempts: existing.attempts + 1, claimToken: token, claimedAt: now, lastError: null, ...(copy ? { snapshot: copy } : {}) });
      return { claimed: true, token, attempts: existing.attempts };
    }
    return { claimed: false, status: existing.status };
  }
  async markSent(kind: EmailKind, dedupeKey: string, token: string, messageId: string | null) {
    const row = this.get(kind, dedupeKey);
    if (row && row.claimToken === token) Object.assign(row, { status: "sent", messageId, lastError: null });
  }
  async markFailed(kind: EmailKind, dedupeKey: string, token: string, error: string) {
    const row = this.get(kind, dedupeKey);
    if (row && row.claimToken === token && row.status === "sending") Object.assign(row, { status: "failed", lastError: error });
  }
  async markSkipped(kind: EmailKind, dedupeKey: string, token: string, reason: string) {
    const row = this.get(kind, dedupeKey);
    if (row && row.claimToken === token && row.status === "sending") Object.assign(row, { status: "skipped", lastError: reason });
  }
  async getOrderSnapshot(orderId: string) {
    return (this.get("order_confirmation", orderId)?.snapshot as OrderSnapshot | undefined) ?? null;
  }
  async shippedQuantities(orderId: string, exclude: string) {
    const totals: Record<string, number> = {};
    for (const row of this.rows.values()) {
      if (row.kind !== "shipping_confirmation" || row.orderId !== orderId || row.dedupeKey === exclude || !["sent", "sending"].includes(row.status)) continue;
      for (const line of (row.snapshot as ShipmentLedgerSnapshot).lineItems) totals[line.id] = (totals[line.id] ?? 0) + line.quantity;
    }
    return totals;
  }
}

export class FakeSender implements EmailSender {
  sent: OutgoingEmail[] = [];
  attempts: OutgoingEmail[] = [];
  /** Outcomes to return in order; once exhausted every send succeeds. */
  constructor(public script: (SendOutcome | "hang")[] = [], public delayMs = 0) {}
  async send(message: OutgoingEmail, timeoutMs: number): Promise<SendOutcome> {
    this.attempts.push(message);
    const next = this.script.shift();
    if (next === "hang") {
      await new Promise((r) => setTimeout(r, timeoutMs));
      return { ok: false, retryable: true, error: "resend_timeout" };
    }
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (next && !next.ok) return next;
    this.sent.push(message);
    return next ?? { ok: true, id: `msg_${this.sent.length}` };
  }
}
