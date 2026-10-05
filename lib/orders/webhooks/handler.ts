/**
 * Shopify order webhook -> IQON customer email.
 *
 * Topics: orders/paid (order confirmation) and fulfillments/create|update
 * (shipping confirmation). The handler verifies the delivery, takes a durable
 * claim in supplements_transactional_emails, sends through Resend with an
 * idempotency key and records the outcome, all inside a ~4s budget so Shopify
 * gets an answer well before its 5s timeout.
 *
 * Response contract (Shopify retries anything that is not 2xx):
 *   200  sent, duplicate (sent, deliberately skipped, or sent_unconfirmed: an
 *        uncertain attempt older than Resend's 24h idempotency window), deliberate skip
 *        (no recipient, subscription renewal order, cancelled fulfilment, awaiting
 *        tracking), unknown topic,
 *        or a permanent Resend rejection that a retry cannot fix
 *   401  wrong shop or bad signature
 *   400  unreadable JSON
 *   408  body not received within the read deadline (route only)
 *   413  body over the size cap
 *   503  not configured, transient failure (claim released as `failed`), or
 *        another delivery currently holds the claim; Shopify will retry
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { SUPPLEMENTS_SHOP } from "../../affiliates/shopify-admin";
import { maskEmail } from "../emails/format";
import { resolveLineItemImages, type StorefrontImageLookup } from "../emails/images";
import { renderOrderConfirmationEmail } from "../emails/order-confirmation";
import { renderShippingConfirmationEmail } from "../emails/shipping-confirmation";
import type { EmailBrandConfig, EmailLineItem, OrderSnapshot, RenderedEmail, ShipmentDetails } from "../emails/types";
import type { AdminOrderInfo, AdminOrderLookup } from "./admin-order";
import type { EmailSender, SendOutcome } from "./sender";
import { hasMoreToFollow, isSubscriptionRenewal, orderSource, parseFulfillment, parseOrderPaid, shipmentReadiness, totalsMismatch } from "./shopify-payload";
import { TERMINAL_STATUSES, type ClaimResult, type EmailKind, type ShipmentLedgerSnapshot, type TransactionalEmailStore } from "./store";

export const SUPPORTED_TOPICS = ["orders/paid", "fulfillments/create", "fulfillments/update"] as const;
export const MAX_BODY_BYTES = 1_000_000;
export const DEFAULT_BUDGET_MS = 4000;
export const DEFAULT_STALE_CLAIM_MS = 5 * 60_000;
/** Shopify sends the whole body at once; a slow trickle is not a real delivery. */
export const BODY_READ_DEADLINE_MS = 1000;

export interface WebhookDeps {
  env: Record<string, string | undefined>;
  /** null when the database is not configured. */
  store: TransactionalEmailStore | null;
  /** null when Resend is not configured. */
  sender: EmailSender | null;
  imageLookup: StorefrontImageLookup | null;
  adminOrderLookup: AdminOrderLookup | null;
  brand: EmailBrandConfig;
  now?: () => number;
  /** When the request arrived (same clock as `now`); the budget includes the body read. */
  startedAt?: number;
  log?: (event: Record<string, unknown>) => void;
  budgetMs?: number;
  staleClaimMs?: number;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

class StepTimeout extends Error {
  constructor(step: string) {
    super(`timeout:${step}`);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  if (ms <= 0) return Promise.reject(new StepTimeout(step));
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new StepTimeout(step)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

export type BodyReadResult = { ok: true; body: Buffer } | { ok: false; status: 408 | 413; reason: "body_timeout" | "too_large" };

/**
 * Reads the raw body bytes (the HMAC is computed over exactly these), refusing
 * anything larger than `max` bytes without buffering it all, or slower than
 * `deadlineMs` in total.
 */
export async function readLimitedBody(request: Request, max = MAX_BODY_BYTES, deadlineMs = BODY_READ_DEADLINE_MS): Promise<BodyReadResult> {
  const tooLarge = { ok: false, status: 413, reason: "too_large" } as const;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) return tooLarge;
  if (!request.body) return { ok: true, body: Buffer.alloc(0) };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), deadlineMs); });
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next === "timeout") {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 408, reason: "body_timeout" };
      }
      if (next.done) break;
      size += next.value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => {});
        return tooLarge;
      }
      chunks.push(next.value);
    }
  } finally {
    clearTimeout(timer);
  }
  return { ok: true, body: Buffer.concat(chunks) };
}

/** Shopify's X-Shopify-Hmac-Sha256: base64 HMAC-SHA256 of the raw body bytes. Timing safe. */
export function verifyShopifyHmac(raw: Buffer, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret.trim()).update(raw).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const ok = (body: Record<string, unknown>): WebhookResult => ({ status: 200, body: { ok: true, ...body } });
const retry = (reason: string): WebhookResult => ({ status: 503, body: { ok: false, retry: true, reason } });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "unknown_error";
}

export async function handleShopifyOrderWebhook(rawBody: Buffer | string, headers: Headers, deps: WebhookDeps): Promise<WebhookResult> {
  const now = deps.now ?? Date.now;
  const started = deps.startedAt ?? now();
  const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const remaining = () => budget - (now() - started);
  const topic = headers.get("x-shopify-topic") ?? "";
  const webhookId = headers.get("x-shopify-webhook-id") ?? headers.get("x-shopify-event-id") ?? null;
  const log = (event: Record<string, unknown>) =>
    (deps.log ?? ((e) => console.info("[order-emails]", JSON.stringify(e))))({ topic, webhookId, ms: now() - started, ...event });

  const raw = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  if (raw.byteLength > MAX_BODY_BYTES) return { status: 413, body: { ok: false, reason: "too_large" } };
  if (headers.get("x-shopify-shop-domain") !== SUPPLEMENTS_SHOP) {
    log({ event: "rejected", reason: "unexpected_shop" });
    return { status: 401, body: { ok: false, reason: "unexpected_shop" } };
  }
  const secret = deps.env.SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    log({ event: "not_configured", reason: "missing_webhook_secret" });
    return retry("not_configured");
  }
  if (!verifyShopifyHmac(raw, headers.get("x-shopify-hmac-sha256"), secret)) {
    log({ event: "rejected", reason: "invalid_signature" });
    return { status: 401, body: { ok: false, reason: "invalid_signature" } };
  }
  if (!(SUPPORTED_TOPICS as readonly string[]).includes(topic)) {
    // Acknowledge so Shopify does not keep retrying a subscription we never asked for.
    log({ event: "ignored", reason: "unsupported_topic" });
    return ok({ ignored: true, reason: "unsupported_topic" });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return { status: 400, body: { ok: false, reason: "invalid_json" } };
  }
  if (!deps.store || !deps.sender) {
    // Never send without a durable claim; Shopify retries once configuration lands.
    log({ event: "not_configured", reason: !deps.store ? "missing_database" : "missing_resend" });
    return retry("not_configured");
  }
  const ctx: Ctx = { deps: { ...deps, store: deps.store, sender: deps.sender }, remaining, log };
  try {
    return topic === "orders/paid" ? await orderPaid(payload, ctx) : await fulfillment(payload, ctx);
  } catch (error) {
    log({ event: "error", error: errorMessage(error) });
    return retry("transient_error");
  }
}

type Ctx = {
  deps: WebhookDeps & { store: TransactionalEmailStore; sender: EmailSender };
  remaining: () => number;
  log: (event: Record<string, unknown>) => void;
};

const IDEMPOTENT_CONFLICT = "resend_invalid_idempotent_request";

/** Time reserved after the send to record the outcome (two markSent tries). */
const FINISH_RESERVE_MS = 1000;
/** Minimum time given to any ledger write, even when the budget is spent. */
const MIN_WRITE_MS = 300;

/** Ledger writes after the claim: bounded so Shopify still gets an answer in time. */
function write(ctx: Ctx, promise: Promise<void>, step: string): Promise<void> {
  return withTimeout(promise, Math.max(MIN_WRITE_MS, ctx.remaining()), step);
}

async function lookupAdmin(ctx: Ctx, orderId: string, maxMs: number): Promise<AdminOrderInfo | null> {
  if (!ctx.deps.adminOrderLookup) return null;
  try {
    return await withTimeout(ctx.deps.adminOrderLookup(orderId), Math.min(maxMs, ctx.remaining() - 2000), "admin_order");
  } catch (error) {
    ctx.log({ event: "admin_order_lookup_failed", orderId, error: errorMessage(error) });
    return null;
  }
}

async function images(ctx: Ctx, items: EmailLineItem[], maxMs: number): Promise<EmailLineItem[]> {
  const { brand, imageLookup } = ctx.deps;
  const lookup: StorefrontImageLookup | null = imageLookup
    ? (variants, products) => withTimeout(imageLookup(variants, products), Math.min(maxMs, ctx.remaining() - 2000), "storefront_images")
    : null;
  return resolveLineItemImages(items, brand, lookup, ctx.log);
}

function duplicate(ctx: Ctx, claim: Extract<ClaimResult, { claimed: false }>, ids: Record<string, string>): WebhookResult {
  if ((TERMINAL_STATUSES as readonly string[]).includes(claim.status)) {
    ctx.log({ event: "duplicate", status: claim.status, ...ids });
    return ok({ duplicate: true, status: claim.status });
  }
  // Another delivery holds a live claim. Ask Shopify to come back: by then it
  // is either sent (200 duplicate) or stale and safe to reclaim.
  ctx.log({ event: "claim_busy", status: claim.status, ...ids });
  return retry("claim_in_progress");
}

async function deliver(
  ctx: Ctx,
  kind: EmailKind,
  dedupeKey: string,
  token: string,
  to: string,
  email: RenderedEmail,
  idempotencyKey: string,
  claim: Extract<ClaimResult, { claimed: true }>,
  ids: Record<string, unknown>,
): Promise<WebhookResult> {
  const { store, sender, brand } = ctx.deps;
  let outcome: SendOutcome;
  try {
    outcome = await sender.send(
      { to, subject: email.subject, html: email.html, text: email.text, idempotencyKey, replyTo: brand.supportEmail, tag: kind },
      Math.max(500, ctx.remaining() - FINISH_RESERVE_MS),
    );
  } catch (error) {
    outcome = { ok: false as const, retryable: true, uncertain: true, error: errorMessage(error) };
  }
  if (!outcome.ok && outcome.idempotentConflict) {
    // Resend already holds this key. After an uncertain attempt that means it was
    // accepted. Otherwise (or when the uncertainty itself came from a conflict)
    // Resend may have kept the key of a rejected request, so nothing proves
    // delivery: stay uncertain (retried inside the window, then sent_unconfirmed)
    // and leave a distinct trail for monitoring.
    const accepted = claim.sendUncertain && claim.previousError !== IDEMPOTENT_CONFLICT;
    ctx.log({ event: "resend_idempotent_conflict", treatedAs: accepted ? "sent" : "uncertain", ...ids });
    if (accepted) outcome = { ok: true, id: null, duplicate: true };
  }
  if (outcome.ok) {
    // One retry: the update is keyed by our claim token, so repeating it is harmless.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const slice = attempt === 1 ? Math.floor(ctx.remaining() * 0.6) : ctx.remaining();
        await withTimeout(store.markSent(kind, dedupeKey, token, outcome.id), Math.max(MIN_WRITE_MS, slice), "mark_sent");
        break;
      } catch (error) {
        // The email is out. The row stays `sending`: a stale reclaim within 23h
        // is a no-op thanks to Resend's idempotency key, and after that the row
        // becomes sent_unconfirmed instead of sending again (see store.ts).
        ctx.log({ event: "mark_sent_failed", attempt, error: errorMessage(error), ...ids });
      }
    }
    ctx.log({ event: "sent", to: maskEmail(to), messageId: outcome.id, duplicateAtResend: outcome.duplicate === true, ...ids });
    return ok({ sent: true });
  }
  await write(ctx, store.markFailed(kind, dedupeKey, token, outcome.error, outcome.uncertain), "mark_failed").catch((error) =>
    ctx.log({ event: "mark_failed_failed", error: errorMessage(error), ...ids }));
  ctx.log({ event: "send_failed", retryable: outcome.retryable, uncertain: outcome.uncertain, error: outcome.error, ...ids });
  return outcome.retryable ? retry("send_failed") : ok({ sent: false, reason: "permanent_send_failure" });
}

function isOrderSnapshot(value: unknown): value is OrderSnapshot {
  const v = value as OrderSnapshot | null;
  return !!v && typeof v === "object" && typeof v.orderId === "string" && Array.isArray(v.lineItems) && typeof v.total === "string";
}

function isShipment(value: unknown): value is ShipmentDetails {
  const v = value as ShipmentDetails | null;
  return !!v && typeof v === "object" && typeof v.fulfillmentId === "string" && typeof v.orderName === "string" && Array.isArray(v.lineItems);
}

async function claimOrRetry(ctx: Ctx, input: Parameters<TransactionalEmailStore["claim"]>[0]): Promise<ClaimResult> {
  return withTimeout(ctx.deps.store.claim(input), Math.min(1500, ctx.remaining() - 1000), "claim");
}

async function orderPaid(payload: unknown, ctx: Ctx): Promise<WebhookResult> {
  const parsed = parseOrderPaid(payload);
  if (!parsed) {
    ctx.log({ event: "skipped", reason: "invalid_order_payload" });
    return ok({ skipped: true, reason: "invalid_order_payload" });
  }
  const ids = { orderId: parsed.orderId, test: parsed.test };
  const renewal = isSubscriptionRenewal(payload);
  ctx.log({ event: "order_source", renewal: renewal.renewal, ...orderSource(payload), ...ids });
  if (renewal.renewal) return renewalOrder(parsed, renewal.signal, ctx, ids);
  const mismatch = totalsMismatch(parsed);
  if (Math.abs(mismatch) > 0.01) ctx.log({ event: "totals_mismatch", difference: mismatch.toFixed(2), ...ids });
  // Enrichment is best effort and runs in parallel inside a fixed slice of the budget.
  const [admin, withImages] = await Promise.all([lookupAdmin(ctx, parsed.orderId, 1300), images(ctx, parsed.lineItems, 1300)]);
  const plans = new Map((admin?.lineItems ?? []).map((line) => [line.id, line.sellingPlanName]));
  const fresh: OrderSnapshot = {
    ...parsed,
    orderStatusUrl: parsed.orderStatusUrl ?? admin?.orderStatusUrl ?? null,
    lineItems: withImages.map((line) => ({ ...line, sellingPlanName: line.sellingPlanName ?? plans.get(line.id) ?? null })),
  };

  const claim = await claimOrRetry(ctx, { kind: "order_confirmation", dedupeKey: parsed.orderId, orderId: parsed.orderId, snapshot: fresh, staleAfterMs: ctx.deps.staleClaimMs ?? DEFAULT_STALE_CLAIM_MS });
  if (!claim.claimed) return duplicate(ctx, claim, { orderId: parsed.orderId });
  // After an uncertain attempt, render exactly what that attempt rendered so Resend
  // sees the same body for the same idempotency key. Otherwise nothing reached
  // the customer yet and the current data is used.
  const order = claim.sendUncertain && isOrderSnapshot(claim.snapshot) && claim.snapshot.orderId === parsed.orderId ? claim.snapshot : fresh;
  try {
    if (!order.email) {
      await write(ctx, ctx.deps.store.markSkipped("order_confirmation", order.orderId, claim.token, "no_recipient"), "mark_skipped");
      ctx.log({ event: "skipped", reason: "no_recipient", ...ids });
      return ok({ skipped: true, reason: "no_recipient" });
    }
    if (order.test) ctx.log({ event: "test_order", note: "Shopify test order; sending normally", ...ids });
    const email = renderOrderConfirmationEmail(order, ctx.deps.brand);
    return await deliver(ctx, "order_confirmation", order.orderId, claim.token, order.email, email, `order-confirmation/${order.orderId}`, claim, { ...ids, attempt: claim.attempts });
  } catch (error) {
    await write(ctx, ctx.deps.store.markFailed("order_confirmation", order.orderId, claim.token, errorMessage(error), false), "mark_failed").catch(() => {});
    throw error;
  }
}

/**
 * Owner decision: subscription renewals get no order confirmation (the customer
 * already got one for the first subscription order); their shipments still get
 * a shipping email. The row is stored as `skipped` (reason subscription_renewal)
 * WITH the parsed order snapshot, so a duplicate delivery is a 200 duplicate and
 * the shipping email can still use the order name, first name and subscription
 * labels. No enrichment: nothing is rendered now, and the shipping path resolves
 * images itself.
 */
async function renewalOrder(parsed: OrderSnapshot, signal: string, ctx: Ctx, ids: Record<string, unknown>): Promise<WebhookResult> {
  const claim = await claimOrRetry(ctx, { kind: "order_confirmation", dedupeKey: parsed.orderId, orderId: parsed.orderId, snapshot: parsed, staleAfterMs: ctx.deps.staleClaimMs ?? DEFAULT_STALE_CLAIM_MS });
  if (!claim.claimed) return duplicate(ctx, claim, { orderId: parsed.orderId });
  try {
    await write(ctx, ctx.deps.store.markSkipped("order_confirmation", parsed.orderId, claim.token, "subscription_renewal"), "mark_skipped");
  } catch (error) {
    // Nothing was sent: release the claim as a certain failure so Shopify's retry can record the skip.
    await write(ctx, ctx.deps.store.markFailed("order_confirmation", parsed.orderId, claim.token, errorMessage(error), false), "mark_failed").catch(() => {});
    throw error;
  }
  ctx.log({ event: "skipped", reason: "subscription_renewal", signal, ...ids });
  return ok({ skipped: true, reason: "subscription_renewal" });
}

async function fulfillment(payload: unknown, ctx: Ctx): Promise<WebhookResult> {
  const f = parseFulfillment(payload);
  if (!f) {
    ctx.log({ event: "skipped", reason: "invalid_fulfillment_payload" });
    return ok({ skipped: true, reason: "invalid_fulfillment_payload" });
  }
  const ids = { orderId: f.orderId, fulfillmentId: f.fulfillmentId, fulfillmentStatus: f.status };
  const readiness = shipmentReadiness(f);
  if (!readiness.ready) {
    // No ledger write: a later fulfillments/update that adds tracking must still be able to send.
    ctx.log({ event: "skipped", reason: readiness.reason, ...ids });
    return ok({ skipped: true, reason: readiness.reason });
  }
  const { store } = ctx.deps;
  const [snapshot, shippedElsewhere] = await withTimeout(
    Promise.all([store.getOrderSnapshot(f.orderId), store.shippedQuantities(f.orderId, f.fulfillmentId)]),
    Math.min(1500, ctx.remaining() - 2000),
    "ledger_read",
  );
  const admin = !snapshot || !(f.email ?? snapshot.email) ? await lookupAdmin(ctx, f.orderId, 1200) : null;
  const orderLines = snapshot?.lineItems ?? admin?.lineItems ?? null;
  const known = new Map((snapshot?.lineItems ?? []).map((line) => [line.id, line]));
  const plans = new Map((admin?.lineItems ?? []).map((line) => [line.id, line.sellingPlanName]));
  const shipmentLines = await images(
    ctx,
    f.lineItems.map((line) => ({
      ...line,
      imageUrl: known.get(line.id)?.imageUrl ?? null,
      sellingPlanName: line.sellingPlanName ?? known.get(line.id)?.sellingPlanName ?? plans.get(line.id) ?? null,
    })),
    1200,
  );
  const to = f.email ?? snapshot?.email ?? admin?.email ?? null;
  const fresh: ShipmentDetails = {
    fulfillmentId: f.fulfillmentId,
    orderId: f.orderId,
    orderName: snapshot?.orderName ?? admin?.name ?? (f.name ? f.name.split(".")[0] : null) ?? `#${f.orderId}`,
    email: to,
    firstName: snapshot?.firstName ?? f.firstName ?? admin?.firstName ?? null,
    carrier: f.carrier,
    trackingNumber: f.trackingNumber,
    trackingUrl: f.trackingUrl,
    lineItems: shipmentLines,
    shippingAddress: f.destination ?? snapshot?.shippingAddress ?? admin?.shippingAddress ?? null,
    moreToFollow: hasMoreToFollow(orderLines ? { lineItems: orderLines } : null, f, shippedElsewhere),
    orderStatusUrl: snapshot?.orderStatusUrl ?? admin?.orderStatusUrl ?? null,
  };
  const ledger: ShipmentLedgerSnapshot = { lineItems: f.lineItems.map((line) => ({ id: line.id, quantity: line.quantity })), shipment: fresh };

  const claim = await claimOrRetry(ctx, { kind: "shipping_confirmation", dedupeKey: f.fulfillmentId, orderId: f.orderId, snapshot: ledger, staleAfterMs: ctx.deps.staleClaimMs ?? DEFAULT_STALE_CLAIM_MS });
  if (!claim.claimed) return duplicate(ctx, claim, { orderId: f.orderId, fulfillmentId: f.fulfillmentId });
  const stored = (claim.snapshot as ShipmentLedgerSnapshot | null)?.shipment;
  const shipment = claim.sendUncertain && isShipment(stored) && stored.fulfillmentId === f.fulfillmentId ? stored : fresh;
  try {
    if (!shipment.email) {
      await write(ctx, store.markSkipped("shipping_confirmation", f.fulfillmentId, claim.token, "no_recipient"), "mark_skipped");
      ctx.log({ event: "skipped", reason: "no_recipient", ...ids });
      return ok({ skipped: true, reason: "no_recipient" });
    }
    const email = renderShippingConfirmationEmail(shipment, ctx.deps.brand);
    return await deliver(ctx, "shipping_confirmation", f.fulfillmentId, claim.token, shipment.email, email, `shipped/${f.fulfillmentId}`, claim, { ...ids, attempt: claim.attempts });
  } catch (error) {
    await write(ctx, store.markFailed("shipping_confirmation", f.fulfillmentId, claim.token, errorMessage(error), false), "mark_failed").catch(() => {});
    throw error;
  }
}
