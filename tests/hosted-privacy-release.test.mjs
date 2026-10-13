// Release guard for the hosted-privacy account release plus the advertising-privacy handoff
// (docs/ad-tracking.md). The rejected custom consent runtime (PostgreSQL ledger, /api/privacy)
// must stay absent; the storefront itself loads no Meta code (the only Meta sender is the Shopify
// checkout pixel in shopify/custom-pixels); no server-side Meta sending or new migration exists;
// the public privacy page keeps the verified Shopify-hosted links. Run after
// `npm run build:vercel`; the build-output checks fail rather than skip without one.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));
const HOSTED = {policy: "https://nr9zd0-t5.myshopify.com/policies/privacy-policy", choices: "https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"};
const grep = (pattern, paths) => {
  // git grep exits 1 when nothing matches, which is the expected outcome here.
  try { return execFileSync("git", ["grep", "--untracked", "-lIE", pattern, "--", ...paths], {cwd: root, encoding: "utf8"}).trim(); }
  catch (error) { if (error.status !== 1) throw error; return ""; }
};

test("the rejected custom privacy runtime, its migration and route are absent from source", () => {
  for (const file of ["app/api/privacy/route.ts", "app/privacy-choices.tsx", "app/privacy.css", "lib/privacy.ts", "lib/privacy.server.ts", "lib/privacy-ledger.ts",
    "prisma/migrations/20261011000000_storefront_privacy_consents", "scripts/privacy-test-db.sh", "tests/e2e/privacy.e2e.mjs"]) assert.equal(exists(file), false, file);
  const migrations = fs.readdirSync(path.join(root, "prisma/migrations")).filter(name => name.startsWith("2026101"));
  assert.deepEqual(migrations, ["20261011010000_customer_account_sessions"], "no migration is added for tracking");
  assert.doesNotMatch(read("prisma/schema.prisma"), /StorefrontPrivacyConsent|storefront_privacy_consents/);
  assert.equal(grep("privacy-ledger|privacy-choices|lib/privacy|/api/privacy|usePrivacy|iqon_privacy", ["app", "lib", "components", "proxy.ts"]), "", "no source references the removed privacy runtime");
});

test("no Meta SDK, no server-side Meta sender, no Meta credentials; one browser-side event builder", () => {
  assert.equal(grep("connect\\.facebook\\.net|fbevents|fbq\\(|graph\\.facebook\\.com|META_CAPI|META_SHOPIFY_WEBHOOK|_meta_consent|_fbp|_fbc", ["app", "lib", "components", "proxy.ts", "next.config.ts", "shopify"]), "");
  assert.equal(grep("facebook\\.com", ["app", "lib", "components", "proxy.ts"]), "lib/meta-storefront.ts", "storefront events are built in exactly one module");
  for (const file of ["app/api/meta/track/route.ts", "app/api/webhooks/shopify/meta-purchase/route.ts", "lib/analytics"]) assert.equal(exists(file), false, file);
  assert.match(read("shopify/custom-pixels/iqon-meta-checkout.live.js"), /https:\/\/www\.facebook\.com\/tr\?/);
  assert.doesNotMatch(read("lib/shopify.server.ts") + read("app/api/ad-choice/route.ts"), /facebook/, "nothing server-side talks to Meta");
});

test("checkout handoff stays on the original path unless the visitor expressed something", () => {
  const server = read("lib/shopify.server.ts");
  assert.match(server, /if\(consent\)/, "the contextual read is used only for an expressed choice or GPC");
  assert.match(server, /process\.env\.AD_PRIVACY_CONTROLS==="on"/);
  assert.doesNotMatch(server, /set\(AD_CHOICE_COOKIE|iqon_ad_choice/, "the server never writes the choice cookie");
});

test("the privacy page links to the verified Shopify-hosted pages; consent state lives only in the browser choice cookie", () => {
  const constants = read("lib/hosted-privacy.ts");
  assert.ok(constants.includes(`"${HOSTED.policy}"`) && constants.includes(`"${HOSTED.choices}"`));
  const page = read("app/account/privacy/page.tsx");
  assert.match(page, /HOSTED_PRIVACY\.choices/);
  assert.match(page, /HOSTED_PRIVACY\.policy/);
  assert.doesNotMatch(page + read("app/account/privacy/advertising.tsx"), /fetch\(|localStorage|document\.cookie/);
});

test("build output: no /api/privacy route, no Meta SDK and no removed runtime in any client bundle", () => {
  const manifest = path.join(root, ".next/server/app-paths-manifest.json");
  assert.ok(fs.existsSync(manifest), "build output missing: run npm run build:vercel first");
  const routes = Object.keys(JSON.parse(fs.readFileSync(manifest, "utf8")));
  assert.equal(routes.filter(route => route.startsWith("/api/privacy")).length, 0);
  assert.ok(routes.includes("/account/privacy/page"));
  assert.ok(routes.includes("/api/ad-choice/route"));
  const hits = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js") && /\/api\/privacy|iqon_privacy|iqon-privacy|privacy-pending|connect\.facebook\.net|fbevents/.test(fs.readFileSync(full, "utf8"))) hits.push(path.relative(root, full));
  } };
  walk(path.join(root, ".next/static"));
  assert.deepEqual(hits, []);
});
