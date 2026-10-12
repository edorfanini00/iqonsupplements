// Browser tests for the advertising-privacy controls and checkout handoff (docs/ad-tracking.md).
// Runs the real production build (`npm run build:vercel`) under `next start` with
// AD_PRIVACY_CONTROLS=on. MOCKS: the Storefront API (tests/e2e/fake-shopify-storefront.mjs, with a
// synthetic `_cs`), the hosted checkout page and Meta's fbevents.js. The MOCK checkout runs the
// GENERATED live pixel from shopify/custom-pixels with a simulated Shopify permission (US-style
// default allowed, `_cs` and Sec-GPC applied). These tests prove IQON's side of the flow and the
// pixel's gating, NOT Shopify's or Meta's behaviour.
//
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node --test --test-concurrency=1 tests/e2e/ad-privacy.e2e.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { STORE, readState, writeState } from "./fake-shopify-storefront.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, "index.js")).href : "playwright-core");
const chromium = playwright.chromium || playwright.default.chromium;
const port = Number(process.env.E2E_PORT || 3931);
const base = `http://localhost:${port}`;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "iqb-ad-privacy-e2e-"));
const stateFile = path.join(work, "shopify.json");
const serverLog = path.join(work, "server.log");
const shots = process.env.E2E_SCREENSHOTS || path.join(work, "screenshots");
fs.mkdirSync(shots, {recursive: true});
writeState(stateFile, readState(stateFile));
const PIXEL = fs.readFileSync(path.join(root, "shopify/custom-pixels/iqon-meta-checkout.live.js"), "utf8");

try {await fetch(`${base}/`); throw new Error(`port ${port} is already in use; stop the other server first`);} catch (error) {if (error.message.includes("already in use")) throw error;}
const out = fs.openSync(serverLog, "a");
const env = {...process.env, NODE_ENV: "production", SHOPIFY_STORE_DOMAIN: STORE, SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "e2e-only-token", SHOPIFY_API_VERSION: "2026-07",
  AD_PRIVACY_CONTROLS: "on", META_STOREFRONT_EVENTS: "on", FAKE_SHOPIFY_STATE: stateFile, NODE_OPTIONS: `--import ${pathToFileURL(path.join(root, "tests/e2e/ad-privacy-server-hook.mjs")).href}`};
for (const name of ["SUPPLEMENTS_DATABASE_URL", "DATABASE_URL", "DIRECT_URL", "META_CAPI_ACCESS_TOKEN"]) delete env[name];
const server = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(port)], {cwd: root, stdio: ["ignore", out, out], env});
process.on("exit", () => server.kill("SIGTERM"));
for (let i = 0; ; i++) {
  try {if ((await fetch(`${base}/account/privacy`)).ok) break;} catch {}
  if (i > 120) throw new Error(`next start did not become ready; see ${serverLog}`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
const browser = await chromium.launch({args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"]});
test.after(async () => {await browser.close(); server.kill("SIGTERM"); console.log(`screenshots: ${shots}`);});

const external = [];
const META_STUB = "(function(){var f=window.fbq;window.__metaCalls=f.queue.map(function(a){return Array.prototype.slice.call(a)});f.callMethod=function(){window.__metaCalls.push(Array.prototype.slice.call(arguments))};window.__metaLoaded=true})();";

/** MOCK hosted checkout: runs the generated pixel with a simulated Shopify permission. */
function mockCheckout(url, gpcHeader) {
  const state = readState(stateFile);
  const cart = Object.values(state.carts).find(c => c.checkoutUrl === `${url.origin}${url.pathname}`);
  const cs = url.searchParams.get("_cs");
  const consent = cs ? JSON.parse(cs) : {};
  const privacy = {analyticsProcessingAllowed: consent.analytics ?? true, preferencesProcessingAllowed: consent.preferences ?? true,
    marketingAllowed: consent.marketing ?? true, saleOfDataAllowed: gpcHeader ? false : consent.saleOfData ?? true};
  const order = String(1000 + Number(url.pathname.split("-").pop()));
  const checkout = {token: `e2e${order}`, currencyCode: "USD", totalPrice: cart.cost.totalAmount, attributes: cart.attributes || [], order: {id: `gid://shopify/Order/${order}`},
    lineItems: cart.lines.nodes.map(line => ({quantity: line.quantity, title: line.merchandise.product.title, variant: {id: line.merchandise.id.split("/").pop(), product: {title: line.merchandise.product.title}}}))};
  return `<!doctype html><title>MOCK Shopify checkout</title><h1>MOCK checkout</h1><script>
window.__metaCalls=[];window.__checkout={consent:${JSON.stringify(cs ? consent : null)},privacy:${JSON.stringify(privacy)},attributes:${JSON.stringify(checkout.attributes)}};
var realFetch=window.fetch;window.fetch=function(u,i){var q=new URL(u).searchParams;window.__metaCalls.push(["track",q.get("ev"),{},{eventID:q.get("eid")}]);return realFetch(u,i)};
var subs={};(function(analytics,init,api){${PIXEL}})({subscribe:function(n,h){subs[n]=h}},{customerPrivacy:${JSON.stringify(privacy)}},{customerPrivacy:{subscribe:function(){}}});
Promise.all([subs.checkout_started({data:{checkout:${JSON.stringify(checkout)}}}),subs.checkout_completed({data:{checkout:${JSON.stringify(checkout)}}})]).then(function(){window.__pixelDone=true});
</script>`;
}

async function context({mobile = false, gpc = false, blockCookie = false, noBroadcast = false} = {}) {
  const ctx = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1440, height: 900}, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile,
    ...(gpc ? {extraHTTPHeaders: {"Sec-GPC": "1"}} : {})});
  if (gpc) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {get: () => true}));
  if (blockCookie) await ctx.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(Document.prototype, "cookie", {get() { return descriptor.get.call(this); }, set(value) { if (!String(value).startsWith("iqon_ad_choice=")) descriptor.set.call(this, value); }});
  });
  if (noBroadcast) await ctx.addInitScript(() => { delete window.BroadcastChannel; });
  const responses = [], meta = [];
  await ctx.route(() => true, async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.origin + url.pathname === "https://www.facebook.com/tr") {
      const headers = route.request().headers();
      meta.push({...Object.fromEntries(url.searchParams), referer: headers.referer || null, page: route.request().frame()?.url() || ""});
      return route.fulfill({status: 200, contentType: "image/gif", body: ""});
    }
    if (url.origin === `https://${STORE}` && url.pathname.startsWith("/checkouts/")) return route.fulfill({status: 200, contentType: "text/html", body: mockCheckout(url, route.request().headers()["sec-gpc"] === "1")});
    if (url.href === "https://connect.facebook.net/en_US/fbevents.js") return route.fulfill({status: 200, contentType: "text/javascript", body: META_STUB});
    if (url.origin === "https://nr9zd0-t5.myshopify.com") return route.fulfill({status: 200, contentType: "text/html", body: "<!doctype html><title>MOCK hosted privacy page</title>"});
    external.push(url.href); return route.abort();
  });
  ctx.on("response", response => responses.push({url: response.url(), setCookie: response.headers()["set-cookie"] || ""}));
  return {ctx, responses, meta};
}
const shot = async (page, name) => { await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur?.(); }); await page.screenshot({path: path.join(shots, `${name}.png`), fullPage: true}); };
const choiceCookie = async ctx => (await ctx.cookies(base)).find(c => c.name === "iqon_ad_choice")?.value ?? null;
const panel = page => page.locator("#advertising");
const status = page => panel(page).locator(".ad-choices-status");
const state = () => readState(stateFile);
const restrictionFor = cart => (cart?.attributes || []).find(a => a.key === "_iqon_ad_restriction")?.value ?? null;

async function addToBag(page, names = ["Creatine Monohydrate"]) {
  for (const name of names) {
    await page.goto(`${base}/collections/all`);
    await page.locator(".product-card").getByRole("button", {name: `Add ${name} to bag`}).click();
    await page.getByRole("button", {name: /Secure checkout/}).waitFor();
    await page.waitForFunction(() => !document.querySelector(".bag-sheet [role=status]"));
  }
}
async function checkoutFromBag(page) {
  await Promise.all([page.waitForURL(url => url.href.startsWith(`https://${STORE}/checkouts/`), {timeout: 15000}), page.getByRole("button", {name: /Secure checkout/}).click()]);
  await page.waitForFunction(() => window.__pixelDone === true);
  await page.waitForTimeout(150);
  return page.evaluate(() => ({url: location.href, checkout: window.__checkout, meta: window.__metaCalls}));
}
const tracked = meta => meta.filter(call => call[0] === "track").map(call => [call[1], call[3].eventID]);
const noConsentCookieFromServer = responses => assert.deepEqual(responses.filter(r => /iqon_ad_choice/.test(r.setCookie)).map(r => r.url), []);

test("privacy page and footer: accessible choices at desktop and phone sizes; nothing chosen by default", async () => {
  for (const mobile of [false, true]) {
    const {ctx} = await context({mobile});
    const page = await ctx.newPage();
    await page.goto(`${base}/`);
    const footerLink = page.getByRole("contentinfo").getByRole("link", {name: "Your Privacy Choices"});
    await footerLink.scrollIntoViewIfNeeded();
    await footerLink.click();
    await page.waitForURL(`${base}/account/privacy#advertising`);
    await panel(page).waitFor();
    assert.match(await status(page).innerText(), /Off on this site until you allow it/);
    const optOut = panel(page).getByRole("button", {name: "Opt out"}), allow = panel(page).getByRole("button", {name: "Allow"});
    for (const button of [optOut, allow]) assert.equal(await button.getAttribute("aria-pressed"), "false");
    const [a, b] = [await optOut.boundingBox(), await allow.boundingBox()];
    assert.ok(Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1 && a.height >= 44, "equal, touch-sized buttons");
    assert.equal(await page.locator('a[href="https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"]').count(), 1);
    assert.equal(await page.locator('a[href="https://nr9zd0-t5.myshopify.com/policies/privacy-policy"]').count(), 1);
    assert.equal(await choiceCookie(ctx), null);
    await shot(page, `privacy-${mobile ? "phone" : "desktop"}`);
    await optOut.focus(); await page.keyboard.press("Enter");
    assert.match(await status(page).innerText(), /Off\. You opted out/);
    await shot(page, `privacy-opted-out-${mobile ? "phone" : "desktop"}`);
    await ctx.close();
  }
});

test("no choice: checkout uses the plain path (Shopify defaults) and an eligible order sends one Purchase", async () => {
  const {ctx, responses} = await context();
  const page = await ctx.newPage();
  await addToBag(page);
  const result = await checkoutFromBag(page);
  assert.equal(result.checkout.consent, null, "no _cs: nothing expressed");
  assert.deepEqual(result.checkout.attributes, []);
  // The MOCK fires both events at once (hashing makes InitiateCheckout finish later); compare as a set.
  assert.deepEqual(tracked(result.meta).sort(), [["InitiateCheckout", "ic_" + createHash("sha256").update(`iqon-ic:e2e${1000 + Number(result.url.split("-").pop())}`).digest("hex")], ["Purchase", `purchase_${1000 + Number(result.url.split("-").pop())}`]].sort());
  noConsentCookieFromServer(responses);
  await ctx.close();
});

test("opt-out: the bag is restricted at once, checkout gets a full denial, and the pixel sends nothing", async () => {
  const {ctx, responses} = await context();
  const page = await ctx.newPage();
  await addToBag(page);
  await page.goto(`${base}/account/privacy`);
  const restrictCall = page.waitForResponse(r => r.url() === `${base}/api/ad-choice`);
  await panel(page).getByRole("button", {name: "Opt out"}).click();
  assert.equal((await restrictCall).status(), 200);
  assert.match(await choiceCookie(ctx), /^v1\.d\.[A-Za-z0-9_-]{22}$/);
  const cart = Object.values(state().carts).at(-1);
  assert.equal(restrictionFor(cart), "denied", "restricted before checkout is even opened");
  await page.goto(`${base}/checkout`);
  await page.getByRole("button", {name: /Continue to checkout/}).click();
  await page.waitForURL(url => url.href.startsWith(`https://${STORE}/checkouts/`));
  await page.waitForFunction(() => window.__pixelDone === true);
  const result = await page.evaluate(() => ({checkout: window.__checkout, meta: window.__metaCalls}));
  assert.deepEqual(result.checkout.consent, {marketing: false, saleOfData: false});
  assert.deepEqual(tracked(result.meta), []);
  assert.equal(await page.evaluate(() => typeof window.fbq), "undefined", "Meta never loaded");
  noConsentCookieFromServer(responses);
  await ctx.close();
});

test("allow passes the grant; a mixed cart with a never-eligible product still sends nothing", async () => {
  const {ctx} = await context();
  const page = await ctx.newPage();
  await page.goto(`${base}/account/privacy`);
  await panel(page).getByRole("button", {name: "Allow"}).click();
  assert.match(await status(page).innerText(), /Allowed/);
  await addToBag(page, ["Creatine Monohydrate", "GLP-1 Support"]);
  await page.waitForFunction(() => document.querySelectorAll(".bag-lines .cart-line").length === 2);
  const result = await checkoutFromBag(page);
  assert.deepEqual(result.checkout.consent, {marketing: true, saleOfData: true});
  assert.deepEqual(tracked(result.meta), [], "every line must be eligible");
  await ctx.close();
});

test("GPC: Allow is disabled, the bag is restricted as gpc, checkout gets saleOfData:false, nothing is sent", async () => {
  const {ctx} = await context({gpc: true, mobile: true});
  const page = await ctx.newPage();
  await page.goto(`${base}/account/privacy`);
  await panel(page).waitFor();
  await page.waitForFunction(() => /Global Privacy Control/.test(document.querySelector(".ad-choices-status")?.textContent || ""));
  assert.equal(await panel(page).getByRole("button", {name: "Allow"}).isDisabled(), true);
  await shot(page, "privacy-gpc-phone");
  await addToBag(page);
  const result = await checkoutFromBag(page);
  assert.deepEqual(result.checkout.consent, {marketing: false, saleOfData: false});
  assert.equal(restrictionFor({attributes: result.checkout.attributes}), "gpc");
  assert.deepEqual(tracked(result.meta), []);
  await ctx.close();
});

test("a stale panel in another tab cannot re-grant an opt-out it never showed", async () => {
  const {ctx} = await context({noBroadcast: true});
  const a = await ctx.newPage(), b = await ctx.newPage();
  await a.goto(`${base}/account/privacy`);
  await panel(a).getByRole("button", {name: "Allow"}).click();
  await b.goto(`${base}/account/privacy`);
  await panel(b).getByRole("button", {name: "Opt out"}).click();
  const denied = await choiceCookie(ctx);
  assert.match(denied, /^v1\.d\./);
  // Tab A still shows "Allowed" (no notification reached it) and its visitor clicks Allow again.
  assert.match(await status(a).innerText(), /Allowed/);
  await a.evaluate(() => document.querySelector("#advertising button:nth-of-type(2)").click());
  assert.equal(await choiceCookie(ctx), denied, "the opt-out is kept");
  assert.match(await panel(a).locator(".ad-choices-message").innerText(), /changed in another window/);
  assert.match(await status(a).innerText(), /Off\. You opted out/);
  // Now informed, the visitor can allow again deliberately.
  await panel(a).getByRole("button", {name: "Allow"}).click();
  assert.match(await choiceCookie(ctx), /^v1\.g\./);
  await ctx.close();
});

test("a choice changed in another tab while checkout is being prepared is re-applied before navigating", async () => {
  const {ctx} = await context();
  const a = await ctx.newPage(), b = await ctx.newPage();
  await b.goto(`${base}/account/privacy`);
  await panel(b).getByRole("button", {name: "Allow"}).click();
  await addToBag(a);
  let held = 0;
  await a.route(`${base}/api/checkout`, async route => {
    if (held++ === 0) {
      const response = await route.fetch(); // prepared with the grant
      await panel(b).getByRole("button", {name: "Opt out"}).click(); // withdrawn before the response arrives
      return route.fulfill({response});
    }
    return route.continue();
  });
  const result = await checkoutFromBag(a);
  assert.equal(held, 2, "the stale handoff was discarded and checkout prepared again");
  assert.deepEqual(result.checkout.consent, {marketing: false, saleOfData: false});
  assert.deepEqual(tracked(result.meta), []);
  await ctx.close();
});

test("handoff failures keep shopping: restricted plain URL when context fails; a retryable error only when both channels fail", async () => {
  const {ctx} = await context();
  const page = await ctx.newPage();
  await page.goto(`${base}/account/privacy`);
  await panel(page).getByRole("button", {name: "Opt out"}).click();
  await addToBag(page); // the bag is created after the opt-out, so it is not restricted yet
  assert.equal(restrictionFor(Object.values(state().carts).at(-1)), null);
  writeState(stateFile, {...state(), failContext: 2, failAttributes: 1});
  await page.getByRole("button", {name: /Secure checkout/}).click();
  await page.locator(".bag-sheet [role=alert]").filter({hasText: "temporarily unavailable"}).waitFor();
  assert.ok(page.url().startsWith(base), "no unrestricted checkout URL was opened");
  writeState(stateFile, {...state(), failContext: 2});
  const result = await checkoutFromBag(page);
  assert.equal(result.checkout.consent, null, "plain URL after the context failed");
  assert.equal(restrictionFor({attributes: result.checkout.attributes}), "denied");
  assert.deepEqual(tracked(result.meta), [], "the restriction attribute stops the pixel");
  await ctx.close();
});

test("cookie storage refused: the opt-out is honoured in this tab and sent with checkout", async () => {
  const {ctx} = await context({blockCookie: true});
  const page = await ctx.newPage();
  await page.goto(`${base}/account/privacy`);
  await panel(page).getByRole("button", {name: "Opt out"}).click();
  assert.match(await panel(page).locator(".ad-choices-message").innerText(), /didn’t let us save/);
  assert.equal(await choiceCookie(ctx), null);
  await addToBag(page);
  const result = await checkoutFromBag(page);
  assert.deepEqual(result.checkout.consent, {marketing: false, saleOfData: false});
  assert.deepEqual(tracked(result.meta), []);
  await ctx.close();
});

test("the storefront itself never loads Meta and nothing escaped the local network boundary", async () => {
  const {ctx} = await context();
  const page = await ctx.newPage();
  const requests = [];
  page.on("request", request => requests.push(request.url()));
  for (const route of ["/", "/collections/all", "/products/creatine-monohydrate", "/account/privacy", "/checkout"]) await page.goto(`${base}${route}`);
  assert.deepEqual(requests.filter(url => !url.startsWith(base)), []);
  assert.equal(await page.evaluate(() => typeof window.fbq), "undefined");
  await ctx.close();
  assert.deepEqual(external, []);
});

// ── Storefront events (META_STOREFRONT_EVENTS=on): explicit Allow only ─────────────────────────
const storefrontEvents = meta => meta.filter(e => !e.page.startsWith(`https://${STORE}`)).map(e => [e.ev, new URL(e.dl).pathname, e["cd[content_ids]"] || null]);
async function visit(page, paths) { for (const p of paths) { await page.goto(`${base}${p}`); await page.waitForLoadState("networkidle"); } }
const ALL_PATHS = ["/", "/collections/all?email=someone%40example.com#x", "/products/creatine-monohydrate", "/products/glp-1-support", "/account/privacy", "/help", "/journal"];

test("storefront: nothing is sent without an explicit Allow (no default opt-in), nor after opting out", async () => {
  for (const choice of [null, "Opt out"]) {
    const {ctx, meta} = await context();
    const page = await ctx.newPage();
    if (choice) { await page.goto(`${base}/account/privacy`); await panel(page).getByRole("button", {name: choice}).click(); }
    await visit(page, ALL_PATHS);
    await addToBag(page);
    assert.deepEqual(meta, [], String(choice));
    await ctx.close();
  }
});

test("storefront: after Allow, PageView/ViewContent/AddToCart only on reviewed routes, clean URLs, no referrer, no SDK", async () => {
  const {ctx, meta} = await context();
  const page = await ctx.newPage();
  await page.goto(`${base}/account/privacy`);
  await panel(page).getByRole("button", {name: "Allow"}).click();
  await visit(page, ALL_PATHS);
  await addToBag(page);
  await page.waitForTimeout(300);
  const C = '["52086268985639"]';
  assert.deepEqual(storefrontEvents(meta), [["PageView", "/", null], ["PageView", "/collections/all", null], ["PageView", "/products/creatine-monohydrate", null], ["ViewContent", "/products/creatine-monohydrate", C],
    ["PageView", "/collections/all", null], ["AddToCart", "/collections/all", C]]);
  for (const event of meta) {
    assert.equal(event.referer, null, "no Referer header");
    assert.equal(event.id, "1006368245818889");
    assert.match(event.eid, /^[0-9a-f]{32}$/);
    const {page: _page, ...sent} = event;
    assert.ok(!JSON.stringify(sent).includes("example.com") && !JSON.stringify(sent).includes("glp") && !JSON.stringify(sent).includes("Creatine") && !JSON.stringify(sent).includes("#"), JSON.stringify(sent));
  }
  assert.equal(await page.evaluate(() => typeof window.fbq), "undefined");
  assert.equal((await ctx.cookies()).filter(c => /^_fb/.test(c.name)).length, 0, "no Meta cookies");
  await ctx.close();
});

test("storefront: a never-eligible item in the bag suppresses AddToCart and page events (whole cart)", async () => {
  const {ctx, meta} = await context();
  const page = await ctx.newPage();
  await page.goto(`${base}/account/privacy`);
  await panel(page).getByRole("button", {name: "Allow"}).click();
  await addToBag(page, ["GLP-1 Support", "Creatine Monohydrate"]);
  await visit(page, ["/", "/products/creatine-monohydrate"]);
  assert.deepEqual(storefrontEvents(meta).filter(e => e[0] !== "PageView" || e[1] !== "/collections/all"), [], "nothing once the bag holds GLP-1 Support");
  await ctx.close();
});

test("storefront: GPC overrides a stored Allow; a withdrawal in another tab stops the next event", async () => {
  const gpcRun = await context({gpc: true});
  await gpcRun.ctx.addCookies([{name: "iqon_ad_choice", value: "v1.g.AAAAAAAAAAAAAAAAAAAAAA", url: base}]);
  const gpcPage = await gpcRun.ctx.newPage();
  await visit(gpcPage, ["/", "/products/creatine-monohydrate"]);
  assert.deepEqual(gpcRun.meta, []);
  await gpcRun.ctx.close();

  const {ctx, meta} = await context();
  const a = await ctx.newPage(), b = await ctx.newPage();
  await a.goto(`${base}/account/privacy`);
  await panel(a).getByRole("button", {name: "Allow"}).click();
  await visit(a, ["/"]);
  const before = meta.length;
  assert.equal(before, 1);
  await b.goto(`${base}/account/privacy`);
  await panel(b).getByRole("button", {name: "Opt out"}).click();
  await a.getByRole("link", {name: "Shop all"}).first().click().catch(() => {});
  await visit(a, ["/products/creatine-monohydrate"]);
  assert.equal(meta.length, before, "no event after the withdrawal");
  await ctx.close();
});
