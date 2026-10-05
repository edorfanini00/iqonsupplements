/** In-memory store and sender with the same claim semantics as the Prisma store, for unit tests. */
import { randomUUID } from "node:crypto";
import type { OrderSnapshot } from "../../lib/orders/emails/types";
import type { EmailSender, OutgoingEmail, SendOutcome } from "../../lib/orders/webhooks/sender";
import { AMBIGUOUS_SEND_WINDOW_MS, type ClaimInput, type ClaimResult, type EmailKind, type EmailStatus, type ShipmentLedgerSnapshot, type TransactionalEmailStore } from "../../lib/orders/webhooks/store";

export interface Row {
  kind: EmailKind;
  dedupeKey: string;
  orderId: string;
  status: EmailStatus;
  attempts: number;
  claimToken: string | null;
  claimedAt: number;
  createdAt: number;
  sendUncertain: boolean;
  snapshot: unknown;
  messageId: string | null;
  lastError: string | null;
}

export class MemoryStore implements TransactionalEmailStore {
  rows = new Map<string, Row>();
  /** Set to make the next markSent calls throw (simulates a lost ledger update). */
  failMarkSent = 0;
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
      this.rows.set(k, { kind, dedupeKey, orderId, status: "sending", attempts: 1, claimToken: token, claimedAt: now, createdAt: now, sendUncertain: false, snapshot: copy, messageId: null, lastError: null });
      return { claimed: true, token, attempts: 1, snapshot: copy, sendUncertain: false, previousError: null };
    }
    const inWindow = existing.createdAt >= now - AMBIGUOUS_SEND_WINDOW_MS;
    const stale = existing.status === "sending" && existing.claimedAt < now - staleAfterMs;
    const take = (uncertain: boolean): ClaimResult => {
      // After certain failures only, the current snapshot replaces the stored one.
      const replace = !existing.sendUncertain && !uncertain && copy !== null ? { snapshot: copy } : {};
      Object.assign(existing, { status: "sending", attempts: existing.attempts + 1, claimToken: token, claimedAt: now, sendUncertain: existing.sendUncertain || uncertain, ...replace });
      return { claimed: true, token, attempts: existing.attempts, snapshot: existing.snapshot, sendUncertain: existing.sendUncertain, previousError: existing.lastError };
    };
    if (existing.status === "failed" && (!existing.sendUncertain || inWindow)) return take(false);
    if (stale && inWindow) return take(true);
    if (!inWindow && ((existing.status === "failed" && existing.sendUncertain) || stale)) {
      Object.assign(existing, { status: "sent_unconfirmed", claimToken: null, sendUncertain: true, lastError: "ambiguous_send_expired" });
    }
    return { claimed: false, status: existing.status };
  }
  async markSent(kind: EmailKind, dedupeKey: string, token: string, messageId: string | null) {
    if (this.failMarkSent > 0) {
      this.failMarkSent -= 1;
      throw new Error("connection reset");
    }
    const row = this.get(kind, dedupeKey);
    if (row && row.claimToken === token) Object.assign(row, { status: "sent", messageId, lastError: null });
  }
  async markFailed(kind: EmailKind, dedupeKey: string, token: string, error: string, uncertain: boolean) {
    const row = this.get(kind, dedupeKey);
    if (row && row.claimToken === token && row.status === "sending") Object.assign(row, { status: "failed", lastError: error, sendUncertain: row.sendUncertain || uncertain });
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
      if (row.kind !== "shipping_confirmation" || row.orderId !== orderId || row.dedupeKey === exclude || !["sent", "sending", "sent_unconfirmed"].includes(row.status)) continue;
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
      return { ok: false, retryable: true, uncertain: true, error: "resend_timeout" };
    }
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (next && !next.ok) return next;
    this.sent.push(message);
    return next ?? { ok: true, id: `msg_${this.sent.length}` };
  }
}
