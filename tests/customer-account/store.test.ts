// Session store invariants, directly against the owned PostgreSQL. Each conditional statement
// is checked on its own, so no guard is only covered by another one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { prisma, store } from "./harness";

const id = () => randomBytes(24).toString("base64url");
async function row(now: number) {
  const key = id();
  await store.create({id: key, secretHash: "h".repeat(43), customerSub: "gid://shopify/Customer/1", tokens: "sealed", accessExpiresAt: now, expiresAt: now + 86_400_000}, now);
  return key;
}

test("a lease is exclusive until it lapses, and only for the current generation", async () => {
  const now = Date.now(), key = await row(now);
  assert.equal(await store.acquireLease(key, 0, "a", now, now + 1000), true);
  assert.equal(await store.acquireLease(key, 0, "b", now + 999, now + 2000), false, "held");
  assert.equal(await store.acquireLease(key, 0, "b", now + 1000, now + 2000), true, "lapsed lease can be taken over");
  assert.equal(await store.completeRefresh(key, 0, "a", "t1", now, now), false, "the previous holder can no longer install");
  assert.equal(await store.completeRefresh(key, 0, "b", "t1", now, now), true);
  assert.equal(await store.acquireLease(key, 0, "c", now, now + 1000), false, "stale generation");
  assert.equal((await store.get(key))!.generation, 1);
});

test("refreshed tokens are never installed on a revoked row, even by a live lease holder", async () => {
  const now = Date.now(), key = await row(now);
  assert.equal(await store.acquireLease(key, 0, "a", now, now + 10_000), true);
  // Revocation recorded without touching the lease (as by an older code path or an operator).
  await prisma.$executeRaw`UPDATE customer_account_sessions SET revoked_at = ${new Date(now)} WHERE id = ${key}`;
  assert.equal(await store.completeRefresh(key, 0, "a", "t1", now, now), false);
  assert.equal((await store.get(key))!.tokens, "sealed");
});

test("revocation is permanent and generation-guarded when asked", async () => {
  const now = Date.now(), key = await row(now);
  assert.equal(await store.revoke(key, "refresh_rejected", now, 5), false, "wrong generation");
  assert.equal(await store.revoke(key, "logout", now), true);
  assert.equal(await store.revoke(key, "logout", now), false, "already revoked");
  assert.equal(await store.acquireLease(key, 0, "a", now, now + 1000), false);
});

test("purge removes only expired or long-revoked rows", async () => {
  const now = Date.now();
  const live = await row(now), revokedOld = await row(now), revokedNew = await row(now);
  await store.revoke(revokedOld, "logout", now - 10_000);
  await store.revoke(revokedNew, "logout", now);
  await store.purge(now, 5_000, 1000);
  assert.ok(await store.get(live));
  assert.equal(await store.get(revokedOld), null);
  assert.ok(await store.get(revokedNew));
});
