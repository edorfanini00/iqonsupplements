// Release guard for the hosted-privacy alternative: the custom consent implementation that was
// merged from the privacy branch must be absent from source, build output and checkout, and the
// public privacy page must point at the verified Shopify-hosted pages. Run after a build
// (`npm run build:vercel`); the build-output checks fail rather than skip without one.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));
const MAIN = "d7c9c0606fcc9f900632d9fc3823f7e6c0d47a30";
const HOSTED = {policy: "https://nr9zd0-t5.myshopify.com/policies/privacy-policy", choices: "https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"};

test("the custom privacy implementation, its migration and route are absent from source", () => {
  for (const file of ["app/api/privacy/route.ts", "app/privacy-choices.tsx", "app/privacy.css", "lib/privacy.ts", "lib/privacy.server.ts", "lib/privacy-ledger.ts",
    "prisma/migrations/20261011000000_storefront_privacy_consents", "scripts/privacy-test-db.sh", "tests/e2e/privacy.e2e.mjs"]) assert.equal(exists(file), false, file);
  const migrations = fs.readdirSync(path.join(root, "prisma/migrations")).filter(name => name.startsWith("2026101"));
  assert.deepEqual(migrations, ["20261011010000_customer_account_sessions"], "only the account session migration is new");
  assert.doesNotMatch(read("prisma/schema.prisma"), /StorefrontPrivacyConsent|storefront_privacy_consents/);
  // git grep exits 1 when nothing matches, which is the expected outcome here.
  let sources = "";
  try { sources = execFileSync("git", ["grep", "--untracked", "-lIE", "privacy-ledger|privacy-choices|lib/privacy|/api/privacy|usePrivacy|visitorConsent|iqon_privacy", "--", "app", "lib", "components", "proxy.ts"], {cwd: root, encoding: "utf8"}).trim(); }
  catch (error) { if (error.status !== 1) throw error; }
  assert.equal(sources, "", "no source references the removed privacy runtime");
});

test("checkout, cart and layout are byte-identical to main: no consent dependency in checkout", () => {
  for (const file of ["lib/shopify.server.ts", "lib/shopify-operations.ts", "lib/shopify.ts", "app/api/checkout/route.ts", "app/api/cart/route.ts", "app/layout.tsx", "tests/cart-routes.test.mjs"]) {
    assert.equal(read(file), execFileSync("git", ["show", `${MAIN}:${file}`], {cwd: root, encoding: "utf8"}), file);
  }
});

test("store shell retains the public Privacy link without a custom consent runtime", () => {
  assert.match(read("app/store-shell.tsx"), /href="\/account\/privacy" prefetch=\{false\}>Privacy<\/Link>/);
});

test("the privacy page links to the verified Shopify-hosted pages and keeps no consent state", () => {
  const constants = read("lib/hosted-privacy.ts");
  assert.ok(constants.includes(`"${HOSTED.policy}"`) && constants.includes(`"${HOSTED.choices}"`));
  const page = read("app/account/privacy/page.tsx");
  assert.match(page, /HOSTED_PRIVACY\.choices/);
  assert.match(page, /HOSTED_PRIVACY\.policy/);
  assert.doesNotMatch(page, /useState|fetch\(|localStorage|document\.cookie/);
});

test("build output: no /api/privacy route and no privacy runtime in any client bundle", () => {
  const manifest = path.join(root, ".next/server/app-paths-manifest.json");
  assert.ok(fs.existsSync(manifest), "build output missing: run npm run build:vercel first");
  const routes = Object.keys(JSON.parse(fs.readFileSync(manifest, "utf8")));
  assert.equal(routes.filter(route => route.startsWith("/api/privacy")).length, 0);
  assert.ok(routes.includes("/account/privacy/page"));
  const hits = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js") && /\/api\/privacy|iqon_privacy|iqon-privacy|privacy-pending|visitorConsent/.test(fs.readFileSync(full, "utf8"))) hits.push(path.relative(root, full));
  } };
  walk(path.join(root, ".next/static"));
  assert.deepEqual(hits, []);
});
