/**
 * Real Postgres proof that the ledger claim is atomic under concurrency.
 * Runs only when ORDER_EMAILS_TEST_DATABASE_URL points at a throwaway database
 * (the test drops and recreates supplements_transactional_emails from the
 * committed migration). Skipped automatically otherwise.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { prismaTransactionalEmailStore } from "../../lib/orders/webhooks/store";
import { handleShopifyOrderWebhook } from "../../lib/orders/webhooks/handler";
import { BRAND, SECRET, orderPaidPayload, webhookHeaders } from "./fixtures";
import { FakeSender } from "./memory";

const url = process.env.ORDER_EMAILS_TEST_DATABASE_URL;
const skip = url ? false : "ORDER_EMAILS_TEST_DATABASE_URL not set";
const MIGRATIONS = [
  "20261005000000_supplements_transactional_emails",
  "20261006000000_transactional_emails_send_uncertain",
].map((name) => new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url));

let clients: PrismaClient[] = [];

before(async () => {
  if (!url) return;
  // Several independent clients = several connection pools, like parallel serverless instances.
  clients = Array.from({ length: 4 }, () => new PrismaClient({ datasourceUrl: url }));
  const admin = clients[0];
  await admin.$executeRawUnsafe('DROP TABLE IF EXISTS "supplements_transactional_emails"');
  for (const migration of MIGRATIONS) {
    for (const statement of readFileSync(migration, "utf8").split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean)) {
      await admin.$executeRawUnsafe(statement);
    }
  }
});

after(async () => {
  await Promise.all(clients.map((c) => c.$disconnect()));
});

const claimInput = (dedupeKey: string) => ({ kind: "order_confirmation" as const, dedupeKey, orderId: dedupeKey, snapshot: { lineItems: [] }, staleAfterMs: 60_000 });

test("concurrent first claims on Postgres: exactly one winner", { skip }, async () => {
  const stores = clients.map((c) => prismaTransactionalEmailStore(c));
  const results = await Promise.all(Array.from({ length: 24 }, (_, i) => stores[i % stores.length].claim(claimInput("race-1"))));
  assert.equal(results.filter((r) => r.claimed).length, 1);
  assert.ok(results.filter((r) => !r.claimed).every((r) => !r.claimed && r.status === "sending"));
  const rows = await clients[0].transactionalEmail.findMany({ where: { dedupeKey: "race-1" } });
  assert.equal(rows.length, 1);
});

test("concurrent reclaims of a failed row: exactly one winner, attempts incremented once", { skip }, async () => {
  const stores = clients.map((c) => prismaTransactionalEmailStore(c));
  const first = await stores[0].claim(claimInput("race-2"));
  assert.ok(first.claimed);
  await stores[0].markFailed("order_confirmation", "race-2", first.token, "resend_timeout", true);
  const results = await Promise.all(Array.from({ length: 16 }, (_, i) => stores[i % stores.length].claim(claimInput("race-2"))));
  assert.equal(results.filter((r) => r.claimed).length, 1);
  const row = await clients[0].transactionalEmail.findUniqueOrThrow({ where: { kind_dedupeKey: { kind: "order_confirmation", dedupeKey: "race-2" } } });
  assert.equal(row.attempts, 2);
  assert.equal(row.status, "sending");
});

test("stale claims are reclaimable, fresh ones and sent rows are not; old token cannot finish", { skip }, async () => {
  let now = new Date("2026-10-05T12:00:00Z");
  const store = prismaTransactionalEmailStore(clients[0], () => now);
  const first = await store.claim(claimInput("stale-1"));
  assert.ok(first.claimed);
  assert.deepEqual(await store.claim(claimInput("stale-1")), { claimed: false, status: "sending" });
  now = new Date(now.getTime() + 61_000);
  const second = await store.claim(claimInput("stale-1"));
  assert.ok(second.claimed);
  await store.markSent("order_confirmation", "stale-1", first.token, "msg_old"); // stale owner: no effect
  let row = await clients[0].transactionalEmail.findUniqueOrThrow({ where: { kind_dedupeKey: { kind: "order_confirmation", dedupeKey: "stale-1" } } });
  assert.equal(row.status, "sending");
  await store.markSent("order_confirmation", "stale-1", second.token, "msg_new");
  row = await clients[0].transactionalEmail.findUniqueOrThrow({ where: { kind_dedupeKey: { kind: "order_confirmation", dedupeKey: "stale-1" } } });
  assert.equal(row.status, "sent");
  assert.equal(row.resendMessageId, "msg_new");
  now = new Date(now.getTime() + 24 * 3600_000);
  assert.deepEqual(await store.claim(claimInput("stale-1")), { claimed: false, status: "sent" });
});

test("end to end on Postgres: 10 concurrent orders/paid deliveries send one email and store the snapshot", { skip }, async () => {
  const sender = new FakeSender([], 40);
  const payload = orderPaidPayload({ id: 7000000000001, name: "#2001" });
  const body = JSON.stringify(payload);
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    handleShopifyOrderWebhook(body, webhookHeaders("orders/paid", body), {
      env: { SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET: SECRET },
      store: prismaTransactionalEmailStore(clients[i % clients.length]),
      sender,
      imageLookup: null,
      adminOrderLookup: null,
      brand: BRAND,
      log: () => {},
    })));
  assert.equal(sender.sent.length, 1);
  assert.equal(results.filter((r) => r.body.sent === true).length, 1);
  const store = prismaTransactionalEmailStore(clients[0]);
  const snapshot = await store.getOrderSnapshot("7000000000001");
  assert.equal(snapshot?.orderName, "#2001");
  assert.equal(snapshot?.lineItems.length, 3);
});

test("Resend window on Postgres: uncertain rows expire to sent_unconfirmed after 23h, certain failures stay retryable", { skip }, async () => {
  let now = new Date("2026-10-05T12:00:00Z");
  const store = prismaTransactionalEmailStore(clients[0], () => now);
  const find = (dedupeKey: string) => clients[0].transactionalEmail.findUniqueOrThrow({ where: { kind_dedupeKey: { kind: "shipping_confirmation", dedupeKey } } });
  const input = (dedupeKey: string) => ({ ...claimInput(dedupeKey), kind: "shipping_confirmation" as const, snapshot: { lineItems: [{ id: "1", quantity: 1 }], shipment: { fulfillmentId: dedupeKey } } });

  // Lost markSent: row stays `sending`.
  assert.ok((await store.claim(input("w-lost"))).claimed);
  // Uncertain failure (timeout) and certain failure (Resend refused it).
  const timedOut = await store.claim(input("w-timeout"));
  assert.ok(timedOut.claimed);
  await store.markFailed("shipping_confirmation", "w-timeout", timedOut.token, "resend_timeout", true);
  const refused = await store.claim(input("w-refused"));
  assert.ok(refused.claimed);
  await store.markFailed("shipping_confirmation", "w-refused", refused.token, "resend_rate_limit_exceeded", false);

  // Inside the window a stale claim is retried and becomes sticky uncertain; the stored snapshot comes back.
  now = new Date(now.getTime() + 10 * 60_000);
  const retry = await store.claim({ ...input("w-lost"), snapshot: { lineItems: [], shipment: { fulfillmentId: "changed" } } });
  assert.ok(retry.claimed);
  assert.deepEqual((retry.snapshot as { shipment: unknown }).shipment, { fulfillmentId: "w-lost" });
  assert.equal((await find("w-lost")).sendUncertain, true);

  now = new Date(now.getTime() + 3 * 24 * 3600_000);
  const concurrent = await Promise.all(clients.map((c) => prismaTransactionalEmailStore(c, () => now).claim(input("w-lost"))));
  assert.ok(concurrent.every((r) => !r.claimed && r.status === "sent_unconfirmed"));
  assert.deepEqual(await store.claim(input("w-timeout")), { claimed: false, status: "sent_unconfirmed" });
  assert.equal((await find("w-timeout")).lastError, "ambiguous_send_expired");
  assert.ok((await store.claim(input("w-refused"))).claimed);
  // sent_unconfirmed rows still count as shipped for partial shipment detection.
  assert.deepEqual(await store.shippedQuantities("w-lost", "other"), { "1": 1 });
});
