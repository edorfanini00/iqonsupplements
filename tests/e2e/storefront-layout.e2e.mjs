// Rendered layout regressions for the public storefront: no horizontal page overflow on narrow
// phones, readable footer links, and hydrated H1 text that keeps a word space at each <br>.
// Runs the real production build (`npm run build:vercel`) under `next start` with the MOCK Shopify
// catalog (tests/seo/fake-shopify-hook.mjs); every external request is aborted. Screenshots of this
// catalog are not production imagery. The server is started and stopped by this file.
//
//   npm run build:vercel && PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core npm run test:layout
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
const port = Number(process.env.E2E_PORT || 3931);
const base = `http://localhost:${port}`;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "iqon-layout-e2e-"));
const shots = process.env.E2E_SCREENSHOTS || path.join(work, "screenshots");
fs.mkdirSync(shots, {recursive: true});

const VIEWPORTS = [
  {name: "320", viewport: {width: 320, height: 740}, deviceScaleFactor: 2, isMobile: true, hasTouch: true},
  {name: "390", viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true},
  {name: "1440", viewport: {width: 1440, height: 900}},
];
const ROUTES = ["/", "/skincare", "/help", "/products/creatine-monohydrate", "/products/daily-travel-kit"];
const H1_TEXT = {"/": "For the life you want to live.", "/skincare": "A little care. A lot of you.", "/journal": "A little more understanding.", "/approach": "The everyday deserves attention."};

try {await fetch(`${base}/`); throw new Error(`port ${port} is already in use; stop the other server first`);} catch (error) {if (error.message.includes("already in use")) throw error;}
const out = fs.openSync(path.join(work, "server.log"), "a");
const server = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(port)], {cwd: root, stdio: ["ignore", out, out], env: {
  ...process.env, NODE_ENV: "production", VERCEL_ENV: "production", FAKE_SHOPIFY: "live", SHOPIFY_STORE_DOMAIN: "iqon-test.myshopify.com",
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "test-token", NEXT_PUBLIC_META_PIXEL_ID: "",
  NODE_OPTIONS: `--import ${pathToFileURL(path.join(root, "tests/seo/fake-shopify-hook.mjs")).href}`,
}});
process.on("exit", () => server.kill("SIGTERM"));
for (let i = 0; ; i++) {
  try {if ((await fetch(`${base}/journal`)).status) break;} catch {}
  if (i > 120) throw new Error(`next start did not become ready; see ${work}/server.log`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
const browser = await chromium.launch();
test.after(async () => {await browser.close(); server.kill("SIGTERM");});

async function open(device, url) {
  const context = await browser.newContext({...device, reducedMotion: "reduce"});
  await context.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  const page = await context.newPage();
  await page.goto(base + url, {waitUntil: "load"});
  // Hydrated: React has attached to the main landmark (networkidle never settles on some routes).
  await page.waitForFunction(() => Object.keys(document.querySelector("main") || {}).some(k => k.startsWith("__reactFiber")));
  await page.evaluate(() => document.fonts.ready);
  return {page, close: () => context.close()};
}

// WCAG 2.x relative luminance contrast for computed `rgb()` colors (opaque).
const channel = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const luminance = rgb => {const [r, g, b] = rgb.match(/[\d.]+/g).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);};
const contrast = (a, b) => {const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05);};
const footerLinkColors = page => page.$$eval(".footer-main>div:not(.footer-brand)>a", links => links.map(a => ({
  text: a.textContent, color: getComputedStyle(a).color, background: getComputedStyle(a.closest(".store-footer")).backgroundColor})));

for (const device of VIEWPORTS) {
  test(`${device.name}px: no horizontal page overflow`, async () => {
    for (const url of ROUTES) {
      const {page, close} = await open(device, url);
      const m = await page.evaluate(() => ({inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
      const slug = url === "/" ? "home" : url.slice(1).replace(/\//g, "_");
      await page.screenshot({path: path.join(shots, `${device.name}_${slug}.png`), fullPage: true});
      await close();
      if (device.isMobile) assert.equal(m.inner, device.viewport.width, `${url}: mobile layout viewport widened (${JSON.stringify(m)})`);
      assert.ok(m.scroll <= m.client && m.body <= m.client, `${url}: page scrolls sideways (${JSON.stringify(m)})`);
    }
  });

  test(`${device.name}px: footer links meet WCAG AA 4.5:1 at rest, hover and focus`, async () => {
    const {page, close} = await open(device, "/help");
    const links = await footerLinkColors(page);
    assert.ok(links.some(l => l.text === "Contact us") && links.length >= 9, JSON.stringify(links));
    for (const l of links) assert.ok(contrast(l.color, l.background) >= 4.5, `${l.text}: ${l.color} on ${l.background} = ${contrast(l.color, l.background).toFixed(2)}:1`);
    const contact = page.locator(".footer-main a[href^='mailto:']");
    await contact.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(shots, `${device.name}_help_footer.png`)});
    for (const state of ["hover", "focus"]) {
      await contact[state]();
      const [color, background] = await contact.evaluate(a => [getComputedStyle(a).color, getComputedStyle(a.closest(".store-footer")).backgroundColor]);
      assert.ok(contrast(color, background) >= 4.5, `Contact us (${state}): ${color} on ${background}`);
    }
    await close();
  });

  test(`${device.name}px: hydrated H1 text keeps word spaces at line breaks`, async () => {
    for (const [url, h1] of Object.entries(H1_TEXT)) {
      const {page, close} = await open(device, url);
      assert.deepEqual(await page.$$eval("h1", hs => hs.map(h => h.textContent)), [h1], url);
      // The visual break is preserved: the heading still renders on at least two lines.
      const lines = await page.$eval("h1", h => {const r = document.createRange(); r.selectNodeContents(h); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size;});
      assert.ok(lines >= 2, `${url}: H1 lost its line break`);
      await close();
    }
  });
}
