// Browser tests for privacy choices and the checkout consent handoff.
// Runs the real production build (`npm run build:vercel`) under `next start` with an
// in process Shopify fixture (fake-shopify.mjs). Hosted checkout and the Shopify opt out
// page are local stubs: these tests prove storefront behavior, not Shopify checkout behavior.
//
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node --test tests/e2e/privacy.e2e.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, "index.js")).href : "playwright-core");
const chromium = playwright.chromium || playwright.default.chromium;
const port = Number(process.env.E2E_PORT || 3917);
const base = `http://localhost:${port}`;
const domain = "iqon-e2e.myshopify.com";
const work = fs.mkdtempSync(path.join(os.tmpdir(), "iqon-privacy-e2e-"));
const ledgerFile = path.join(work, "ledger.jsonl");
const controlFile = path.join(work, "control.json");
const serverLog = path.join(work, "server.log");
const shots = process.env.E2E_SCREENSHOTS || path.join(work, "screenshots");
fs.mkdirSync(shots, {recursive: true});
fs.writeFileSync(ledgerFile, ""); fs.writeFileSync(controlFile, "{}");
const control = value => fs.writeFileSync(controlFile, JSON.stringify(value));
const ledger = () => fs.readFileSync(ledgerFile, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
const checkoutReads = () => ledger().filter(entry => entry.operation === "IQONCheckoutCart");
const all = value => ({analytics: value, marketing: value, preferences: value, saleOfData: value});
const consentOf = url => {const cs = new URL(url).searchParams.get("_cs"); return cs ? JSON.parse(Buffer.from(cs, "base64url")) : null;};
const ADVERTISING = /facebook|fbcdn|doubleclick|google-analytics|googletagmanager|tiktok|analytics\.js|trekkie|monorail|meta\.com/i;

try {await fetch(`${base}/`); throw new Error(`port ${port} is already in use; stop the other server first`);} catch (error) {if (error.message.includes("already in use")) throw error;}
const out = fs.openSync(serverLog, "a");
const server = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(port)], {cwd: root, stdio: ["ignore", out, out], env: {
  ...process.env, NODE_ENV: "production", SHOPIFY_STORE_DOMAIN: domain, SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "e2e-fixture-token", SHOPIFY_API_VERSION: "2026-07",
  FAKE_SHOPIFY_LEDGER: ledgerFile, FAKE_SHOPIFY_CONTROL: controlFile, NODE_OPTIONS: `--import ${pathToFileURL(path.join(root, "tests/e2e/fake-shopify.mjs")).href}`,
}});
process.on("exit", () => server.kill("SIGTERM"));
for (let i = 0; ; i++) {
  try {if ((await fetch(`${base}/api/privacy`)).ok) break;} catch {}
  if (i > 120) throw new Error("next start did not become ready");
  await new Promise(resolve => setTimeout(resolve, 500));
}
const browser = await chromium.launch();
test.after(async () => {await browser.close(); server.kill("SIGTERM");});

const external = [];
// Each context gets its own cookie jar. Hosted checkout and opt out pages are local stubs.
async function context({mobile = false, gpcHeader = false, gpcBrowser = false} = {}) {
  const ctx = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1440, height: 900}, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile,
    ...(gpcHeader ? {extraHTTPHeaders: {"Sec-GPC": "1"}} : {})});
  if (gpcBrowser) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {get: () => true}));
  const visits = [];
  await ctx.route(`https://${domain}/**`, route => {
    visits.push(route.request().url());
    const page = new URL(route.request().url()).pathname.startsWith("/pages/") ? "Shopify opt out stub" : "Hosted checkout stub";
    return route.fulfill({status: 200, contentType: "text/html", body: `<!doctype html><title>${page}</title><h1>${page}</h1>`});
  });
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith(`https://${domain}/`), route => {external.push(route.request().url()); return route.abort();});
  return {ctx, visits};
}
async function addToBag(page) {
  await page.goto(`${base}/collections/supplements`);
  await page.getByRole("button", {name: "Add Creatine Monohydrate to bag"}).click();
  await page.getByRole("dialog").getByText("Creatine Monohydrate").first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".bag-summary button.button-dark")?.disabled);
}
async function closeOverlays(page) {
  for (let i = 0; i < 3 && await page.getByRole("dialog").count(); i++) {await page.keyboard.press("Escape"); await page.waitForTimeout(250);}
}
async function openChoices(page) {
  await closeOverlays(page);
  await page.getByRole("button", {name: "Your Privacy Choices"}).click();
  const dialog = page.getByRole("dialog", {name: "Your Privacy Choices"});
  await dialog.waitFor();
  await page.waitForFunction(() => document.querySelector(".privacy-sheet")?.getAnimations().every(a => a.playState !== "running") ?? false);
  return dialog;
}
async function choose(page, action) {
  const dialog = await openChoices(page);
  await dialog.getByRole("button", {name: action}).click();
  await dialog.locator(".privacy-notice").filter({hasText: /saved|couldn’t save|changed in another window/}).waitFor();
  const text = await dialog.locator(".privacy-notice").innerText();
  await page.keyboard.press("Escape");
  return text;
}
// The bag sheet offers "Secure checkout"; the /checkout page offers "Continue to checkout".
const checkoutButton = page => page.getByRole("button", {name: /^(Secure checkout|Continue to checkout)/}).first();
async function checkout(page, visits) {
  const before = visits.length;
  if (!await checkoutButton(page).isVisible()) {await page.goto(`${base}/checkout`); await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Continue to checkout/.test(b.textContent) && !b.disabled));}
  await checkoutButton(page).click();
  await page.waitForURL(`https://${domain}/**`);
  assert.equal(visits.length, before + 1);
  return visits.at(-1);
}
const savedChoices = async page => (await (await page.request.get(`${base}/api/privacy`)).json()).privacy;

test("footer controls are visible, labelled and keyboard operable on desktop and phone", async () => {
  for (const mobile of [false, true]) {
    const {ctx} = await context({mobile}); const page = await ctx.newPage();
    await page.goto(base);
    const footer = page.locator("footer.store-footer");
    const policy = footer.getByRole("link", {name: "Privacy policy"});
    const choices = footer.getByRole("button", {name: "Your Privacy Choices"});
    await choices.scrollIntoViewIfNeeded();
    assert.ok(await policy.isVisible()); assert.ok(await choices.isVisible());
    assert.equal(await policy.getAttribute("href"), `https://${domain}/policies/privacy-policy`);
    for (const control of [policy, choices]) {const box = await control.boundingBox(); assert.ok(box.height >= 24 && box.width >= 24, "target size");}
    await footer.screenshot({path: path.join(shots, `${mobile ? "phone" : "desktop"}-footer.png`)});
    await choices.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {name: "Your Privacy Choices"});
    await dialog.waitFor();
    await page.waitForFunction(() => document.querySelector(".privacy-sheet")?.getAnimations().every(a => a.playState !== "running") ?? false);
    for (const name of ["Preferences", "Analytics", "Advertising", "Sale or sharing of data"]) {
      const toggle = dialog.getByRole("switch", {name});
      assert.equal(await toggle.getAttribute("aria-checked"), "false", `${name} starts off`);
    }
    assert.match(await dialog.innerText(), /haven’t saved a choice yet/);
    assert.equal(await dialog.getByRole("link", {name: "Shopify opt out form"}).getAttribute("href"), `https://${domain}/pages/data-sharing-opt-out`);
    await page.screenshot({path: path.join(shots, `${mobile ? "phone" : "desktop"}-privacy-choices.png`)});
    const copy = await dialog.innerText() + await footer.innerText();
    assert.doesNotMatch(copy, /[‒-―]|(?<=\s)-(?=\s)/, "no dashes in customer copy");
    await page.keyboard.press("Escape");
    await dialog.waitFor({state: "detached"});
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Your Privacy Choices", "focus returns to the trigger");
    await ctx.close();
  }
});

test("unknown sends no preference; granted persists across refresh and reaches checkout", async () => {
  const {ctx, visits} = await context({mobile: true}); const page = await ctx.newPage();
  await addToBag(page);
  const unknown = await checkout(page, visits);
  assert.equal(consentOf(unknown), null);
  assert.equal(checkoutReads().at(-1).consent, null);
  await page.goBack(); await page.waitForURL(`${base}/**`);
  assert.match(await choose(page, "Allow all"), /saved/);
  await page.reload();
  const dialog = await openChoices(page);
  for (const name of ["Preferences", "Analytics", "Advertising", "Sale or sharing of data"]) assert.equal(await dialog.getByRole("switch", {name}).getAttribute("aria-checked"), "true");
  await page.screenshot({path: path.join(shots, "phone-privacy-granted.png")});
  await page.keyboard.press("Escape");
  const cookie = (await ctx.cookies()).find(c => c.name === "iqon_privacy");
  assert.ok(cookie.httpOnly); assert.equal(cookie.sameSite, "Lax");
  assert.equal(await page.evaluate(() => document.cookie.includes("iqon_privacy")), false);
  const granted = await checkout(page, visits);
  assert.deepEqual(consentOf(granted), all(true));
  await ctx.close();
});

test("granted to withdrawn after returning from checkout: the old grant is never reused", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await page.goto(base); await choose(page, "Allow all");
  await addToBag(page);
  const first = await checkout(page, visits);
  assert.deepEqual(consentOf(first), all(true));
  await page.goBack(); await page.waitForURL(`${base}/**`);
  const dialog = await openChoices(page);
  await dialog.getByRole("switch", {name: "Advertising"}).click();
  await dialog.getByRole("switch", {name: "Sale or sharing of data"}).click();
  await dialog.getByRole("button", {name: "Save choices"}).click();
  await dialog.getByText("Your privacy choices are saved.").waitFor();
  await page.keyboard.press("Escape");
  const saved = await savedChoices(page);
  assert.equal(saved.effective.marketing, false); assert.equal(saved.effective.saleOfData, false);
  const second = await checkout(page, visits);
  assert.notEqual(second, first);
  assert.deepEqual(consentOf(second), {analytics: true, preferences: true, marketing: false, saleOfData: false});
  await ctx.close();
});

test("GPC from the browser or the header overrides a stored grant and locks the controls", async () => {
  for (const options of [{gpcBrowser: true}, {gpcHeader: true}, {gpcBrowser: true, gpcHeader: true, mobile: true}]) {
    const {ctx, visits} = await context(options); const page = await ctx.newPage();
    await page.goto(base);
    const dialog = await openChoices(page);
    assert.match(await dialog.innerText(), /Global Privacy Control is on/);
    for (const name of ["Advertising", "Sale or sharing of data"]) {
      const toggle = dialog.getByRole("switch", {name});
      assert.ok(await toggle.isDisabled()); assert.equal(await toggle.getAttribute("aria-checked"), "false");
    }
    if (options.mobile) await page.screenshot({path: path.join(shots, "phone-privacy-gpc.png")});
    await dialog.getByRole("button", {name: "Allow all"}).click();
    await dialog.getByText("Your privacy choices are saved.").waitFor();
    await page.keyboard.press("Escape");
    const saved = await savedChoices(page);
    assert.equal(saved.choices.marketing, false); assert.equal(saved.choices.saleOfData, false);
    // A grant stored before GPC was switched on is still overridden at checkout.
    const now = Date.now();
    await ctx.addCookies([{name: "iqon_privacy", value: `v2.1111.99.${now}.${now}`, url: base, httpOnly: true, sameSite: "Lax"}]);
    assert.deepEqual((await savedChoices(page)).choices, all(true));
    await addToBag(page);
    const url = await checkout(page, visits);
    assert.deepEqual(consentOf(url), {analytics: true, preferences: true, marketing: false, saleOfData: false}, JSON.stringify(options));
    await ctx.close();
  }
});

test("a privacy change while checkout is in flight discards the link and fetches a fresh one", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await page.goto(base); await choose(page, "Allow all");
  await addToBag(page);
  const other = await ctx.newPage(); await other.goto(base);
  const reads = checkoutReads().length;
  control({checkoutDelayMs: 2500});
  const navigation = page.waitForURL(`https://${domain}/**`, {timeout: 20000});
  await checkoutButton(page).click();
  await new Promise(resolve => setTimeout(resolve, 300));
  // The visitor declines in another tab while the first handoff is still pending.
  await choose(other, "Decline all");
  control({});
  await navigation;
  const url = visits.at(-1);
  assert.deepEqual(consentOf(url), all(false));
  assert.ok(checkoutReads().length >= reads + 2, "the in flight link was discarded and re read");
  assert.equal(visits.length, 1, "only one navigation to checkout");
  await ctx.close();
});

test("fast double clicks start one checkout and settle choices without stale state", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await page.goto(base);
  const dialog = await openChoices(page);
  await dialog.getByRole("button", {name: "Allow all"}).dblclick();
  await dialog.getByText("Your privacy choices are saved.").waitFor();
  await page.keyboard.press("Escape");
  assert.deepEqual((await savedChoices(page)).choices, all(true));
  await addToBag(page);
  const reads = checkoutReads().length;
  control({checkoutDelayMs: 800});
  const navigation = page.waitForURL(`https://${domain}/**`);
  await checkoutButton(page).dblclick();
  await navigation; control({});
  assert.equal(checkoutReads().length, reads + 1);
  assert.equal(visits.length, 1);
  await ctx.close();
});

test("a withdrawal that cannot be saved still applies at checkout and is saved after reload", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await page.goto(base); await choose(page, "Allow all");
  await addToBag(page);
  await page.route(`${base}/api/privacy`, route => route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue());
  assert.match(await choose(page, "Decline all"), /couldn’t save.*stays off in this browser/);
  assert.deepEqual((await savedChoices(page)).choices, all(true), "server still holds the grant");
  const url = await checkout(page, visits);
  assert.deepEqual(consentOf(url), all(false), "the unsaved withdrawal restricts checkout");
  await page.goBack(); await page.waitForURL(`${base}/**`);
  await page.unroute(`${base}/api/privacy`);
  await page.reload();
  await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.startsWith("iqon-privacy-pending:")));
  assert.deepEqual((await savedChoices(page)).choices, all(false));
  await ctx.close();
});

test("checkout failures keep shopping usable and never navigate", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await addToBag(page);
  control({failCheckout: true});
  await checkoutButton(page).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(visits.length, 0);
  await page.route(`${base}/api/checkout`, route => route.abort("internetdisconnected"));
  control({});
  await checkoutButton(page).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(visits.length, 0); assert.match(page.url(), new RegExp(`^${base}`));
  // The bag still updates.
  await page.getByRole("button", {name: "Increase Creatine Monohydrate quantity"}).click();
  await page.getByRole("dialog").getByText(/Your bag\s*\(2\)/).waitFor();
  await page.unroute(`${base}/api/checkout`);
  await checkoutButton(page).click();
  await page.waitForURL(`https://${domain}/**`);
  assert.equal(visits.length, 1);
  await ctx.close();
});

test("leaving for Shopify's opt out page and returning does not pretend to sync", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await page.goto(base); await choose(page, "Allow all");
  const before = await savedChoices(page);
  const dialog = await openChoices(page);
  await dialog.getByRole("link", {name: "Shopify opt out form"}).click();
  await page.waitForURL(`https://${domain}/pages/data-sharing-opt-out`);
  assert.equal(visits.length, 1);
  await page.goBack(); await page.waitForURL(`${base}/**`);
  const after = await savedChoices(page);
  assert.deepEqual(after.choices, before.choices); assert.equal(after.version, before.version);
  const reopened = await openChoices(page);
  assert.equal(await reopened.getByRole("switch", {name: "Advertising"}).getAttribute("aria-checked"), "true");
  assert.match(await reopened.innerText(), /does not change the choices saved here/);
  await ctx.close();
});

// Regressions from the independent reviews of e47245b (functional F1 to F3, security S1 to S3).
const pendingKeys = page => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("iqon-privacy-pending:")).sort());
test("review F1/S2: a failed withdrawal in one tab restricts checkout in an already open tab", async () => {
  const {ctx, visits} = await context(); const a = await ctx.newPage();
  await a.goto(base); await choose(a, "Allow all");
  const b = await ctx.newPage(); await addToBag(b);
  await a.route(`${base}/api/privacy`, route => route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue());
  assert.match(await choose(a, "Decline all"), /couldn’t save/);
  assert.deepEqual(await pendingKeys(b), ["iqon-privacy-pending:analytics", "iqon-privacy-pending:marketing", "iqon-privacy-pending:preferences", "iqon-privacy-pending:saleOfData"]);
  assert.deepEqual((await savedChoices(b)).choices, all(true), "the server still holds the grant");
  const url = await checkout(b, visits);
  assert.deepEqual(consentOf(url), all(false), "the other tab must not hand off the old grant");
  await ctx.close();
});

test("review F1/S2: a withdrawal that fails while another tab's checkout is in flight discards that link", async () => {
  const {ctx, visits} = await context(); const a = await ctx.newPage();
  await a.goto(base); await choose(a, "Allow all");
  const b = await ctx.newPage(); await addToBag(b);
  await a.route(`${base}/api/privacy`, route => route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue());
  const reads = checkoutReads().length;
  control({checkoutDelayMs: 2000});
  const navigation = b.waitForURL(`https://${domain}/**`, {timeout: 20000});
  await checkoutButton(b).click();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.match(await choose(a, "Decline all"), /couldn’t save/);
  control({});
  await navigation;
  assert.deepEqual(consentOf(visits.at(-1)), all(false));
  assert.ok(checkoutReads().length >= reads + 2, "the first link was discarded");
  assert.equal(visits.length, 1);
  await ctx.close();
});

test("review F2: an open form is reset and flagged when choices change in another tab", async () => {
  const {ctx} = await context(); const a = await ctx.newPage();
  await a.goto(base); await choose(a, "Allow all");
  const b = await ctx.newPage(); await b.goto(base);
  const stale = await openChoices(b);
  assert.equal(await stale.getByRole("switch", {name: "Advertising"}).getAttribute("aria-checked"), "true");
  await choose(a, "Decline all");
  await stale.getByText("Your privacy choices were changed in another window. Review them before saving.").waitFor();
  assert.equal(await stale.getByRole("switch", {name: "Advertising"}).getAttribute("aria-checked"), "false");
  await b.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running"));
  await b.waitForTimeout(300); // switch thumbs use a CSS transition
  await b.screenshot({path: path.join(shots, "desktop-privacy-changed-elsewhere.png")});
  await stale.getByRole("switch", {name: "Analytics"}).click();
  await stale.getByRole("button", {name: "Save choices"}).click();
  await stale.getByText("Your privacy choices are saved.").waitFor();
  const saved = await savedChoices(b);
  assert.deepEqual(saved.choices, {...all(false), analytics: true});
  await ctx.close();
});

test("review S3: a stale form that never saw the change cannot restore a withdrawn grant", async () => {
  const {ctx} = await context(); const a = await ctx.newPage();
  await a.goto(base); await choose(a, "Allow all");
  const b = await ctx.newPage(); await b.goto(base);
  // Tab B misses every refresh, so its open form keeps the old switches and version.
  await b.route(`${base}/api/privacy`, route => route.request().method() === "GET" ? route.abort("internetdisconnected") : route.continue());
  const stale = await openChoices(b);
  await choose(a, "Decline all");
  assert.equal(await stale.getByRole("switch", {name: "Advertising"}).getAttribute("aria-checked"), "true");
  const posted = b.waitForRequest(r => r.url() === `${base}/api/privacy` && r.method() === "POST");
  await stale.getByRole("button", {name: "Save choices", exact: true}).click();
  const body = (await posted).postDataJSON();
  await stale.locator(".privacy-notice").filter({hasText: /changed in another window|couldn’t confirm/}).waitFor();
  assert.notEqual(body.expectedVersion, (await savedChoices(a)).version);
  assert.deepEqual((await savedChoices(a)).choices, all(false), "the withdrawal stands");
  await ctx.close();
});

test("review F3/S1: a late response to an earlier grant cannot restore consent after withdrawal", async () => {
  const {ctx, visits} = await context(); const page = await ctx.newPage();
  await page.goto(base); await choose(page, "Allow all");
  const shown = await savedChoices(page);
  const captured = (await ctx.cookies()).filter(c => c.name.startsWith("iqon_privacy")).map(c => `${c.name}=${c.value}`).join("; ");
  await choose(page, "Decline all");
  assert.deepEqual((await savedChoices(page)).choices, all(false));
  // The earlier grant request, carrying its original cookies, is answered now...
  const late = await fetch(`${base}/api/privacy`, {method: "POST", headers: {Origin: base, "Content-Type": "application/json", Cookie: captured}, body: JSON.stringify({choices: all(true), expectedVersion: shown.version})});
  assert.equal(late.status, 200, "the server cannot see cookies the request did not carry");
  // ...and its Set-Cookie reaches the browser last, as a delayed response would.
  const issued = late.headers.getSetCookie().map(line => line.split(";")[0].split("="));
  assert.ok(issued.length >= 1);
  await ctx.addCookies(issued.map(([name, value]) => ({name, value, url: base, httpOnly: true, sameSite: "Lax"})));
  await page.reload();
  assert.deepEqual((await savedChoices(page)).choices, all(false));
  const dialog = await openChoices(page);
  assert.equal(await dialog.getByRole("switch", {name: "Advertising"}).getAttribute("aria-checked"), "false");
  await page.keyboard.press("Escape");
  await addToBag(page);
  assert.deepEqual(consentOf(await checkout(page, visits)), all(false));
  await ctx.close();
});

test("F4: the unchosen state is described without promising that anything is off", async () => {
  const {ctx} = await context(); const page = await ctx.newPage();
  await page.goto(base);
  const text = await (await openChoices(page)).innerText();
  assert.match(text, /haven’t saved a choice yet\. Until you do, no preference is recorded and the standard privacy settings for your region apply\./);
  assert.doesNotMatch(text, /stay off until you do/);
  await ctx.close();
});

test("no advertising or analytics requests, Shopify links or checkout secrets leak", async () => {
  assert.deepEqual(external.filter(url => ADVERTISING.test(url)), []);
  const entries = ledger();
  assert.deepEqual(entries.filter(entry => entry.blockedOutbound), [], "server made no outbound request besides the Shopify fixture");
  assert.ok(checkoutReads().every(entry => entry.hasDirective && entry.version === "2026-07"));
  const logs = fs.readFileSync(serverLog, "utf8");
  assert.doesNotMatch(logs, /_cs=|\/cart\/c\/|e2e-fixture-token|key=e2e-fixture/);
  fs.writeFileSync(path.join(shots, "..", "e2e-summary.json"), JSON.stringify({checkoutReads: checkoutReads().length, externalRequestsAborted: external.length, advertising: external.filter(url => ADVERTISING.test(url)).length}, null, 1));
});
