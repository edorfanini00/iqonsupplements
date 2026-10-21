// Rendered layout regressions for the public storefront: no horizontal page overflow on narrow
// phones, readable footer links and homepage muted text, hydrated H1 text that keeps a word space
// at each <br>, the guide → product → bag → checkout handoff (the synthetic checkout URL is
// aborted: no order exists), and homepage photographs whose srcset choice still covers each frame
// at the screen's density (the eager, high-priority LCP hero included), and expanded Help and product
// accordion answers (including the approved shipping copy) and corrected Help / supplement product
// muted text at WCAG AA contrast.
// Runs the real production build (`npm run build:vercel`) under `next start` with the MOCK Shopify
// catalog (tests/seo/fake-shopify-hook.mjs); every external request is aborted. Screenshots of this
// catalog are not production imagery. The server is started and stopped by this file.
//
// Uses the pinned `playwright-core` dev dependency. Browsers are not fetched by `npm ci`, so on a
// clean machine install the matching Chromium once first. PLAYWRIGHT_CORE may optionally point at
// another playwright-core directory, as in the other e2e files.
//
//   npx playwright-core install chromium   # once per machine
//   npm run build:vercel && npm run test:layout
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
const ROUTES = ["/", "/skincare", "/help", "/collections/all", "/collections/supplements", "/journal/finding-your-supplement-format", "/journal/reading-a-supplement-label", "/products/creatine-monohydrate", "/products/daily-travel-kit"];
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

  test(`${device.name}px: hydrated guide and collection links match the server HTML`, async () => {
    for (const [url, selector] of [["/journal/finding-your-supplement-format", ".guide-products a"], ["/collections/supplements", ".catalog-selection a"], ["/products/creatine-monohydrate", ".product-guides a"]]) {
      const raw = await (await fetch(base + url)).text();
      const serverLinks = [...raw.matchAll(/<a[^>]+href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, "&"));
      const {page, close} = await open(device, url);
      const links = await page.$$eval(selector, as => as.map(a => ({href: a.getAttribute("href"), visible: a.getBoundingClientRect().width > 0 && getComputedStyle(a).visibility !== "hidden"})));
      await close();
      assert.ok(links.length >= 2, `${url}: ${JSON.stringify(links)}`);
      for (const link of links) {
        assert.ok(link.visible, `${url}: ${link.href} hidden`);
        assert.ok(serverLinks.includes(link.href), `${url}: ${link.href} missing from server HTML`);
      }
    }
  });

  test(`${device.name}px: guide → live product → one-time purchase → checkout handoff`, async () => {
    const {page, close} = await open(device, "/journal/finding-your-supplement-format");
    const link = page.locator('.guide-products a[href="/products/creatine-monohydrate"]');
    await link.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(shots, `${device.name}_guide_product_links.png`)});
    await link.click();
    await page.waitForURL(`${base}/products/creatine-monohydrate`);
    await page.waitForFunction(() => Object.keys(document.querySelector("main") || {}).some(k => k.startsWith("__reactFiber")));
    await page.locator(".purchase-option", {hasText: "One time purchase"}).click();
    const add = page.locator(".add-to-bag-row button.button-dark");
    await add.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector(".add-to-bag-row button.button-dark")?.disabled);
    assert.match(await add.textContent(), /^Add to bag\s*\$39/);
    const [cartRequest] = await Promise.all([page.waitForRequest(r => r.url().endsWith("/api/cart") && r.method() === "POST"), add.click()]);
    const body = JSON.parse(cartRequest.postData());
    assert.deepEqual([body.action, body.id, body.purchase, body.sellingPlanId], ["add", "creatine-monohydrate", "once", undefined], "one-time line, no selling plan");
    const checkout = page.locator(".bag-sheet button", {hasText: "Secure checkout"});
    await page.waitForFunction(() => !!document.querySelector(".bag-sheet") && /\$39/.test(document.querySelector(".bag-sheet").textContent));
    await page.waitForFunction(() => [...document.querySelectorAll(".bag-sheet button")].some(b => /Secure checkout/.test(b.textContent) && !b.disabled));
    await page.screenshot({path: path.join(shots, `${device.name}_bag_before_checkout.png`)});
    const [handoff] = await Promise.all([page.waitForRequest(r => r.url().startsWith("https://iqon-test.myshopify.com/cart/c/")), checkout.click()]);
    assert.match(handoff.url(), /^https:\/\/iqon-test\.myshopify\.com\/cart\/c\/synthetic-\d+\?key=synthetic$/);
    await close();
  });

  test(`${device.name}px: hydrated product pages show the shipping window only where the product is orderable`, async () => {
    for (const [url, orderable] of [["/products/creatine-monohydrate", true], ["/products/anti-aging-cleanser-with-peptides", false], ["/products/nmn", false]]) {
      const {page, close} = await open(device, url);
      const triggers = await page.$$eval("[data-slot=accordion-trigger]", ts => ts.map(t => t.textContent.trim()));
      const text = await page.evaluate(() => document.querySelector("main").innerText);
      if (orderable) {
        const trigger = page.locator("[data-slot=accordion-trigger]", {hasText: "Shipping"});
        await trigger.scrollIntoViewIfNeeded(); await trigger.click();
        assert.match(await page.locator("[data-slot=accordion-item]", {has: trigger}).innerText(), /Shipping usually takes 3 to 5 days\. Available shipping options and costs are shown at checkout\./, url);
      } else {
        assert.ok(!triggers.includes("Shipping") && !text.includes("3 to 5 days"), `${url}: ${JSON.stringify(triggers)}`);
      }
      const m = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
      assert.ok(m.scroll <= m.client, `${url}: page scrolls sideways (${JSON.stringify(m)})`);
      await close();
    }
  });
}

const LOW_CONTRAST_TEXT = [".department-switch a:not(.is-active)", ".skin-community-intro figcaption", ".skin-community-note .eyebrow", ".skin-community-note>p:not(.eyebrow)"];

for (const device of VIEWPORTS) {
  test(`${device.name}px: homepage muted text meets WCAG AA 4.5:1`, async () => {
    const {page, close} = await open(device, "/");
    // Each visible element's text color against the nearest painted background behind it.
    const items = await page.evaluate(selectors => selectors.flatMap(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => {
      let background = "rgb(255, 255, 255)";
      for (let a = e; a; a = a.parentElement) {const c = getComputedStyle(a).backgroundColor; if (c !== "transparent" && !/,\s*0\)$/.test(c)) {background = c; break;}}
      return {s, text: e.textContent.trim(), color: getComputedStyle(e).color, background};
    })), LOW_CONTRAST_TEXT);
    for (const s of LOW_CONTRAST_TEXT) assert.ok(items.some(i => i.s === s), `${s} is not rendered`);
    for (const i of items) assert.ok(contrast(i.color, i.background) >= 4.5, `${i.s} "${i.text}": ${i.color} on ${i.background} = ${contrast(i.color, i.background).toFixed(2)}:1`);
    await close();
  });

  test(`${device.name}px: homepage photographs are right-sized without losing resolution`, async () => {
    const {page, close} = await open(device, "/");
    // Load every lazy image, then compare each chosen file's real pixels with what the frame needs.
    await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach(img => {img.loading = "eager";}));
    await page.waitForFunction(() => [...document.images].filter(i => i.currentSrc.startsWith(location.origin) && i.getClientRects().length).every(i => i.complete));
    const images = await page.evaluate(async () => Promise.all([...document.images].filter(i => i.currentSrc.startsWith(location.origin) && i.getClientRects().length && i.closest("main")).map(async img => {
      const file = new Image(); file.src = img.currentSrc; await file.decode();
      const box = img.getBoundingClientRect();
      const candidates = (img.parentElement.tagName === "PICTURE" && [...img.parentElement.querySelectorAll("source")].find(s => matchMedia(s.media).matches)?.srcset || img.srcset || "")
        .split(",").map(c => c.trim().split(/\s+/)).filter(c => c[0]).map(([url, w]) => ({url: new URL(url, location.href).href, w: parseInt(w)}));
      // object-fit: cover scales the file until it fills both box dimensions.
      const cssPxPerFilePx = Math.max(box.width / file.naturalWidth, box.height / file.naturalHeight);
      return {src: img.currentSrc.replace(location.origin, ""), lcp: img.closest(".campaign-hero") !== null, loading: img.getAttribute("loading"), fetchPriority: img.getAttribute("fetchpriority"),
        density: 1 / cssPxPerFilePx, largest: !candidates.length || img.currentSrc === candidates.reduce((a, b) => b.w > a.w ? b : a).url,
        candidates};
    })));
    const dpr = device.deviceScaleFactor || 1;
    const hero = images.find(i => i.lcp && !i.src.includes("cdn.shopify"));
    assert.ok(hero, "hero photograph missing");
    assert.equal(hero.loading, null, "LCP hero must not be lazy-loaded");
    assert.equal(hero.fetchPriority, "high");
    for (const i of images) {
      // A smaller file may be chosen only when it still covers the frame at this screen density.
      if (!i.largest) assert.ok(i.density >= dpr * 0.98, `${i.src}: ${i.density.toFixed(2)} file px per CSS px < DPR ${dpr}`);
      for (const c of i.candidates) {
        const width = Number(c.url.match(/-(\d+)w\.webp$/)?.[1] ?? NaN);
        if (!Number.isNaN(width)) assert.equal(width, c.w, `${c.url}: srcset descriptor ${c.w}w`);
      }
    }
    if (device.isMobile) assert.match(hero.src, /iqon-coastal-mobile-v32-750w\.webp$/, "phones receive the 750px mobile hero");
    await close();
  });
}

const SHIPPING_ANSWER = "Shipping usually takes 3 to 5 days. Available shipping options and costs are shown at checkout.";
const WHITE = "rgb(255, 255, 255)";

for (const device of VIEWPORTS) {
  test(`${device.name}px: expanded Help and product accordion answers meet WCAG AA 4.5:1`, async () => {
    for (const [url, accordion, shippingQuestion] of [["/help", ".help-wrap", "How long does shipping take?"], ["/products/creatine-monohydrate", ".product-accordion", "Shipping"]]) {
      const {page, close} = await open(device, url);
      const triggers = page.locator(`${accordion} [data-slot='accordion-trigger']`);
      const count = await triggers.count();
      assert.ok(count >= 3, `${url}: ${count} accordion items`);
      const answers = [];
      for (let i = 0; i < count; i++) {
        const trigger = triggers.nth(i);
        if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
        // Each settled answer's text color against the nearest painted background (and plain white).
        answers.push(await trigger.evaluate(async t => {
          const content = t.closest("[data-slot='accordion-item']").querySelector("[data-slot='accordion-content']");
          await new Promise(resolve => setTimeout(resolve, 400));
          const text = [...content.querySelectorAll("*")].find(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) || content;
          let background = "rgb(255, 255, 255)";
          for (let a = text; a; a = a.parentElement) {const c = getComputedStyle(a).backgroundColor; if (c !== "transparent" && !/,\s*0\)$/.test(c)) {background = c; break;}}
          return {question: t.textContent.trim(), answer: content.textContent.trim(), height: content.getBoundingClientRect().height, color: getComputedStyle(text).color, background};
        }));
      }
      const shipping = answers.find(a => a.question === shippingQuestion);
      assert.ok(shipping?.answer.startsWith(SHIPPING_ANSWER), `${url}: shipping answer ${JSON.stringify(shipping)}`);
      if (shipping) {
        // Single-open accordions close Shipping while later answers are checked: reopen it for the capture.
        const trigger = triggers.filter({hasText: shippingQuestion}).first();
        if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
        assert.equal(await trigger.getAttribute("aria-expanded"), "true", `${url}: Shipping answer is not open for the screenshot`);
        const panel = trigger.locator("xpath=ancestor::*[@data-slot='accordion-item'][1]//*[@data-slot='accordion-content']");
        await page.waitForFunction(el => el.getBoundingClientRect().height > 0, await panel.elementHandle());
        assert.match(await panel.innerText(), /^Shipping usually takes 3 to 5 days\./);
        await panel.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await page.screenshot({path: path.join(shots, `${device.name}_${url === "/help" ? "help" : "pdp"}_shipping_answer.png`)});
      }
      await close();
      for (const a of answers) {
        assert.ok(a.height > 0, `${url} "${a.question}": answer did not expand`);
        for (const background of [a.background, WHITE]) assert.ok(contrast(a.color, background) >= 4.5, `${url} "${a.question}": ${a.color} on ${background} = ${contrast(a.color, background).toFixed(2)}:1`);
      }
    }
  });
}

// Muted text corrected to WCAG AA on Help and orderable supplement product pages (flat painted panels only;
// text over photography is excluded). Each selector must render at some width; every visible match must pass.
const CORRECTED_TEXT = {
  "/help": [".help-wrap .eyebrow", ".help-wrap>div>p:last-child"],
  "/products/creatine-monohydrate": [".purchase-option small", ".sticky-purchase small", ".fact-kicker", ".fact-art-note", ".fact-art-value>span", ".section-heading .eyebrow",
    ".supplement-pdp-story>.pdp-disclaimer", ".supplement-pdp-story .skin-kicker", ".supplement-pdp-story .skin-timing-label", ".supplement-pdp-story .skin-application-photo figcaption>span",
    ".supplement-pdp-story .skin-step-top>span", ".supplement-pdp-story .supp-research-scope", ".supplement-pdp-story .skin-compare-table tr>th:first-child:not(:has(.sr-only))",
    ".supplement-pdp-story .skin-compare-product p>span", ".supplement-pdp-story .skin-compare-table td"],
  "/products/liver-support": [".supplement-pdp-story .skin-explore-hint", ".supplement-pdp-story .supp-fact-strip dt", ".supplement-pdp-story .supp-fact-strip dd>span",
    ".supplement-pdp-story .skin-ingredient-summary", ".supplement-pdp-story .skin-ingredient-tags>span"],
};
const correctedSeen = new Set();

for (const device of VIEWPORTS) {
  test(`${device.name}px: corrected Help and supplement product text meets WCAG AA 4.5:1`, async () => {
    for (const [url, selectors] of Object.entries(CORRECTED_TEXT)) {
      const {page, close} = await open(device, url);
      // Scroll through so scroll-revealed elements (sticky purchase bar) are laid out.
      await page.evaluate(async () => {for (let y = 0; y < document.body.scrollHeight; y += 600) {scrollTo(0, y); await new Promise(r => setTimeout(r, 50));}});
      const items = await page.evaluate(selectors => selectors.flatMap(s => [...document.querySelectorAll(s)]
        .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && e.textContent.trim()).map(e => {
          let background = "rgb(255, 255, 255)";
          for (let a = e; a; a = a.parentElement) {const c = getComputedStyle(a).backgroundColor; if (c !== "transparent" && !/,\s*0\)$/.test(c)) {background = c; break;}}
          return {s, text: e.textContent.trim().slice(0, 40), color: getComputedStyle(e).color, background};
        })), selectors);
      await close();
      for (const i of items) {
        correctedSeen.add(`${url} ${i.s}`);
        assert.ok(contrast(i.color, i.background) >= 4.5, `${url} ${i.s} "${i.text}": ${i.color} on ${i.background} = ${contrast(i.color, i.background).toFixed(2)}:1`);
      }
    }
  });
}

test("every corrected Help / supplement product selector was rendered and checked", () => {
  const missing = Object.entries(CORRECTED_TEXT).flatMap(([url, selectors]) => selectors.map(s => `${url} ${s}`)).filter(k => !correctedSeen.has(k));
  assert.deepEqual(missing, []);
});

test("every local srcset candidate on the homepage is served as WebP at its declared width", async () => {
  const {page, close} = await open(VIEWPORTS[1], "/");
  const candidates = await page.evaluate(() => [...new Set([...document.querySelectorAll("img[srcset], source[srcset]")].flatMap(e => e.srcset.split(",").map(c => c.trim().split(/\s+/)))
    .filter(([url]) => url.startsWith("/")).map(c => c.join(" ")))].map(c => c.split(" ")));
  assert.ok(candidates.length >= 10, JSON.stringify(candidates));
  for (const [url, descriptor] of candidates) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get("content-type"), "image/webp", url);
    const width = await page.evaluate(async src => {const i = new Image(); i.src = src; await i.decode(); return i.naturalWidth;}, url);
    assert.equal(`${width}w`, descriptor, url);
  }
  await close();
});
