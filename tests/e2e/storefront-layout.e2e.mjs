// Rendered layout regressions for the public storefront: no horizontal page overflow on narrow
// phones, readable footer links and homepage muted text, hydrated H1 text that keeps a word space
// at each <br>, the guide → product → bag → checkout handoff (the synthetic checkout URL is
// aborted: no order exists), and homepage photographs whose srcset choice still covers each frame
// at the screen's density (the eager, high-priority LCP hero included), and expanded Help and product
// accordion answers (including the approved shipping copy) and corrected Help / supplement product
// muted text at WCAG AA contrast.
// Runs the real production build (`npm run build:vercel`) under `next start` with the MOCK Shopify
// catalog (tests/seo/fake-shopify-hook.mjs); browser external requests are aborted. The optional
// FAKE_POLICIES=published mode reads only the five actual public policy JSON endpoints on the server. Screenshots of this
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
import { JSDOM } from "jsdom";
import { otherGuideAnswers, assertGuideAnswer } from "../seo/other-guide-answers.mjs";

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
  for (const answer of otherGuideAnswers) {
    test(`${device.name}px: ${answer.slug} answer and source survive hydration without overflow`, async () => {
      const url = `/journal/${answer.slug}`;
      const raw = new JSDOM(await (await fetch(base + url)).text()).window.document;
      const rawSection = [...raw.querySelectorAll(".article-body > section")].find(s => s.querySelector("h2")?.textContent === answer.heading);
      assert.ok(rawSection);
      const rawParagraphs = [...rawSection.querySelectorAll("p")].map(p => p.textContent);
      assertGuideAnswer(answer, rawParagraphs);
      const {page, close} = await open(device, url);
      try {
        const section = page.locator(".article-body > section").filter({has: page.getByRole("heading", {name: answer.heading, exact: true})});
        assert.equal(await section.count(), 1);
        assert.deepEqual(await section.locator("p").allTextContents(), rawParagraphs);
        for (const element of await section.locator("h2, p").all()) {
          await element.scrollIntoViewIfNeeded();
          assert.ok(await element.isVisible());
          const box = await element.boundingBox();
          assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= device.viewport.width);
        }
        assert.equal(await section.locator(".guide-products").count(), 0);
        // Fit the entire answer beneath the sticky navigation for a readable crop. Width stays
        // at the tested breakpoint; visibility/geometry above uses the original device height.
        const answerBox = await section.boundingBox();
        await page.setViewportSize({width: device.viewport.width, height: Math.max(device.viewport.height, Math.ceil(answerBox.height) + 320)});
        await section.evaluate(s => s.scrollIntoView({block: "center"}));
        await section.screenshot({path: path.join(shots, `${device.name}_${answer.shot}.png`)});
        await page.setViewportSize(device.viewport);
        const source = page.locator(`.article-sources a[href="${answer.source}"]`);
        await source.scrollIntoViewIfNeeded();
        assert.ok(await source.isVisible());
        assert.equal(await source.innerText(), `${answer.sourceLabel} ↗`);
        const sourceBox = await source.boundingBox();
        assert.ok(sourceBox.x >= 0 && sourceBox.x + sourceBox.width <= device.viewport.width);
        await page.locator(".article-sources").evaluate(s => s.scrollIntoView({block: "center"}));
        await page.locator(".article-sources").screenshot({path: path.join(shots, `${device.name}_${answer.shot}_sources.png`)});
        const size = await page.evaluate(() => ({inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
        assert.equal(size.inner, device.viewport.width);
        assert.ok(size.scroll <= size.client && size.body <= size.client, JSON.stringify(size));
        // Every existing product module is unchanged by hydration.
        assert.deepEqual(await page.locator(".guide-products").allTextContents(), [...raw.querySelectorAll(".guide-products")].map(s => s.textContent));
      } finally {await close();}
    });
  }

  test(`${device.name}px: label blend explanation stays visible after hydration with its FDA source`, async () => {
    const url = "/journal/reading-a-supplement-label";
    const raw = new JSDOM(await (await fetch(base + url)).text()).window.document;
    const heading = "Does a 600 mg blend mean 200 mg of each ingredient?";
    const rawSection = [...raw.querySelectorAll(".article-body > section")].find(s => s.querySelector("h2")?.textContent === heading);
    assert.ok(rawSection, "blend explanation exists in raw server HTML");
    const {page, close} = await open(device, url);
    try {
      const section = page.locator(".article-body > section").filter({has: page.getByRole("heading", {name: heading, exact: true})});
      assert.equal(await section.count(), 1);
      assert.deepEqual(await section.locator("p").allTextContents(), [...rawSection.querySelectorAll("p")].map(p => p.textContent), "hydration retains every paragraph");
      assert.match(await section.innerText(), /hypothetical Supplement Facts panel/);
      for (const element of await section.locator("h2, p").all()) {
        await element.scrollIntoViewIfNeeded();
        assert.ok(await element.isVisible());
        const box = await element.boundingBox();
        assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= device.viewport.width, "copy fits the viewport");
      }
      await section.screenshot({path: path.join(shots, `${device.name}_label_blend.png`)});
      const source = page.locator('.article-sources a[href="https://www.fda.gov/food/dietary-supplements-guidance-documents-regulatory-information/dietary-supplement-labeling-guide-chapter-iv-nutrition-labeling"]');
      await source.scrollIntoViewIfNeeded();
      assert.ok(await source.isVisible(), "FDA source remains accessible after hydration");
    } finally {await close();}
  });

  test(`${device.name}px: Help store answer survives hydration, opens and fits without overflow`, async () => {
    const question = "Where can I buy IQON products?";
    const raw = new JSDOM(await (await fetch(base + "/help")).text()).window.document;
    const rawItem = [...raw.querySelectorAll(".help-wrap [data-slot='accordion-item']")].find(i => i.querySelector("[data-slot='accordion-trigger']")?.textContent.trim() === question);
    const rawAnswer = rawItem?.querySelector("[data-slot='accordion-content']")?.textContent.trim();
    assert.match(rawAnswer || "", /^IQON’s online store is www\.iqondaily\.com\. Browse current products in the supplements collection\./, "answer exists in raw server HTML");
    const {page, close} = await open(device, "/help");
    try {
      const trigger = page.locator(".help-wrap [data-slot='accordion-trigger']").filter({hasText: question});
      assert.equal(await trigger.count(), 1);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      const panel = trigger.locator("xpath=ancestor::*[@data-slot='accordion-item'][1]//*[@data-slot='accordion-content']");
      await page.waitForFunction(el => el.getBoundingClientRect().height > 0, await panel.elementHandle());
      await page.waitForTimeout(400);
      assert.equal((await panel.innerText()).trim(), rawAnswer, "hydrated answer matches the server HTML");
      assert.ok(await panel.isVisible());
      // Both links survive hydration with their targets and read as links (underlined), not plain text.
      const links = await panel.locator("a").evaluateAll(as => as.map(a => ({text: a.textContent, href: a.getAttribute("href"), resolved: a.href, line: getComputedStyle(a).textDecorationLine, w: a.getBoundingClientRect().width})));
      assert.deepEqual(links.map(l => [l.text, l.href]), [["www.iqondaily.com", "https://www.iqondaily.com/"], ["supplements collection", "/collections/supplements"]]);
      assert.equal(links[1].resolved, base + "/collections/supplements");
      assert.ok(links.every(l => l.line.includes("underline") && l.w > 0), JSON.stringify(links));
      const box = await panel.boundingBox();
      assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= device.viewport.width, `answer fits the viewport ${JSON.stringify(box)}`);
      const size = await page.evaluate(() => ({inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
      assert.equal(size.inner, device.viewport.width);
      assert.ok(size.scroll <= size.client && size.body <= size.client, JSON.stringify(size));
      assert.doesNotMatch(await page.locator("main").innerText(), /IQON\s+Daily/i);
      await panel.evaluate(el => el.closest("[data-slot='accordion-item']").scrollIntoView({block: "center"}));
      await page.waitForTimeout(200);
      await page.screenshot({path: path.join(shots, `${device.name}_help_store_answer.png`)});
    } finally {await close();}
  });

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

  test(`${device.name}px: store policy links are visible, readable and tappable in the footer and on /help`, async () => {
    for (const [url, selector, count] of [["/help", ".footer-policies a", 5], ["/help", ".help-policies a", 5], ["/products/creatine-monohydrate", ".footer-policies a", 5]]) {
      const {page, close} = await open(device, url);
      const first = page.locator(selector).first();
      await first.scrollIntoViewIfNeeded();
      const links = await page.$$eval(selector, as => as.map(a => {
        let background = "rgb(255, 255, 255)";
        for (let e = a; e; e = e.parentElement) {const c = getComputedStyle(e).backgroundColor; if (c !== "transparent" && !/,\s*0\)$/.test(c)) {background = c; break;}}
        const box = a.getBoundingClientRect();
        return {text: a.textContent, href: a.getAttribute("href"), color: getComputedStyle(a).color, background, width: box.width, height: box.height, right: box.right};
      }));
      const m = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
      await page.screenshot({path: path.join(shots, `${device.name}${url.startsWith("/products") ? "_pdp" : ""}${selector.startsWith(".footer") ? "_footer" : "_help"}_policies.png`)});
      await close();
      assert.equal(links.length, count, `${url} ${selector}: ${JSON.stringify(links)}`);
      for (const l of links) {
        assert.match(l.href, /^\/policies\/[a-z-]+$/, l.text);
        assert.ok(l.width > 0 && l.right <= m.client, `${url} ${l.text}: hidden or off screen ${JSON.stringify(l)}`);
        assert.ok(l.height >= 24, `${url} ${l.text}: ${l.height}px tall target`);
        assert.ok(contrast(l.color, l.background) >= 4.5, `${url} ${l.text}: ${l.color} on ${l.background} = ${contrast(l.color, l.background).toFixed(2)}:1`);
      }
      assert.ok(m.scroll <= m.client, `${url}: page scrolls sideways (${JSON.stringify(m)})`);
    }
  });

  test(`${device.name}px: all five native policies render readable content without horizontal overflow`, async () => {
    for (const slug of ["shipping-policy", "refund-policy", "subscription-policy", "terms-of-service", "contact-information"]) {
      const {page, close} = await open(device, `/policies/${slug}`);
      assert.equal(await page.locator("h1").count(), 1);
      if (process.env.FAKE_POLICIES === "down") {
        assert.ok(await page.locator(".policy-fallback").isVisible());
        assert.equal(await page.locator(".policy-fallback a").getAttribute("href"), `https://nr9zd0-t5.myshopify.com/policies/${slug}`);
        assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
        assert.equal(await page.locator("article.policy-body").count(), 0);
      } else {
        assert.ok(await page.locator("article.policy-body").isVisible());
        assert.ok((await page.locator("article.policy-body").textContent()).length > 40);
        assert.equal(await page.locator("article script, article img").count(), 0);
        if (process.env.FAKE_POLICIES === "published") {
          const source = await fetch(`https://nr9zd0-t5.myshopify.com/policies/${slug}.json`);
          assert.equal(source.status, 200);
          const {policy} = await source.json();
          assert.equal(await page.locator("h1").textContent(), policy.title);
          assert.equal(await page.locator("article.policy-body").textContent(), new JSDOM(policy.body).window.document.body.textContent);
        }
      }
      const dimensions = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
      assert.ok(dimensions.scroll <= dimensions.client, JSON.stringify(dimensions));
      const [color, background] = await page.locator(".policy-body, .policy-fallback").evaluate(a => [getComputedStyle(a).color, getComputedStyle(document.body).backgroundColor]);
      assert.ok(contrast(color, background) >= 4.5, `${slug}: ${color} on ${background}`);
      await page.screenshot({path: path.join(shots, `${device.name}_${slug}.png`), fullPage: true});
      await close();
    }
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

  test(`${device.name}px: bundle tiers on the product page, Shopify bundle savings and nudges in the bag and on /checkout`, async () => {
    const {page, close} = await open(device, "/products/creatine-monohydrate");
    const noOverflow = async label => {
      const m = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
      assert.ok(m.scroll <= m.client, `${label}: page scrolls sideways (${JSON.stringify(m)})`);
    };
    const main = await page.evaluate(() => document.querySelector("main").innerText);
    assert.doesNotMatch(main, /subscri|skip or cancel|every month/i, "no subscription copy on the product page");
    assert.doesNotMatch(main, /[\u2013\u2014]/, "no dashes in product page copy");
    const tiers = page.locator(".bundle-choices");
    await tiers.scrollIntoViewIfNeeded();
    assert.match(await tiers.innerText(), /Buy 2, save 10% · Buy 3\+, save 25%/);
    assert.deepEqual(await page.$$eval(".bundle-option", rows => rows.map(r => r.innerText.replace(/\s+/g, " ").trim())),
      ["Buy 1 One time purchase $39 each", "Buy 2 Save 10% on each $35.10 each", "Buy 3+ Save 25% on each $29.25 each"]);
    await page.locator(".bundle-option", {hasText: "Buy 3+"}).click();
    const add = page.locator(".add-to-bag-row button.button-dark");
    await page.waitForFunction(() => /\$87\.75/.test(document.querySelector(".add-to-bag-row button.button-dark")?.textContent || ""));
    await noOverflow("pdp tiers");
    await tiers.evaluate(el => el.scrollIntoView({block: "center"}));
    await page.screenshot({path: path.join(shots, `${device.name}_pdp_bundle_tiers.png`)});
    await page.waitForFunction(() => !document.querySelector(".add-to-bag-row button.button-dark")?.disabled);
    const [cartRequest] = await Promise.all([page.waitForRequest(r => r.url().endsWith("/api/cart") && r.method() === "POST"), add.click()]);
    const body = JSON.parse(cartRequest.postData());
    assert.deepEqual([body.quantity, body.purchase, "sellingPlanId" in body], [3, "once", false]);
    await page.waitForFunction(() => /Bundle: Buy 3, save 25%/.test(document.querySelector(".bag-sheet")?.textContent || ""));
    const bag = await page.locator(".bag-summary").innerText();
    // Fake Shopify cart: 3 × $39 = $117, 25% = $29.25, subtotal $87.75.
    assert.match(bag, /Products\s*\$117/); assert.match(bag, /Bundle: Buy 3, save 25%\s*−\$29\.25/); assert.match(bag, /Subtotal\s*\$87\.75/);
    assert.equal(await page.locator(".bag-sheet .bundle-nudge").count(), 0, "top tier reached: no nudge");
    await page.screenshot({path: path.join(shots, `${device.name}_bag_bundle_25.png`)});
    // Down to one unit: the 10% tier is next.
    await page.locator(".bag-sheet .cart-line button[aria-label^='Decrease']").click();
    await page.waitForFunction(() => /Bundle: Buy 2, save 10%/.test(document.querySelector(".bag-sheet")?.textContent || ""));
    assert.match(await page.locator(".bag-sheet .bundle-nudge").innerText(), /Add 1 more eligible supplement to save 25%\./);
    await page.locator(".bag-sheet .cart-line button[aria-label^='Decrease']").click();
    await page.waitForFunction(() => /Add 1 more eligible supplement to save 10%\./.test(document.querySelector(".bag-sheet")?.textContent || ""));
    assert.equal(await page.locator(".bag-sheet .bag-savings").count(), 0, "no savings row below the first tier");
    await page.screenshot({path: path.join(shots, `${device.name}_bag_bundle_nudge.png`)});
    // Mix and match: a different eligible product reaches the 10% tier.
    await page.goto(base + "/products/liver-support"); await page.waitForFunction(() => !document.querySelector(".add-to-bag-row button.button-dark")?.disabled);
    await page.locator(".add-to-bag-row button.button-dark").click();
    await page.waitForFunction(() => /Bundle: Buy 2, save 10%/.test(document.querySelector(".bag-sheet")?.textContent || ""));
    await page.goto(base + "/checkout"); await page.waitForFunction(() => /Bundle: Buy 2, save 10%/.test(document.querySelector(".checkout-summary")?.textContent || ""));
    const summary = await page.locator(".checkout-summary").innerText();
    // $39 + $45 = $84, 10% = $3.90 + $4.50, subtotal $75.60.
    assert.match(summary, /Products \(2\)\s*\$84/); assert.match(summary, /Bundle: Buy 2, save 10%\s*−\$8\.40/); assert.match(summary, /Subtotal\s*\$75\.60/);
    assert.match(summary, /Add 1 more eligible supplement to save 25%\./);
    await noOverflow("checkout");
    await page.screenshot({path: path.join(shots, `${device.name}_checkout_bundle.png`), fullPage: true});
    await close();
    // A supplement outside the offer shows no tiers and never claims savings.
    const other = await open(device, "/products/daily-travel-kit");
    assert.equal(await other.page.locator(".bundle-choices").count(), 0);
    assert.doesNotMatch(await other.page.evaluate(() => document.querySelector("main").innerText), /save 10%|save 25%|Bundle/);
    await other.close();
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

for (const device of VIEWPORTS) {
  test(`${device.name}px: bag quantity controls remain reachable through every bundle tier`, async () => {
    const {page, close} = await open(device, "/products/creatine-monohydrate");
    const records = [];
    const keyboard = [];
    const bag = page.locator(".bag-sheet");
    const quantity = bag.locator(".cart-line .quantity");
    const waitForQuantity = async value => {
      await page.waitForFunction(value => {
        const quantity = document.querySelector(".bag-sheet .cart-line .quantity");
        return quantity?.textContent.trim() === String(value) && !quantity.querySelector("button").disabled;
      }, value);
    };
    const activate = async control => {
      await control.scrollIntoViewIfNeeded();
      const geometry = await control.evaluate(el => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        const lines = document.querySelector(".bag-lines");
        const sheet = document.querySelector(".bag-sheet");
        return {label: el.getAttribute("aria-label") || el.textContent, box: box.toJSON(),
          hit: !!hit && el.contains(hit), viewport: {width: innerWidth, height: innerHeight},
          lines: {height: lines.clientHeight, scrollHeight: lines.scrollHeight},
          sheet: {height: sheet.clientHeight, scrollHeight: sheet.scrollHeight, scrollTop: sheet.scrollTop}};
      });
      records.push(geometry);
      assert.ok(geometry.hit, `control is occluded: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.box.y >= 0 && geometry.box.bottom <= device.viewport.height, "control fits vertically");
      assert.ok(geometry.box.x >= 0 && geometry.box.right <= device.viewport.width, "control fits horizontally");
      if (device.hasTouch) await control.tap(); else await control.click();
    };
    try {
      const add = page.locator(".add-to-bag-row button.button-dark");
      await add.click();
      await waitForQuantity(1);
      // Native Tab navigation must scroll the sheet to each focused control.
      await bag.locator(".cart-line > a").focus();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const el = document.activeElement, box = el.getBoundingClientRect();
          return {label: el.getAttribute("aria-label") || el.textContent.trim(), box: box.toJSON(),
            hit: el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))};
        });
        keyboard.push(focused);
        assert.ok(focused.hit, `focused control is occluded: ${JSON.stringify(focused)}`);
        if (focused.label.startsWith("Secure checkout")) break;
      }
      const labels = keyboard.map(item => item.label);
      const decrease = labels.findIndex(label => label.startsWith("Decrease"));
      assert.ok(decrease >= 0);
      assert.match(labels[decrease + 1], /^Increase/);
      assert.match(labels[decrease + 2], /^Remove Creatine/);
      assert.match(labels.at(-1), /^Secure checkout/);
      let previous = 1;
      for (const value of [2, 3, 4, 3, 2, 1]) {
        await activate(quantity.getByRole("button", {name: value > previous ? /^Increase/ : /^Decrease/}));
        await waitForQuantity(value);
        previous = value;
        await page.screenshot({path: path.join(shots, `${device.name}_bag_quantity_${records.length}_${value}.png`)});
      }
      // The explicit removal action and decrement-to-zero must both remain usable.
      await activate(bag.getByRole("button", {name: /^Remove Creatine/}));
      await bag.locator(".empty-bag").waitFor();
      await bag.getByRole("button", {name: "Close", exact: true}).click();
      await add.click();
      await waitForQuantity(1);
      await activate(quantity.getByRole("button", {name: /^Decrease/}));
      await bag.locator(".empty-bag").waitFor();
    } finally {
      fs.writeFileSync(path.join(process.env.E2E_GEOMETRY || shots, `${device.name}_bag_geometry.json`), JSON.stringify({pointer: records, keyboard}, null, 2));
      await close();
    }
  });
}
