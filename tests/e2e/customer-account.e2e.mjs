// Browser tests for IQON Daily customer accounts.
// Runs the real production build (`npm run build:vercel`) under `next start`. The Shopify
// side is a MOCK (tests/customer-account/fake-provider.mjs): hosted sign-in and logout are
// simulated by Playwright routes, token/JWKS/GraphQL calls by a server-side fetch hook.
// These tests prove the IQON Daily flow and UI, NOT live Shopify behavior.
//
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node --test --test-concurrency=1 tests/e2e/customer-account.e2e.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CLIENT_ID, SHOP_ID, createFakeProvider } from "../customer-account/fake-provider.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, "index.js")).href : "playwright-core");
const chromium = playwright.chromium || playwright.default.chromium;
const port = Number(process.env.E2E_PORT || 3919);
const base = `http://localhost:${port}`;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "iqb-customer-account-e2e-"));
const stateFile = path.join(work, "provider.json");
const serverLog = path.join(work, "server.log");
const shots = process.env.E2E_SCREENSHOTS || path.join(work, "screenshots");
fs.mkdirSync(shots, {recursive: true});
const provider = createFakeProvider({origin: base, file: stateFile});
// Sessions of record need PostgreSQL: run through scripts/account-test-db.sh (owned, loopback-only cluster).
function requiredDatabase() {
  if (!process.env.ACCOUNT_TEST_DATABASE_URL) throw new Error("run through scripts/account-test-db.sh (ACCOUNT_TEST_DATABASE_URL missing)");
  return process.env.ACCOUNT_TEST_DATABASE_URL;
}
const A = "gid://shopify/Customer/7001", NEW = "gid://shopify/Customer/7003";

try {await fetch(`${base}/`); throw new Error(`port ${port} is already in use; stop the other server first`);} catch (error) {if (error.message.includes("already in use")) throw error;}
const out = fs.openSync(serverLog, "a");
const server = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(port)], {cwd: root, stdio: ["ignore", out, out], env: {
  ...process.env, NODE_ENV: "production", SHOPIFY_STORE_DOMAIN: "", SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "",
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: CLIENT_ID, SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: SHOP_ID, CUSTOMER_ACCOUNT_PUBLIC_ORIGIN: base,
  CUSTOMER_ACCOUNT_SESSION_SECRET: Buffer.from("e2e-only-secret-e2e-only-secret-e2e-only-secret").toString("base64"),
  FAKE_CUSTOMER_ACCOUNT_STATE: stateFile, SUPPLEMENTS_DATABASE_URL: requiredDatabase(), NODE_OPTIONS: `--import ${pathToFileURL(path.join(root, "tests/e2e/customer-account-server-hook.mjs")).href}`,
}});
process.on("exit", () => server.kill("SIGTERM"));
for (let i = 0; ; i++) {
  try {if ((await fetch(`${base}/api/account/session`)).ok) break;} catch {}
  if (i > 120) throw new Error(`next start did not become ready; see ${serverLog}`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
// Hard network boundary: the browser cannot resolve any host but localhost. Routed (MOCK)
// requests are fulfilled before DNS; anything that escapes routing fails locally instead of
// reaching real Shopify or any other service.
const browser = await chromium.launch({args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"]});
test.after(async () => {await browser.close(); server.kill("SIGTERM"); console.log(`screenshots: ${shots}`);});

const external = [];
// The real public pages (verified separately); the browser here only ever reaches a MOCK of them.
const HOSTED = {policy: "https://nr9zd0-t5.myshopify.com/policies/privacy-policy", choices: "https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out"};
const AUTHORIZE = `/authentication/${SHOP_ID}/oauth/authorize`, LOGOUT = `/authentication/${SHOP_ID}/logout`;

/** Strict checks on the app's REAL /account/login response before any MOCK step runs. */
function assertLoginRedirect(status, headers, label) {
  assert.equal(status, 303, `${label}: login responds 303`);
  assert.match(headers["location"] || "", /^https:\/\//, `${label}: Location is absolute (got ${headers["location"]})`);
  const target = new URL(headers["location"] || "about:blank");
  assert.equal(target.origin + target.pathname, `https://shopify.com${AUTHORIZE}`, `${label}: Location is the provider authorize endpoint`);
  const p = target.searchParams;
  assert.equal(p.get("client_id"), CLIENT_ID);
  assert.equal(p.get("redirect_uri"), `${base}/account/callback`);
  assert.equal(p.get("response_type"), "code");
  assert.equal(p.get("scope"), "openid email customer-account-api:full");
  assert.equal(p.get("code_challenge_method"), "S256");
  for (const key of ["state", "nonce", "code_challenge"]) assert.match(p.get(key) || "", /^[A-Za-z0-9_-]{43}$/, `${label}: ${key}`);
  const cookie = headers["set-cookie"] || "";
  assert.match(cookie, /(^|\n)iqb_ca_tx=[A-Za-z0-9_-]{40,};/, `${label}: encrypted transaction cookie set`);
  for (const flag of ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=600"]) assert.ok(cookie.includes(flag), `${label}: transaction cookie ${flag}`);
  assert.equal(headers["referrer-policy"], "no-referrer");
  return target.href;
}

// Playwright only routes the first request of a redirect chain. So the app's real 303 to Shopify
// is fetched and checked here, then replaced by a tiny same-origin interstitial (keeping the real
// Set-Cookie) that navigates to the exact provider URL as a fresh, routable request. Only the
// MOCK Shopify hop is simulated; callback, cookies, session and GraphQL run on the real server.
async function context({mobile = false, customer: initialCustomer = A} = {}) {
  let customer = initialCustomer;
  provider.configure({failGraphql: 0, failToken: 0, restrictHidden: false, graphqlDelayMs: 0, idTokenSub: null});
  const ctx = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1440, height: 900}, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile});
  const hosted = [], hostedPrivacy = [];
  const hop = location => `<!doctype html><meta name="robots" content="noindex"><title>MOCK hop</title><script>location.replace(${JSON.stringify(location)})</script>`;
  await ctx.route(() => true, async route => {
    const url = new URL(route.request().url());
    if (url.origin === "https://shopify.com" && url.pathname === AUTHORIZE) {
      hosted.push("authorize");
      return route.fulfill({status: 302, headers: {location: provider.authorize(url.href, customer)}});
    }
    if (url.origin === "https://shopify.com" && url.pathname === LOGOUT) {
      hosted.push(`logout:${url.searchParams.has("id_token_hint")}`);
      assert.equal(url.searchParams.get("post_logout_redirect_uri"), `${base}/account/signed-out`);
      return route.fulfill({status: 302, headers: {location: url.searchParams.get("post_logout_redirect_uri")}});
    }
    if (url.origin === "https://shopify.com" && url.pathname.startsWith(`/${SHOP_ID}/account/`)) return route.fulfill({status: 200, contentType: "text/html", body: "<!doctype html><title>MOCK Shopify page</title><h1>MOCK Shopify hosted page</h1>"});
    if (url.href === HOSTED.choices || url.href === HOSTED.policy) {
      hostedPrivacy.push(url.href);
      return route.fulfill({status: 200, contentType: "text/html", body: "<!doctype html><title>MOCK Shopify privacy page</title><h1>MOCK of the hosted Shopify page</h1>"});
    }
    if (url.origin !== base) { external.push(url.href); return route.abort(); }
    if (url.pathname === "/__escape-probe") return route.fulfill({status: 302, headers: {location: `https://shopify.com/authentication/${SHOP_ID}/escape-probe`}});
    if (url.pathname !== "/account/login" && url.pathname !== "/account/logout") return route.continue();
    const response = await route.fetch({maxRedirects: 0});
    const headers = response.headers();
    const location = headers["location"] || "";
    if (url.pathname === "/account/login" && location.startsWith("https://")) assertLoginRedirect(response.status(), headers, "browser login");
    if (!location.startsWith("https://shopify.com/")) return route.fulfill({response});
    return route.fulfill({status: 200, headers: {"content-type": "text/html", "cache-control": "no-store", ...(headers["set-cookie"] ? {"set-cookie": headers["set-cookie"]} : {})}, body: hop(location)});
  });
  return {ctx, hosted, hostedPrivacy, signInAs: next => { customer = next; }};
}
const shot = (page, name) => page.screenshot({path: path.join(shots, `${name}.png`), fullPage: true});
/** Fail in seconds with the actual URL, instead of a 30 s timeout, if the flow leaves the app. */
function guard(page) {
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(10_000);
  page.on("framenavigated", frame => {
    if (frame !== page.mainFrame()) return;
    const url = new URL(frame.url());
    const hostedPage = url.href === HOSTED.choices || url.href === HOSTED.policy;
    if (url.origin !== base && url.protocol !== "about:" && !hostedPage && !(url.origin === "https://shopify.com" && url.pathname.startsWith(`/${SHOP_ID}/account/`))) external.push(`navigated:${url.origin}${url.pathname}`);
  });
  return page;
}
async function newPage(ctx) { return guard(await ctx.newPage()); }
async function signIn(page, returnPath = "/account") {
  await page.goto(`${base}${returnPath}`);
  await page.getByRole("link", {name: "Continue with email"}).click();
  try { await page.waitForURL(url => url.origin === base && url.pathname === returnPath && !url.search, {timeout: 8_000}); }
  catch { throw new Error(`sign-in did not return to ${returnPath}; at ${page.url()}; external=${JSON.stringify(external.slice(-3))}`); }
}

test("Daily homepage metadata uses the public canonical without mislabeling account pages", async () => {
  const {ctx} = await context();
  try {
    const page = await newPage(ctx);
    await page.goto(base);
    assert.equal(await page.title(), "IQON Daily — Supplements & Skincare");
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.iqondaily.com");
    await page.goto(`${base}/account`);
    assert.equal(await page.title(), "My Account — IQON Daily");
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0, "homepage canonical is not inherited by account pages");
  } finally { await ctx.close(); }
});

test("real /account/login response: 303 to the provider with state, nonce, PKCE and an HttpOnly transaction cookie", async () => {
  const {ctx} = await context();
  const first = await ctx.request.get(`${base}/account/login?return=%2Faccount%2Forders`, {maxRedirects: 0});
  const authorize = assertLoginRedirect(first.status(), first.headers(), "request");
  const second = await ctx.request.get(`${base}/account/login`, {maxRedirects: 0});
  const again = new URL(assertLoginRedirect(second.status(), second.headers(), "request 2"));
  assert.notEqual(again.searchParams.get("state"), new URL(authorize).searchParams.get("state"), "fresh state per attempt");
  // Fresh hop: the MOCK provider redirects back; the REAL callback consumes the transaction (latest cookie wins).
  const page = await newPage(ctx);
  const callback = provider.authorize(again.href, A);
  await page.goto(callback);
  await page.waitForURL(`${base}/account`);
  await page.getByText("Hello, Avery.").waitFor();
  // Replaying the exact callback URL cannot sign in again: the transaction is gone and the code is used.
  const replay = await ctx.request.get(callback, {maxRedirects: 0});
  assert.equal(replay.status(), 303);
  assert.equal(replay.headers()["location"], "/account?signin=expired");
  // Already signed in: login goes straight to the destination, no new transaction.
  const signedIn = await ctx.request.get(`${base}/account/login?return=%2Faccount%2Forders`, {maxRedirects: 0});
  assert.equal(signedIn.headers()["location"], "/account/orders");
  // Signed-out browser: an older attempt's code returned against a newer transaction fails the state check.
  const other = await context();
  const stale = await other.ctx.request.get(`${base}/account/login`, {maxRedirects: 0});
  assertLoginRedirect(stale.status(), stale.headers(), "request 3");
  const crossed = await other.ctx.request.get(provider.authorize(authorize, A), {maxRedirects: 0});
  assert.equal(crossed.headers()["location"], "/account?signin=failed");
  await other.ctx.close();
  await ctx.close();
});

test("negative control: an unrouted redirect hop to Shopify cannot leave the machine", async () => {
  const {ctx} = await context();
  const page = await newPage(ctx);
  const error = await page.goto(`${base}/__escape-probe`).then(() => null, e => e);
  assert.ok(error, "navigation must fail");
  assert.match(String(error.message), /ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED/);
  external.length = 0; // this probe is the only expected off-origin attempt
  await ctx.close();
});

test("signed-out visitors get the sign-in entry from the header, at desktop and phone sizes", async () => {
  for (const mobile of [false, true]) {
    const {ctx} = await context({mobile});
    const page = await newPage(ctx);
    await page.goto(`${base}/`);
    if (mobile) {
      await page.getByRole("button", {name: "Open navigation"}).click();
      await page.getByRole("link", {name: "My Account"}).click();
    } else await page.getByRole("link", {name: "My Account"}).click();
    await page.waitForURL(`${base}/account`);
    await page.getByRole("heading", {name: "Sign in or create your account."}).waitFor();
    assert.equal(await page.getByRole("link", {name: "Continue with email"}).getAttribute("href"), "/account/login?return=%2Faccount");
    await shot(page, `signed-out-${mobile ? "phone" : "desktop"}`);
    // Deep link keeps its destination through sign-in.
    await page.goto(`${base}/account/orders`);
    assert.equal(await page.getByRole("link", {name: "Continue with email"}).getAttribute("href"), "/account/login?return=%2Faccount%2Forders");
    await ctx.close();
  }
});

test("MOCK sign-in returns to the account; tokens stay out of the page, storage and URL", async () => {
  const {ctx, hosted} = await context();
  const page = await newPage(ctx);
  const urls = [];
  page.on("framenavigated", frame => {if (frame === page.mainFrame()) urls.push(frame.url());});
  await signIn(page, "/account/orders");
  await page.getByRole("link", {name: /Order #1101/}).waitFor();
  assert.deepEqual(hosted, ["authorize"]);
  const cookies = await ctx.cookies(base);
  const session = cookies.find(c => c.name === "iqb_ca");
  assert.ok(session?.httpOnly, "session cookie is HttpOnly");
  assert.equal(session.sameSite, "Lax");
  assert.equal(await page.evaluate(() => document.cookie.includes("iqb_ca")), false);
  const storage = await page.evaluate(() => JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage}));
  const html = await page.content();
  const tokens = Object.keys(provider.load().access).concat(Object.keys(provider.load().refresh));
  for (const token of tokens) {
    assert.ok(!storage.includes(token) && !html.includes(token), "token not exposed to the page");
    assert.ok(!urls.some(u => u.includes(token)), "token not in any visited URL");
  }
  assert.equal(page.url(), `${base}/account/orders`);
  await ctx.close();
});

test("real-preview regression in the browser: an id_token without sub still signs in through the real callback", async () => {
  const {ctx} = await context();
  provider.configure({idTokenSub: "absent"});
  const page = await newPage(ctx);
  await signIn(page);
  await page.getByText(/Hello, Avery/).waitFor();
  assert.equal(await page.evaluate(async () => (await (await fetch("/api/account/session")).json()).email), "avery.synthetic@example.test");
  provider.configure({idTokenSub: null});
  await ctx.close();
});

test("overview, orders and order detail render real provider rows (desktop + phone)", async () => {
  for (const mobile of [false, true]) {
    const {ctx} = await context({mobile});
    const page = await newPage(ctx);
    await signIn(page);
    await page.getByRole("heading", {name: "Overview"}).waitFor();
    await page.getByText("Hello, Avery.").waitFor();
    await page.getByRole("link", {name: /Order #1101/}).waitFor();
    await page.getByText("2 active").waitFor();
    await shot(page, `overview-${mobile ? "phone" : "desktop"}`);
    await page.getByRole("link", {name: /Order #1101/}).click();
    await page.getByRole("heading", {name: "Order #1101"}).waitFor();
    await page.getByText("Delivered").first().waitFor();
    assert.match(await page.getByRole("link", {name: "Order status page"}).getAttribute("href"), /^https:\/\/shopify\.com\//);
    await shot(page, `order-detail-${mobile ? "phone" : "desktop"}`);
    // Another customer's order id is not found, not leaked.
    await page.goto(`${base}/account/orders/9201`);
    await page.getByText("We couldn’t find that order.").waitFor();
    await ctx.close();
  }
});

test("address book: validation, add as default, set default, remove — persisted through the provider", async () => {
  const {ctx} = await context();
  const page = await newPage(ctx);
  await signIn(page, "/account/addresses");
  await page.getByText("100 Mock Street").waitFor();
  await page.getByRole("button", {name: "Add address"}).click();
  const form = page.getByRole("form", {name: "New address"});
  await form.getByRole("button", {name: "Save address"}).click();
  await form.getByText("Enter a street address.").waitFor();
  await form.getByText("Choose a state or region.").waitFor();
  await shot(page, "address-validation-desktop");
  await form.getByLabel("First name").fill("Avery");
  await form.getByLabel("Last name").fill("Synthetic");
  await form.getByLabel("Street address").fill("77 Browser Lane");
  await form.getByLabel("City").fill("Austin");
  await form.getByLabel("State").selectOption("TX");
  await form.getByLabel("ZIP code").fill("00000");
  await form.getByLabel("Use as my default address").check();
  await form.getByRole("button", {name: "Save address"}).click();
  await form.getByText("Enter a valid ZIP code for Texas").waitFor(); // provider-side error on the field
  await form.getByLabel("ZIP code").fill("73301");
  await form.getByRole("button", {name: "Save address"}).click();
  await page.getByText("Address saved.").waitFor();
  const first = page.locator(".address-card").first();
  await first.getByText("77 Browser Lane").waitFor();
  await first.getByText("Default").waitFor();
  await page.reload();
  await page.locator(".address-card").first().getByText("77 Browser Lane").waitFor();
  await page.locator(".address-card", {hasText: "22 Fixture Avenue"}).getByRole("button", {name: "Set as default"}).click();
  await page.getByText("Default address updated.").waitFor();
  await page.locator(".address-card").first().getByText("22 Fixture Avenue").waitFor();
  await page.locator(".address-card", {hasText: "77 Browser Lane"}).getByRole("button", {name: "Remove"}).click();
  await page.getByRole("alertdialog").getByRole("button", {name: "Remove address"}).click();
  await page.getByText("Address removed.").waitFor();
  await page.getByRole("alertdialog").waitFor({state: "detached"});
  assert.equal(await page.getByText("77 Browser Lane").count(), 0);
  await shot(page, "addresses-desktop");
  const stored = provider.load().customers[A].addresses.map(a => a.address1);
  assert.deepEqual(stored.sort(), ["100 Mock Street", "22 Fixture Avenue"]);
  assert.equal(provider.load().customers[A].defaultAddressId, "gid://shopify/CustomerAddress/8102");
  await ctx.close();
});

test("subscriptions: skip, pause and resume through the provider; ineligible contracts show no buttons", async () => {
  for (const mobile of [false, true]) {
    const {ctx} = await context({mobile});
    const page = await newPage(ctx);
    await signIn(page, "/account/subscriptions");
    await page.getByText("Marine Collagen").first().waitFor();
    await shot(page, `subscriptions-${mobile ? "phone" : "desktop"}`);
    if (!mobile) {
      await page.locator(".subscription-card", {hasText: "Marine Collagen"}).click();
      await page.getByRole("heading", {name: "Marine Collagen"}).waitFor();
      await page.getByText("Visa ending 4242").waitFor();
      await page.getByText("Used only for this subscription. Your saved addresses don’t change it.").waitFor();
      await page.getByRole("button", {name: "Skip next order"}).click();
      await page.getByText("That delivery is skipped.").waitFor();
      await page.getByRole("button", {name: "Undo skip"}).waitFor();
      await page.getByRole("button", {name: "Pause subscription"}).click();
      await page.getByRole("alertdialog").getByRole("button", {name: "Pause subscription"}).click();
      await page.getByText("Your subscription is paused.").waitFor();
      await page.getByRole("alertdialog").waitFor({state: "detached"});
      await shot(page, "subscription-paused-desktop");
      await page.getByRole("button", {name: "Resume subscription"}).click();
      await page.getByText("Your subscription is active again.").waitFor();
      const contract = provider.load().customers[A].subscriptions.find(s => s.id.endsWith("/6101"));
      assert.equal(contract.status, "ACTIVE");
      assert.equal(contract.upcomingBillingCycles[0].skipped, true);
      await page.goto(`${base}/account/subscriptions/6103`);
      await page.getByRole("heading", {name: "Omega-3"}).waitFor();
      assert.equal(await page.getByRole("button", {name: /Pause|Cancel|Skip/}).count(), 0);
      await page.getByText("Changes to this subscription are handled by our team.").waitFor();
      await page.goto(`${base}/account/subscriptions/6201`);
      await page.getByText("We couldn’t find that subscription.").waitFor();
    } else {
      await page.locator(".subscription-card", {hasText: "Magnesium"}).click();
      await page.getByRole("button", {name: "Resume subscription"}).waitFor();
      await shot(page, "subscription-detail-phone");
      assert.equal(await page.getByRole("button", {name: "Sign out"}).count(), 1, "one visible sign-out on phones");
    }
    await ctx.close();
  }
});

test("if Shopify withholds undocumented subscription fields, the page degrades honestly", async () => {
  const {ctx} = await context();
  const page = await newPage(ctx);
  await signIn(page, "/account/subscriptions");
  provider.configure({restrictHidden: true});
  await page.goto(`${base}/account/subscriptions/6101`);
  await page.getByText("Managed by Shopify").waitFor();
  await page.getByRole("button", {name: "Pause subscription"}).waitFor();
  await shot(page, "subscription-fields-withheld-desktop");
  provider.configure({restrictHidden: false});
  await ctx.close();
});

test("guests can open /account/privacy without signing in (footer access), at desktop and phone sizes", async () => {
  for (const mobile of [false, true]) {
    const {ctx} = await context({mobile});
    const page = await newPage(ctx);
    await page.goto(`${base}/account/privacy`);
    await page.getByRole("heading", {name: "Privacy", exact: true}).waitFor();
    await page.getByText("No sign-in needed.").waitFor();
    assert.equal(await page.getByRole("link", {name: "Continue with email"}).count(), 0, "no sign-in gate");
    assert.equal(await page.getByRole("navigation", {name: "Account"}).count(), 0, "no account menu for guests");
    await shot(page, `privacy-guest-${mobile ? "phone" : "desktop"}`);
    await ctx.close();
  }
});

test("hosted privacy: the footer Privacy link opens /account/privacy with the verified Shopify pages; no custom privacy runtime remains", async () => {
  for (const mobile of [false, true]) {
    const {ctx, hostedPrivacy} = await context({mobile});
    const page = await newPage(ctx);
    await page.goto(`${base}/`);
    const footerLink = page.getByRole("contentinfo").getByRole("link", {name: "Privacy", exact: true});
    assert.equal(await footerLink.getAttribute("href"), "/account/privacy");
    await footerLink.click();
    await page.waitForURL(`${base}/account/privacy`);
    const choices = page.getByRole("link", {name: /Your Privacy Choices/});
    const policy = page.getByRole("link", {name: /Privacy policy/});
    assert.equal(await choices.getAttribute("href"), HOSTED.choices);
    assert.equal(await policy.getAttribute("href"), HOSTED.policy);
    await page.getByText("This site doesn’t run advertising or analytics tracking of its own.").waitFor();
    assert.equal(await page.getByRole("switch").count(), 0, "no custom consent controls");
    // Capture from the top with no focused skip link (client navigation keeps the footer scroll offset).
    // globals.css sets smooth scrolling, so jump instantly and wait until the page is at the top.
    await page.evaluate(() => { window.scrollTo({top: 0, behavior: "instant"}); document.activeElement?.blur?.(); });
    await page.waitForFunction(() => window.scrollY === 0);
    await shot(page, `privacy-hosted-guest-${mobile ? "phone" : "desktop"}`);
    // The link really leaves for Shopify's page (served here by a MOCK of that exact URL).
    await choices.click();
    await page.waitForURL(HOSTED.choices);
    assert.deepEqual(hostedPrivacy, [HOSTED.choices]);
    await ctx.close();
  }
  // The failed custom implementation is gone, not hidden.
  for (const method of ["GET", "POST"]) {
    const response = await fetch(`${base}/api/privacy`, {method, headers: {"content-type": "application/json", origin: base}, body: method === "POST" ? "{}" : undefined});
    assert.equal(response.status, 404, `${method} /api/privacy`);
  }
});

test("no advertising or analytics requests leave the browser on storefront and account pages", async () => {
  const {ctx} = await context();
  const page = await newPage(ctx);
  const seen = [];
  // Only the MOCK sign-in hop (fulfilled locally by the router) may leave the app origin.
  page.on("request", request => { const url = new URL(request.url()); if (url.origin !== base && !(url.origin === "https://shopify.com" && url.pathname === AUTHORIZE)) seen.push(url.href); });
  for (const path of ["/", "/collections/supplements", "/collections/skincare", "/checkout", "/account", "/account/privacy", "/help"]) {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState("networkidle");
  }
  await signIn(page);
  await page.waitForLoadState("networkidle");
  assert.deepEqual(seen, [], "no third-party requests at all");
  const cookies = (await ctx.cookies()).map(c => c.name).sort();
  assert.deepEqual(cookies.filter(name => !["iqb_ca"].includes(name)), [], "no tracking or consent cookies");
  await ctx.close();
});

test("phone: every account destination, including Privacy, is visible without scrolling the menu", async () => {
  const {ctx} = await context({mobile: true});
  const page = await newPage(ctx);
  await signIn(page);
  const nav = page.getByRole("navigation", {name: "Account"});
  for (const name of ["Overview", "Orders", "Subscriptions", "Addresses", "Profile", "Privacy"]) {
    const box = await nav.getByRole("link", {name, exact: true}).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 390, `${name} fully on screen`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "no horizontal overflow");
  await page.screenshot({path: path.join(shots, "account-nav-phone.png")});
  await nav.getByRole("link", {name: "Privacy", exact: true}).click();
  await page.waitForURL(`${base}/account/privacy`);
  await page.getByRole("link", {name: /Your Privacy Choices/}).waitFor();
  await shot(page, "privacy-hosted-signed-in-phone");
  await ctx.close();
});

test("profile edit, privacy seam, empty and error states", async () => {
  const {ctx} = await context();
  const page = await newPage(ctx);
  await signIn(page, "/account/profile");
  await page.getByLabel("First name").fill("Avery Ann");
  await page.getByRole("button", {name: "Save changes"}).click();
  await page.getByText("Your name is updated.").waitFor();
  assert.equal(provider.load().customers[A].firstName, "Avery Ann");
  await page.goto(`${base}/account/privacy`);
  // Signed in: the same hosted links, inside the account menu.
  assert.equal(await page.getByRole("link", {name: /Your Privacy Choices/}).getAttribute("href"), HOSTED.choices);
  await page.getByRole("navigation", {name: "Account"}).waitFor();
  await shot(page, "privacy-hosted-signed-in-desktop");
  // Data outage after sign-in: the section says so and recovers on retry, without signing out.
  provider.configure({failGraphql: 1});
  await page.getByRole("link", {name: "Orders"}).click();
  await page.getByText("We couldn’t reach your account right now. Please try again.").waitFor();
  await shot(page, "orders-error-desktop");
  await page.getByRole("button", {name: "Try again"}).click();
  await page.getByRole("link", {name: /Order #1101/}).waitFor();
  // Outage while loading the session: an "unavailable" state, not a sign-in prompt.
  provider.configure({failGraphql: 1});
  await page.reload();
  await page.getByRole("heading", {name: "We can’t reach your account right now."}).waitFor();
  assert.equal(await page.getByRole("link", {name: "Continue with email"}).count(), 0);
  await shot(page, "session-unavailable-desktop");
  await page.getByRole("button", {name: "Try again"}).click();
  await page.getByRole("link", {name: /Order #1101/}).waitFor();
  await ctx.close();

  for (const mobile of [false, true]) {
    const fresh = await context({mobile, customer: NEW});
    const p2 = await newPage(fresh.ctx);
    await signIn(p2);
    await p2.getByText("No orders yet.").waitFor();
    await p2.getByText("None yet").waitFor();
    await shot(p2, `overview-empty-${mobile ? "phone" : "desktop"}`);
    await p2.goto(`${base}/account/addresses`);
    await p2.getByText("No saved addresses yet.").waitFor();
    await fresh.ctx.close();
  }
});

test("two tabs: A's slow request finishing after sign-out and B's sign-in cannot bring A back", async () => {
  const {ctx, signInAs} = await context();
  const tab1 = await newPage(ctx), tab2 = await newPage(ctx);
  await signIn(tab1);
  await tab2.goto(`${base}/account`);
  await tab2.getByText(/Hello, Avery/).waitFor();
  provider.configure({graphqlDelayMs: 2500});
  // Tab 1 starts a slow account read with A's cookie.
  const late = tab1.evaluate(async () => { const r = await fetch("/api/account/overview", {cache: "no-store"}); return {status: r.status, setCookie: r.headers.has("set-cookie")}; });
  await new Promise(resolve => setTimeout(resolve, 300));
  provider.configure({graphqlDelayMs: 0});
  // Tab 2 signs out, then signs in as B, while tab 1's response is still in flight.
  await tab2.getByRole("button", {name: "Sign out"}).click();
  await tab2.waitForURL(`${base}/account/signed-out`);
  signInAs("gid://shopify/Customer/7002");
  await signIn(tab2);
  await tab2.getByText("Hello, Blake.").waitFor();
  const result = await late;
  assert.equal(result.setCookie, false);
  // Whatever tab 1 got, the browser's identity is still B everywhere.
  await tab1.goto(`${base}/account`);
  await tab1.getByText("Hello, Blake.").waitFor();
  const session = await tab2.evaluate(async () => (await (await fetch("/api/account/session")).json()).email);
  assert.equal(session, "blake.synthetic@example.test");
  await shot(tab1, "two-tab-after-race-desktop");
  await ctx.close();
});

test("sign out revokes the session locally and at the (MOCK) provider", async () => {
  const {ctx, hosted} = await context();
  const page = await newPage(ctx);
  await signIn(page);
  await page.getByRole("button", {name: "Sign out"}).click();
  await page.waitForURL(`${base}/account/signed-out`);
  await page.getByRole("heading", {name: "You’re signed out."}).waitFor();
  assert.deepEqual(hosted, ["authorize", "logout:true"]);
  // Logout revokes the session of record; the cookie is left as a dead pointer, never cleared by a response.
  assert.ok((await ctx.cookies(base)).some(c => c.name === "iqb_ca"));
  const api = await page.evaluate(async () => (await fetch("/api/account/overview")).status);
  assert.equal(api, 401);
  await page.goto(`${base}/account`);
  await page.getByRole("heading", {name: "Sign in or create your account."}).waitFor();
  await shot(page, "signed-out-after-logout-desktop");
  await ctx.close();
  assert.deepEqual(external, [], "no unexpected external requests from the browser");
});
