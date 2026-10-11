import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";

// Real PostgreSQL proof of the privacy ledger's ordering. Run through
// scripts/privacy-test-db.sh, which provides a fresh owned loopback cluster with the
// committed migration applied. Several PrismaClients stand in for separate serverless
// instances, each with its own connection pool.
const url = process.env.PRIVACY_TEST_DATABASE_URL;
export function unsafeTestDatabase(testUrl, env = process.env) {
  if (env.SUPPLEMENTS_DATABASE_URL?.trim() && env.SUPPLEMENTS_DATABASE_URL.trim() === testUrl.trim()) return "equals SUPPLEMENTS_DATABASE_URL";
  let parsed;
  try {parsed = new URL(testUrl);} catch {return "unparseable URL";}
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) return `host ${parsed.hostname} is not loopback`;
  if ([...parsed.searchParams.keys()].some(key => ["host", "hostaddr", "service", "options"].includes(key))) return "redirecting query parameter";
  return null;
}
test("the ledger suite only runs against a loopback test database", () => {
  assert.equal(unsafeTestDatabase("postgresql://u@127.0.0.1:5555/t", {}), null);
  assert.match(unsafeTestDatabase("postgresql://u:p@ep-x.neon.tech/neondb", {}), /not loopback/);
  assert.match(unsafeTestDatabase("postgresql://u@127.0.0.1/t?host=evil.example", {}), /redirecting/);
  assert.match(unsafeTestDatabase("postgresql://u@127.0.0.1/t", {SUPPLEMENTS_DATABASE_URL: "postgresql://u@127.0.0.1/t"}), /SUPPLEMENTS_DATABASE_URL/);
});
const skip = url ? false : "PRIVACY_TEST_DATABASE_URL not set (run through scripts/privacy-test-db.sh)";

const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022});
const privacyUrl = dataUrl(compile("../lib/privacy.ts"));
const { prismaPrivacyLedger, RETENTION_DAYS } = await import(dataUrl(compile("../lib/privacy-ledger.ts")
  .replace('"./db/prisma"', JSON.stringify(dataUrl("export const prisma = null;")))
  .replace('"./db/database"', JSON.stringify(dataUrl("export const isDatabaseConfigured = () => false;")))
  .replace('"./privacy"', JSON.stringify(privacyUrl))));

const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
let clients = []; let ledgers = []; let serial = 0;
const key = () => (`${Date.now().toString(16)}${(++serial).toString(16)}`.padEnd(64, "0")).slice(0, 64);
const grant = (choices, expectedRevision, forbidden = []) => ({kind: "choices", choices, expectedRevision, forbidden});

before(async () => {
  if (!url) return;
  const unsafe = unsafeTestDatabase(url);
  if (unsafe) throw new Error(`Refusing PRIVACY_TEST_DATABASE_URL (${unsafe}).`);
  clients = Array.from({length: 4}, () => new PrismaClient({datasourceUrl: url}));
  ledgers = clients.map(prismaPrivacyLedger);
});
after(async () => {await Promise.all(clients.map(client => client.$disconnect()));});

test("a first save creates the row; unknown purposes stay null", {skip}, async () => {
  const k = key();
  assert.equal(await ledgers[0].read(k), null);
  const saved = await ledgers[0].save(k, grant({...all(null), analytics: true}, 0));
  assert.equal(saved.applied, true);
  assert.deepEqual(saved.record, {choices: {...all(null), analytics: true}, revision: 1});
  assert.deepEqual(await ledgers[1].read(k), saved.record, "another instance reads the same row");
});

test("concurrent grants against one revision: exactly one applies (compare and swap)", {skip}, async () => {
  const k = key();
  await ledgers[0].save(k, grant(all(false), 0));
  const purposes = ["analytics", "marketing", "preferences", "saleOfData"];
  const results = await Promise.all(Array.from({length: 12}, (_, i) => ledgers[i % 4].save(k, grant({...all(false), [purposes[i % 4]]: true}, 1))));
  const winners = results.map((r, i) => r.applied ? purposes[i % 4] : null).filter(Boolean);
  assert.equal(winners.length, 1, "one grant wins the revision");
  // Refused requests still apply their declines, so at most the winner's purpose is granted.
  const final = await ledgers[0].read(k);
  for (const p of purposes) if (final.choices[p] === true) assert.equal(p, winners[0]);
});

test("a withdrawal racing a grant from the same shown revision always ends withdrawn", {skip}, async () => {
  for (let round = 0; round < 40; round++) {
    const k = key();
    await ledgers[0].save(k, grant(all(true), 0));
    // Both requests were made from revision 1; the database decides the order.
    const work = [ledgers[round % 4].save(k, {kind: "withdraw", purposes: ["marketing", "saleOfData"]}), ledgers[(round + 1) % 4].save(k, grant(all(true), 1))];
    if (round % 2) work.reverse();
    await Promise.all(work);
    const final = await ledgers[2].read(k);
    assert.equal(final.choices.marketing, false, `round ${round}`);
    assert.equal(final.choices.saleOfData, false, `round ${round}`);
  }
});

test("review R1-A at the ledger: the newest withdrawal survives older withdrawals and an intervening regrant", {skip}, async () => {
  const k = key(); const l = ledgers;
  await l[0].save(k, grant(all(true), 0));                                   // r1 granted
  await l[1].save(k, {kind: "withdraw", purposes: ["analytics", "marketing", "preferences", "saleOfData"]}); // B: r2
  await l[2].save(k, grant(all(true), 2));                                   // informed regrant G: r3
  await l[3].save(k, {kind: "withdraw", purposes: ["analytics", "marketing", "preferences", "saleOfData"]}); // C: r4
  // An older withdrawal processed late re-applies a withdrawal: never a grant.
  await l[0].save(k, {kind: "withdraw", purposes: ["analytics", "marketing", "preferences", "saleOfData"]});
  // The grant G repeated late (a retry) names revision 2: refused.
  const late = await l[1].save(k, grant(all(true), 2));
  assert.equal(late.applied, false);
  assert.deepEqual((await l[2].read(k)).choices, all(false));
  // A fresh informed regrant against the current revision works.
  const current = await l[0].read(k);
  assert.equal((await l[3].save(k, grant(all(true), current.revision))).applied, true);
  assert.deepEqual((await l[0].read(k)).choices, all(true));
});

test("repeated withdrawals do not advance the revision, so they cannot invalidate a fresh form", {skip}, async () => {
  const k = key();
  await ledgers[0].save(k, grant(all(false), 0));
  const before = await ledgers[0].read(k);
  await Promise.all(ledgers.map(l => l.save(k, {kind: "withdraw", purposes: ["marketing"]})));
  assert.equal((await ledgers[0].read(k)).revision, before.revision);
});

test("a refused grant still applies the withdrawals in the same request", {skip}, async () => {
  const k = key();
  await ledgers[0].save(k, grant(all(true), 0));
  await ledgers[0].save(k, {kind: "withdraw", purposes: ["marketing"]});
  const stale = await ledgers[1].save(k, grant({analytics: false, marketing: true, preferences: true, saleOfData: true}, 1));
  assert.equal(stale.applied, false);
  assert.deepEqual(stale.record.choices, {analytics: false, marketing: false, preferences: true, saleOfData: true});
});

test("GPC forbidden purposes cannot be newly granted even with the current revision", {skip}, async () => {
  const k = key();
  const refused = await ledgers[0].save(k, grant(all(true), 0, ["marketing", "saleOfData"]));
  assert.equal(refused.applied, false);
  const allowed = await ledgers[0].save(k, grant({...all(true), marketing: false, saleOfData: false}, refused.record.revision, ["marketing", "saleOfData"]));
  assert.equal(allowed.applied, true);
});

test("each GPC purpose is enforced on its own", {skip}, async () => {
  for (const purpose of ["marketing", "saleOfData"]) {
    const k = key();
    const refused = await ledgers[0].save(k, grant({...all(false), [purpose]: true}, 0, ["marketing", "saleOfData"]));
    assert.equal(refused.applied, false, purpose);
    assert.notEqual(refused.record.choices[purpose], true, purpose);
  }
});

test("rows untouched for the retention period are removed after later saves", {skip}, async () => {
  const stale = key(); const fresh = key();
  await ledgers[0].save(stale, grant(all(true), 0));
  await clients[0].$executeRawUnsafe(`UPDATE storefront_privacy_consents SET updated_at = CURRENT_TIMESTAMP - interval '${RETENTION_DAYS + 1} days' WHERE visitor_key = '${stale}'`);
  await ledgers[1].save(fresh, grant(all(false), 0));
  assert.equal(await ledgers[0].read(stale), null);
  assert.ok(await ledgers[0].read(fresh));
});

test("permission and schema failures surface as errors, never as a saved grant", {skip}, async () => {
  const role = `privacy_readonly_${serial++}`;
  await clients[0].$executeRawUnsafe(`CREATE ROLE ${role} LOGIN`);
  await clients[0].$executeRawUnsafe(`GRANT SELECT ON storefront_privacy_consents TO ${role}`);
  const limitedUrl = new URL(url); limitedUrl.username = role;
  const limited = new PrismaClient({datasourceUrl: limitedUrl.href});
  try {
    const k = key();
    await assert.rejects(prismaPrivacyLedger(limited).save(k, grant(all(true), 0)));
    assert.equal(await ledgers[0].read(k), null);
  } finally {
    await limited.$disconnect();
    await clients[0].$executeRawUnsafe(`REVOKE ALL ON storefront_privacy_consents FROM ${role}`);
    await clients[0].$executeRawUnsafe(`DROP ROLE ${role}`);
  }
  const otherDb = new URL(url); otherDb.pathname = "/postgres";
  const missing = new PrismaClient({datasourceUrl: otherDb.href});
  try {await assert.rejects(prismaPrivacyLedger(missing).read(key()), "the table does not exist before the migration");}
  finally {await missing.$disconnect();}
});
