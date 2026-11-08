// Built-app regression: compare desktop geometry to the original single-panel flow.
// The reference changes only DOM grouping/grid placement, retaining real styles/content.
// PDP_BASE_ROOT optionally checks a separately built 418e420 checkout as well;
// PDP_HEAD_ROOT can select the frozen pre-fix build to demonstrate regression failures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = process.env.E2E_SCREENSHOTS || '/tmp/iqon-pdp-spacing';
const port = Number(process.env.E2E_PORT || 4101);
fs.mkdirSync(output, {recursive: true});
const servers = [], evidence = [];
const browser = await chromium.launch();
test.after(async () => {
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
  for (const server of servers) server.kill('SIGTERM');
});
async function start(directory, serverPort, synthetic) {
  const url = `http://localhost:${serverPort}`;
  try { await fetch(url); throw Error(`Port ${serverPort} is occupied`); }
  catch (error) { if (error.message.includes('occupied')) throw error; }
  const env = {...process.env, NODE_ENV: 'production', NEXT_PUBLIC_META_PIXEL_ID: ''};
  for (const key of ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_STOREFRONT_PRIVATE_TOKEN', 'NODE_OPTIONS']) delete env[key];
  if (synthetic) Object.assign(env, {
    VERCEL_ENV: 'production', FAKE_SHOPIFY: 'live', FAKE_CATALOG: 'purchase-clarity',
    SHOPIFY_STORE_DOMAIN: 'iqon-test.myshopify.com', SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-token',
    NODE_OPTIONS: `--import ${path.join(root, 'tests/e2e/pdp-spacing-hook.mjs')}`,
  });
  const log = fs.openSync(path.join(output, `server-${serverPort}.log`), 'w');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(serverPort)], {cwd: directory, env, stdio: ['ignore', log, log]});
  servers.push(server);
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return url; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error(`Server did not start: ${serverPort}`);
}
const selectors = ['.product-visual-gallery', '.product-summary', '.product-current-price', '.product-summary-description', '.product-highlights', '.product-essentials', '.product-variant-picker', '.bundle-choices', '.commerce-message', '.add-to-bag-row', '.purchase-assurance', '.product-jump-links', '.product-accordion', '.product-guides', '.product-launch-note'];
async function geometry(page) {
  return page.evaluate(selectors => ({
    boxes: Object.fromEntries(selectors.map(selector => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      return [selector, r ? {x: r.x, y: r.y + scrollY, width: r.width, height: r.height} : null];
    })),
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }), selectors);
}
async function ready(page, url, handle) {
  await page.goto(`${url}/products/${handle}`, {waitUntil: 'domcontentloaded'});
  await page.locator('.product-visual-gallery').waitFor();
  await page.waitForFunction(() => Object.keys(document.querySelector('main')).some(key => key.startsWith('__reactFiber')));
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
}
async function originalDesktopFlow(page) {
  await page.evaluate(() => {
    const overview = document.querySelector('.purchase-first #overview');
    if (!overview) return; // Coming-soon pages already retain the original panel.
    const panel = document.createElement('div');
    panel.className = 'purchase-panel';
    for (const name of ['summary', 'info', 'buy']) {
      const part = overview.querySelector(`.purchase-panel-${name}`);
      panel.append(...part.childNodes);
      part.remove();
    }
    overview.prepend(panel);
    overview.style.gridTemplateRows = 'auto auto 1fr';
    panel.style.gridRow = '1';
    overview.querySelector('.product-visual-gallery').style.gridRow = '1 / 4';
    overview.querySelector('.purchase-panel-details').style.gridRow = '2';
  });
}
for (const [mode, handles] of [
  ['synthetic', ['colostrum-powder', 'creatine-monohydrate', 'hydrolyzed-collagen-peptides', 'nmn', 'daily-travel-kit', 'generic-sized', 'generic-unavailable', 'generic-variants', 'anti-aging-cleanser-with-peptides']],
  ['preview', ['colostrum-powder', 'creatine-monohydrate', 'anti-aging-cleanser-with-peptides']],
]) {
  const offset = mode === 'synthetic' ? 0 : 2;
  const url = await start(process.env.PDP_HEAD_ROOT || root, port + offset, mode === 'synthetic');
  const baseUrl = process.env.PDP_BASE_ROOT ? await start(process.env.PDP_BASE_ROOT, port + offset + 1, mode === 'synthetic') : null;
  for (const width of [320, 390, 760, 761, 1440]) for (const handle of handles) {
    test(`${mode} ${width} ${handle}: ${width > 760 ? 'original desktop geometry' : 'gallery, focus and sticky order'}`, async () => {
      const context = await browser.newContext({viewport: {width, height: width === 320 ? 740 : width === 1440 ? 900 : 844}, reducedMotion: 'reduce'});
      await context.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
      await context.addInitScript(()=>Object.defineProperty(navigator,"globalPrivacyControl",{value:true}));
      // Synthetic image URLs are deliberately nonexistent. No image replacements are used.
      const page = await context.newPage();
      const sample = {mode, width, handle};
      evidence.push(sample);
      try {
        await ready(page, url, handle);
        if (mode === 'preview') await page.waitForFunction(() => {const image = document.querySelector('.visual-pack img'); return image?.complete && image.naturalWidth > 0;});
        sample.actual = await geometry(page);
        await page.screenshot({path: path.join(output, `${mode}-${width}-${handle}.png`)});
        if (width > 760) {
          await originalDesktopFlow(page);
          sample.reference = await geometry(page);
          if (baseUrl) {
            await ready(page, baseUrl, handle);
            sample.base = await geometry(page);
            await page.screenshot({path: path.join(output, `base-${mode}-${width}-${handle}.png`)});
            assert.deepEqual(sample.reference, sample.base, 'reference must match separately built base');
          }
          assert.deepEqual(sample.actual, sample.reference, 'split panels must preserve original desktop geometry');
        } else {
          const boxes = sample.actual.boxes;
          assert.ok(boxes['.product-visual-gallery'].y + boxes['.product-visual-gallery'].height <= boxes['.product-current-price'].y);
          assert.ok(sample.actual.scrollWidth <= width);
          assert.match(await page.locator('#overview>:first-child').getAttribute('class'), /product-visual-gallery/);
          assert.equal(await page.locator('[tabindex]').evaluateAll(elements => elements.filter(e => e.tabIndex > 0).length), 0);
          const zones = [];
          for (let i = 0; i < 70; i++) {
            await page.keyboard.press('Tab');
            const zone = await page.evaluate(() => {
              const e = document.activeElement;
              return e.closest('.product-accordion') ? 'details' : e.closest('.product-visual-gallery') ? 'gallery' : e.closest('.purchase-panel') ? 'purchase' : null;
            });
            if (zone && zones.at(-1) !== zone) zones.push(zone);
            if (zone === 'details') break;
          }
          sample.focus = zones;
          assert.equal(zones[0], 'gallery');
          assert.equal(zones.at(-1), 'details');
          assert.equal(zones.filter(zone => zone === 'gallery').length, 1);
          if (await page.locator('.sticky-purchase').count()) {
            sample.sticky = [];
            for (const position of ['top', 'inline', 'reviews']) {
              if (position === 'top') await page.evaluate(() => {document.activeElement.blur(); scrollTo({top: 0, behavior: 'instant'});});
              else await page.locator(position === 'inline' ? '.add-to-bag-row' : '#reviews').scrollIntoViewIfNeeded();
              // IntersectionObserver updates after scrolling; wait for its bounded delivery,
              // then inspect both buttons instead of sampling during an in-flight scroll.
              await page.waitForFunction(expected => {
                const row = document.querySelector('.add-to-bag-row').getBoundingClientRect();
                const inline = row.bottom > 0 && row.top < innerHeight;
                return (expected === null || inline === expected) && document.querySelector('.sticky-purchase').classList.contains('inline-cta-in-view') === (inline || row.top > 0);
              }, position === 'top' ? null : position === 'inline', {timeout: 2000});
              const state = await page.evaluate(() => {
                const visible = selector => {const e = document.querySelector(selector), r = e.getBoundingClientRect(); return getComputedStyle(e).visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight;};
                return {inline: visible('.add-to-bag-row .button'), sticky: visible('.sticky-purchase .button')};
              });
              sample.sticky.push({position, ...state});
              assert.equal(Number(state.inline) + Number(state.sticky), position==='top'&&!state.inline?0:1);
            }
          } else {
            assert.equal(await page.locator('.sticky-purchase,.bundle-choices').count(), 0);
            const action=page.locator('.product-launch-note button,.add-to-bag-row .button');
            assert.equal(await action.isDisabled(), true);
          }
        }
      } finally { await context.close(); }
    });
  }
}
