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
 *   200  sent, duplicate (already sent or deliberately skipped), deliberate skip
 *        (no recipient, cancelled fulfilment, awaiting tracking), unknown topic,
 *        or a permanent Resend rejection that a retry cannot fix
 *   401  wrong shop or bad signature
 *   400  unreadable JSON
 *   413  body over the size cap
 *   503  not configured, transient failure (claim released as `failed`), or
 *        another delivery currently holds the claim; Shopify will retry
 */
import { verifyShopifyWebhookSignature } from "../../affiliates/shopify-webhook";
import { SUPPLEMENTS_SHOP } from "../../affiliates/shopify-admin";
import { maskEmail } from "../emails/format";
import { resolveLineItemImages, type StorefrontImageLookup } from "../emails/images";
import { renderOrderConfirmationEmail } from "../emails/order-confirmation";
import { renderShippingConfirmationEmail } from "../emails/shipping-confirmation";
import type { EmailBrandConfig, EmailLineItem, OrderSnapshot, RenderedEmail } from "../emails/types";
import type { AdminOrderInfo, AdminOrderLookup } from "./admin-order";
import type { EmailSender } from "./sender";
import { hasMoreToFollow, parseFulfillment, parseOrderPaid, shipmentReadiness } from "./shopify-payload";
import type { ClaimResult, EmailKind, ShipmentLedgerSnapshot, TransactionalEmailStore } from "./store";

export const SUPPORTED_TOPICS = ["orders/paid", "fulfillments/create", "fulfillments/update"] as const;
export const MAX_BODY_BYTES = 1_000_000;
export const DEFAULT_BUDGET_MS = 4000;
export const DEFAULT_STALE_CLAIM_MS = 5 * 60_000;

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

/** Reads the body as text, refusing anything larger than `max` bytes without buffering it all. */
export async function readLimitedBody(request: Request, max = MAX_BODY_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const ok = (body: Record<string, unknown>): WebhookResult => ({ status: 200, body: { ok: true, ...body } });
const retry = (reason: string): WebhookResult => ({ status: 503, body: { ok: false, retry: true, reason } });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "unknown_error";
}

export async function handleShopifyOrderWebhook(rawBody: string, headers: Headers, deps: WebhookDeps): Promise<WebhookResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const remaining = () => budget - (now() - started);
  const topic = headers.get("x-shopify-topic") ?? "";
  const webhookId = headers.get("x-shopify-webhook-id") ?? headers.get("x-shopify-event-id") ?? null;
  const log = (event: Record<string, unknown>) =>
    (deps.log ?? ((e) => console.info("[order-emails]", JSON.stringify(e))))({ topic, webhookId, ms: now() - started, ...event });

  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return { status: 413, body: { ok: false, reason: "too_large" } };
  if (headers.get("x-shopify-shop-domain") !== SUPPLEMENTS_SHOP) {
    log({ event: "rejected", reason: "unexpected_shop" });
    return { status: 401, body: { ok: false, reason: "unexpected_shop" } };
  }
  const secret = deps.env.SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    log({ event: "not_configured", reason: "missing_webhook_secret" });
    return retry("not_configured");
  }
  if (!verifyShopifyWebhookSignature(rawBody, headers.get("x-shopify-hmac-sha256"), secret).valid) {
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
    payload = JSON.parse(rawBody);
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

/** Time reserved after the send to record the outcome. */
const FINISH_RESERVE_MS = 400;

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
  if (claim.status === "sent" || claim.status === "skipped") {
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
  ids: Record<string, unknown>,
): Promise<WebhookResult> {
  const { store, sender, brand } = ctx.deps;
  let outcome;
  try {
    outcome = await sender.send(
      { to, subject: email.subject, html: email.html, text: email.text, idempotencyKey, replyTo: brand.supportEmail, tag: kind },
      Math.max(500, ctx.remaining() - FINISH_RESERVE_MS),
    );
  } catch (error) {
    outcome = { ok: false as const, retryable: true, error: errorMessage(error) };
  }
  if (outcome.ok) {
    try {
      await withTimeout(store.markSent(kind, dedupeKey, token, outcome.id), Math.max(300, ctx.remaining()), "mark_sent");
    } catch (error) {
      // The email is out. A stale claim may be retried later, and Resend's
      // idempotency key turns that retry into a no-op.
      ctx.log({ event: "mark_sent_failed", error: errorMessage(error), ...ids });
    }
    ctx.log({ event: "sent", to: maskEmail(to), messageId: outcome.id, duplicateAtResend: outcome.duplicate === true, ...ids });
    return ok({ sent: true });
  }
  await store.markFailed(kind, dedupeKey, token, outcome.error).catch((error) => ctx.log({ event: "mark_failed_failed", error: errorMessage(error), ...ids }));
  ctx.log({ event: "send_failed", retryable: outcome.retryable, error: outcome.error, ...ids });
  return outcome.retryable ? retry("send_failed") : ok({ sent: false, reason: "permanent_send_failure" });
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
  // Enrichment is best effort and runs in parallel inside a fixed slice of the budget.
  const [admin, withImages] = await Promise.all([lookupAdmin(ctx, parsed.orderId, 1300), images(ctx, parsed.lineItems, 1300)]);
  const plans = new Map((admin?.lineItems ?? []).map((line) => [line.id, line.sellingPlanName]));
  const order: OrderSnapshot = {
    ...parsed,
    orderStatusUrl: parsed.orderStatusUrl ?? admin?.orderStatusUrl ?? null,
    lineItems: withImages.map((line) => ({ ...line, sellingPlanName: line.sellingPlanName ?? plans.get(line.id) ?? null })),
  };

  const claim = await claimOrRetry(ctx, { kind: "order_confirmation", dedupeKey: order.orderId, orderId: order.orderId, snapshot: order, staleAfterMs: ctx.deps.staleClaimMs ?? DEFAULT_STALE_CLAIM_MS });
  if (!claim.claimed) return duplicate(ctx, claim, { orderId: order.orderId });
  try {
    if (!order.email) {
      await ctx.deps.store.markSkipped("order_confirmation", order.orderId, claim.token, "no_recipient");
      ctx.log({ event: "skipped", reason: "no_recipient", ...ids });
      return ok({ skipped: true, reason: "no_recipient" });
    }
    if (order.test) ctx.log({ event: "test_order", note: "Shopify test order; sending normally", ...ids });
    const email = renderOrderConfirmationEmail(order, ctx.deps.brand);
    return await deliver(ctx, "order_confirmation", order.orderId, claim.token, order.email, email, `order-confirmation/${order.orderId}`, { ...ids, attempt: claim.attempts });
  } catch (error) {
    await ctx.deps.store.markFailed("order_confirmation", order.orderId, claim.token, errorMessage(error)).catch(() => {});
    throw error;
  }
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
  const orderName = snapshot?.orderName ?? admin?.name ?? (f.name ? f.name.split(".")[0] : null) ?? `#${f.orderId}`;
  const ledger: ShipmentLedgerSnapshot = { lineItems: f.lineItems.map((line) => ({ id: line.id, quantity: line.quantity })) };

  const claim = await claimOrRetry(ctx, { kind: "shipping_confirmation", dedupeKey: f.fulfillmentId, orderId: f.orderId, snapshot: ledger, staleAfterMs: ctx.deps.staleClaimMs ?? DEFAULT_STALE_CLAIM_MS });
  if (!claim.claimed) return duplicate(ctx, claim, { orderId: f.orderId, fulfillmentId: f.fulfillmentId });
  try {
    if (!to) {
      await store.markSkipped("shipping_confirmation", f.fulfillmentId, claim.token, "no_recipient");
      ctx.log({ event: "skipped", reason: "no_recipient", ...ids });
      return ok({ skipped: true, reason: "no_recipient" });
    }
    const email = renderShippingConfirmationEmail(
      {
        fulfillmentId: f.fulfillmentId,
        orderId: f.orderId,
        orderName,
        email: to,
        firstName: snapshot?.firstName ?? f.firstName ?? admin?.firstName ?? null,
        carrier: f.carrier,
        trackingNumber: f.trackingNumber,
        trackingUrl: f.trackingUrl,
        lineItems: shipmentLines,
        shippingAddress: f.destination ?? snapshot?.shippingAddress ?? admin?.shippingAddress ?? null,
        moreToFollow: hasMoreToFollow(orderLines ? { lineItems: orderLines } : null, f, shippedElsewhere),
        orderStatusUrl: snapshot?.orderStatusUrl ?? admin?.orderStatusUrl ?? null,
      },
      ctx.deps.brand,
    );
    return await deliver(ctx, "shipping_confirmation", f.fulfillmentId, claim.token, to, email, `shipped/${f.fulfillmentId}`, { ...ids, attempt: claim.attempts });
  } catch (error) {
    await store.markFailed("shipping_confirmation", f.fulfillmentId, claim.token, errorMessage(error)).catch(() => {});
    throw error;
  }
}
