// S8939 launch browser QA: real `next start` of a QA build (S8939_QA_ROOT) whose launch identity is the
// SYNTHETIC fixture from s8939-launch-hook.mjs, synthetic Storefront via that hook, real Chromium.
// Every browser request to a non-loopback host is aborted and recorded; the server hook refuses
// every non-fixture fetch. Screenshots are written to S8939_EVIDENCE and inspected separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const root = process.env.S8939_QA_ROOT;
const out = process.env.S8939_EVIDENCE;
assert.ok(root && out, 'S8939_QA_ROOT and S8939_EVIDENCE are required');
const qaIdentity = JSON.parse(fs.readFileSync(path.join(root, 'lib/skincare-launch-identity.json'), 'utf8'));
assert.equal(qaIdentity.store, 'iqon-test.myshopify.com', 'QA build must carry the synthetic identity');
fs.mkdirSync(out, {recursive: true});
const labels = JSON.parse(fs.readFileSync(path.join(repo, 'tests/fixtures/approved-skincare-labels.json'), 'utf8'));
const historical = JSON.parse(fs.readFileSync(path.join(repo, 'lib/skincare-range.json'), 'utf8'));
const additions = JSON.parse(fs.readFileSync(path.join(repo, 'lib/new-skincare-range.json'), 'utf8'));
const ACTIVE = Object.keys(labels);
const PRICES = {"enzyme-gel-cleanser":"$55","exfoliating-pads":"$80","hyaluronic-serum":"$90","retinol-rx":"$99","hydra-c-ferulic-serum":"$90","peptide-anti-wrinkle-day-cream":"$100","copper-peptide-restore-cream":"$68","firming-peptide-eye-gel":"$77"};
const LEGACY = ['anti-aging-cleanser-with-peptides', 'hydrating-tonic'];
// Retinol Rx strength copy (PR45) taken from its own exact fixture, not re-typed here.
const strength = JSON.parse(fs.readFileSync(path.join(repo, 'tests/fixtures/retinol-strength-copy.json'), 'utf8'));
const strengthAfter = (file, re) => strength[file].map(([, a]) => a.match(re)?.[1]).find(Boolean);
const RETINOL = {description: strengthAfter('lib/product-copy.json', /^"description": "(.*)"$/), lead: strengthAfter('lib/product-visuals.ts', /^lead: "(.*)"$/), summary: strengthAfter('lib/skincare-visual-content.ts', /^summary:"(.*)"$/)};
assert.ok(RETINOL.description?.includes('0.75%') && RETINOL.lead?.endsWith('Retinol strength as stated by the formulating laboratory.') && RETINOL.summary?.startsWith('0.75%'));
async function retinolCopy(page, prefix) {
  const meta = await page.evaluate(() => Object.fromEntries(['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'].map(s => [s, document.querySelector(s)?.getAttribute('content')])));
  record(`${prefix}:metadata-description-og-twitter`, Object.values(meta).length === 3 && Object.values(meta).every(v => v === RETINOL.description), JSON.stringify(meta).slice(0, 160));
  const lead = (await page.locator('.product-summary-description').first().textContent()).trim();
  record(`${prefix}:lead-with-attribution`, lead === RETINOL.lead, lead.slice(-70));
  const fact = await page.locator('.product-fact-art').evaluateAll(n => n.map(e => e.textContent.replace(/\s+/g, ' ')));
  record(`${prefix}:key-fact`, fact.some(f => f.includes('0.75%') && f.includes('encapsulated retinol')), fact.join('|').slice(0, 120));
  const summaries = await page.locator('.skin-ingredient-summary').allTextContents();
  const summaryVisible = await page.locator('.skin-ingredient-summary').first().isVisible();
  record(`${prefix}:ingredient-summary`, summaries.includes(RETINOL.summary), `visible=${summaryVisible} ${summaries.join('|').slice(0, 110)}`);
}
const matrix = [];
const record = (id, ok, detail = '') => { matrix.push({id, ok: !!ok, detail}); };
const blocked = [];
const hookUrl = pathToFileURL(path.join(repo, 'tests/e2e/s8939-launch-hook.mjs')).href;

async function start(port, env) {
  const log = fs.openSync(path.join(out, `server-${port}.log`), 'w');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', 'localhost'], {cwd: root, stdio: ['ignore', log, log],
    env: {PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', SHOPIFY_STORE_DOMAIN: 'iqon-test.myshopify.com', SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'fixture-only', S8939_BLOCK_LOG: path.join(out, `server-blocked-${port}.log`), NODE_OPTIONS: `--import ${hookUrl}`, ...env}});
  for (let i = 0; i < 160; i++) { try { const r = await fetch(`http://localhost:${port}/approach`); if (r.ok) return () => child.kill('SIGTERM'); } catch {} if (child.exitCode !== null) break; await new Promise(r => setTimeout(r, 250)); }
  child.kill('SIGTERM'); throw new Error('server did not start');
}
async function context(browser, viewport) {
  const ctx = await browser.newContext({viewport, deviceScaleFactor: 1});
  await ctx.route('**/*', route => { const u = new URL(route.request().url()); if (u.hostname === 'localhost') return route.continue(); blocked.push(`${route.request().method()} ${u.host}${u.pathname}`); return route.abort(); });
  return ctx;
}
const shot = async (page, name, opts = {}) => { const file = path.join(out, `${name}.png`); await page.screenshot({path: file, ...opts}); return file; };

test('S8939 launch: eight PDPs, legacy holds, mixed cart, code, checkout handoff, fail-closed states', {timeout: 600000}, async t => {
  t.after(() => { if (!fs.existsSync(path.join(out, 'matrix.json'))) fs.writeFileSync(path.join(out, 'matrix-partial.json'), JSON.stringify({total: matrix.length, passed: matrix.filter(m => m.ok).length, matrix, browserBlocked: [...new Set(blocked)]}, null, 2)); });
  const browser = await chromium.launch({args: ['--disable-gpu']});
  t.after(() => browser.close());
  const stop = await start(3291, {FAKE_SKINCARE: 'qualified', S8939_STOCK: '5'}); // fresh provider stock 5 per variant (fixture)
  t.after(stop);
  const base = 'http://localhost:3291';
  for (const [label, viewport] of [['desktop', {width: 1440, height: 900}], ['mobile', {width: 390, height: 844}]]) {
    const ctx = await context(browser, viewport); const page = await ctx.newPage();
    for (const id of ACTIVE) {
      const p = [...historical, ...additions].find(x => x.id === id);
      await page.goto(`${base}/products/${id}`, {waitUntil: 'networkidle'});
      const h1 = await page.locator('h1').first().textContent();
      record(`D-HOLD-1:${label}:${id}:name`, h1 === labels[id].name || h1 === p.name, h1);
      const summary = await page.locator('.product-summary').textContent();
      record(`D-HOLD-4:${label}:${id}:price`, summary.includes(PRICES[id]) && !/Coming soon/.test(summary), summary.slice(0, 120));
      const addBtn = page.locator('.add-to-bag-row button.button-dark');
      await page.waitForFunction(() => !document.querySelector('.add-to-bag-row button.button-dark')?.disabled, null, {timeout: 15000});
      record(`D-HOLD-1:${label}:${id}:add-enabled`, await addBtn.isEnabled());
      // Owner decision 10 Nov 2026: qualified skincare offers its own bundle (10% / 15%); never a subscription.
      const bundle = await page.locator('.product-detail .bundle-choices').evaluate(n => ({heading: n.querySelector('.bundle-heading strong')?.textContent, tiers: n.querySelector('.bundle-heading span')?.textContent,
        rows: [...n.querySelectorAll('.bundle-option')].map(r => r.innerText.replace(/\s+/g, ' ').trim()), terms: n.querySelector('.bundle-terms')?.textContent})).catch(() => null);
      record(`D-BUNDLE-1:${label}:${id}:skincare-bundle`, bundle?.heading === 'Bundle and save' && bundle.tiers === 'Buy 2, save 10% · Buy 3+, save 15%' && bundle.rows.length === 3
        && /Save 10% on each/.test(bundle.rows[1]) && /Save 15% on each/.test(bundle.rows[2]) && /^Mix and match any IQON skincare: every skincare item in your bag counts toward the bundle\./.test(bundle.terms)
        && (await page.locator('.product-detail').getByText(/save 25%/i).count()) === 0, JSON.stringify(bundle).slice(0, 260));
      record(`D-CART-3:${label}:${id}:no-subscription`, (await page.locator('.product-detail').getByText(/subscri|auto-?refill/i).count()) === 0);
      const ld = await page.$$eval('script[type="application/ld+json"]', s => s.flatMap(x => [JSON.parse(x.textContent)].flat()));
      const product = ld.find(n => n['@type'] === 'Product');
      record(`D-HOLD-4:${label}:${id}:offer`, Number(product?.offers?.price) === Number(PRICES[id].slice(1)) && product?.offers?.availability === 'https://schema.org/InStock', JSON.stringify(product?.offers));
      const img = page.locator('.visual-pack img').first();
      await img.scrollIntoViewIfNeeded();
      const imgState = await img.evaluate(i => ({src: i.getAttribute('src'), w: i.naturalWidth, complete: i.complete}));
      record(`D-CONT-1:${label}:${id}:packshot`, imgState.src === p.image && imgState.w > 0, JSON.stringify(imgState));
      // Mobile: gallery precedes title and purchase controls in visual and DOM order.
      const order = await page.evaluate(() => { const g = document.querySelector('.product-gallery, .visual-gallery, [class*="gallery"]'); const h = document.querySelector('h1'); const b = document.querySelector('.add-to-bag-row'); return {gTop: g.getBoundingClientRect().top + scrollY, hTop: h.getBoundingClientRect().top + scrollY, bTop: b.getBoundingClientRect().top + scrollY, gLeft: g.getBoundingClientRect().left, hLeft: h.getBoundingClientRect().left, domGalleryFirst: !!(g.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)}; });
      if (label === 'mobile') record(`D-CONT-1:mobile:${id}:image-first`, order.domGalleryFirst && order.gTop < order.hTop && order.hTop < order.bTop, JSON.stringify(order));
      else record(`D-CONT-1:desktop:${id}:gallery-left`, order.domGalleryFirst && order.gLeft < order.hLeft, JSON.stringify(order));
      await shot(page, `pdp-${label}-${id}-top`);
      if (id === 'retinol-rx') {
        await retinolCopy(page, `D-CONT-2:${label}:qualified:retinol-rx`);
        await page.locator('.skin-ingredient-selections').first().scrollIntoViewIfNeeded(); // summaries are display:none at mobile widths by existing design
        await shot(page, `pdp-${label}-retinol-rx-strength`);
      }
      // Approved INCI and directions, each accordion opened separately.
      for (const [trigger, expected] of [['Ingredients & formulation', labels[id].ingredients], ['How to use', labels[id].directions]]) {
        const button = page.getByRole('button', {name: trigger}).first();
        await button.scrollIntoViewIfNeeded(); await button.click();
        const panel = page.locator(`[data-state="open"]`).filter({hasText: expected.slice(0, 40)}).first();
        await panel.waitFor({timeout: 5000});
        const text = (await panel.textContent()).replace(/\s+/g, ' ');
        record(`D-CONT-1:${label}:${id}:${trigger}`, text.includes(expected.replace(/\s+/g, ' ')), text.slice(0, 80));
        if (label === 'desktop' && trigger === 'Ingredients & formulation') await shot(page, `pdp-${label}-${id}-inci`);
      }
    }
    // Legacy references stay held.
    for (const id of LEGACY) {
      await page.goto(`${base}/products/${id}`, {waitUntil: 'networkidle'});
      const txt = await page.locator('main').textContent();
      record(`D-HOLD-2:${label}:${id}:held`, /Not part of the current range/.test(txt) && (await page.locator('.add-to-bag-row').count()) === 0);
      const ld = await page.$$eval('script[type="application/ld+json"]', s => s.flatMap(x => [JSON.parse(x.textContent)].flat()));
      record(`D-HOLD-2:${label}:${id}:no-offer`, !ld.some(n => n['@type'] === 'Product'));
      if (label === 'desktop') await shot(page, `legacy-${label}-${id}`);
    }
    await page.goto(`${base}/collections/skincare`, {waitUntil: 'networkidle'});
    const cards = await page.locator('.product-card-action').allTextContents();
    record(`D-HOLD-1:${label}:collection-add-buttons`, cards.filter(c => /Add to bag/.test(c)).length === 8, cards.join('|'));
    await shot(page, `collection-skincare-${label}`, {fullPage: label === 'desktop'});
    await ctx.close();
  }
  // Mixed cart: skincare + 2 bundle-eligible supplements, code IQON10, checkout handoff.
  const ctx = await context(browser, {width: 1440, height: 900}); const page = await ctx.newPage();
  await page.goto(`${base}/products/retinol-rx`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => !document.querySelector('.add-to-bag-row button.button-dark')?.disabled);
  await page.locator('.add-to-bag-row button.button-dark').click();
  await page.locator('.bag-lines').waitFor();
  await page.waitForFunction(() => document.querySelector('.bag-lines')?.textContent.includes('Retinol'));
  const legacyAdd = await page.evaluate(async () => (await fetch('/api/cart', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'add', id: 'hydrating-tonic', variantId: 'gid://shopify/ProductVariant/52052013056295', quantity: 1})})).status);
  record('D-HOLD-2:cart-api:legacy-add-rejected', legacyAdd === 422, String(legacyAdd));
  const oversell = await page.evaluate(async () => (await fetch('/api/cart', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'add', id: 'retinol-rx', variantId: 'gid://shopify/ProductVariant/99000000000203', quantity: 5})})).json());
  record('D-CART-2:cart-api:oversell-denied', /Only 5 available/.test(oversell.error || ''), JSON.stringify(oversell).slice(0, 120));
  await page.goto(`${base}/products/creatine-monohydrate`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => !document.querySelector('.add-to-bag-row button.button-dark')?.disabled);
  const qty = await page.evaluate(async () => (await fetch('/api/cart', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'add', id: 'creatine-monohydrate', variantId: 'gid://shopify/ProductVariant/1', quantity: 2})})).json());
  record('D-CART-3:bundle-supplements-only', qty.lineDiscounts?.some(d => /Bundle: Buy 2/.test(d.title)) && qty.items.find(i => i.id === 'retinol-rx')?.compareAmount === undefined, JSON.stringify(qty.lineDiscounts));
  // Families never cross: 1 skincare + 2 supplements earns only the supplement Buy 2 tier.
  record('D-BUNDLE-2:one-skincare-no-skincare-discount', qty.lineDiscounts?.length === 1 && qty.lineDiscounts[0].title === 'Bundle: Buy 2, save 10%', JSON.stringify(qty.lineDiscounts));
  const mixed = await page.evaluate(async () => (await fetch('/api/cart', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'add', id: 'firming-peptide-eye-gel', variantId: 'gid://shopify/ProductVariant/99000000000207', quantity: 1})})).json());
  const titles = Object.fromEntries((mixed.lineDiscounts || []).map(d => [d.title, d.amount]));
  // 2 skincare (99 + 77) at 10% = 9.90 + 7.70; 2 supplements stay at Buy 2 (not Buy 3) although the bag holds 4 units.
  record('D-BUNDLE-2:two-skincare-two-supplements', titles['Skincare bundle: Buy 2, save 10%'] === 17.6 && titles['Bundle: Buy 2, save 10%'] === 9.78 && Object.keys(titles).length === 2,
    JSON.stringify(mixed.lineDiscounts));
  record('D-BUNDLE-2:skincare-lines-discounted', mixed.items?.find(i => i.id === 'retinol-rx')?.amount === 89.1 && mixed.items?.find(i => i.id === 'firming-peptide-eye-gel')?.amount === 69.3, JSON.stringify(mixed.items?.map(i => [i.id, i.amount, i.compareAmount])));
  for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const bagCtx = await context(browser, {width: w, height: h}); const bp = await bagCtx.newPage();
    await bagCtx.addCookies(await ctx.cookies());
    await bp.goto(`${base}/products/retinol-rx`, {waitUntil: 'networkidle'});
    await bp.waitForFunction(() => !document.querySelector('.add-to-bag-row button.button-dark')?.disabled);
    await bp.locator('.bag-button').first().click();
    await bp.locator('.bag-sheet .bag-lines').waitFor();
    await bp.waitForFunction(() => /Skincare bundle: Buy 2, save 10%/.test(document.querySelector('.bag-sheet')?.textContent || ''));
    const nudges = await bp.locator('.bag-sheet .bundle-nudge').allTextContents();
    record(`D-BUNDLE-3:${vp}:bag-nudges-per-family`, JSON.stringify(nudges) === JSON.stringify(['Add 1 more eligible supplement to save 25%.', 'Add 1 more skincare product to save 15%.']), JSON.stringify(nudges));
    const bagText = (await bp.locator('.bag-sheet').innerText()).replace(/\s+/g, ' ');
    record(`D-BUNDLE-3:${vp}:bag-shopify-rows`, /Skincare bundle: Buy 2, save 10% −\$17\.60/.test(bagText) && /Bundle: Buy 2, save 10% −\$9\.78/.test(bagText) && !/save 15% −|save 25% −/.test(bagText), bagText.slice(0, 400));
    const overflow = await bp.evaluate(() => ({doc: document.documentElement.scrollWidth, vw: innerWidth, sheet: (() => { const s = document.querySelector('.bag-sheet'); return s ? s.scrollWidth - s.clientWidth : -1; })()}));
    record(`D-BUNDLE-3:${vp}:bag-no-overflow`, overflow.doc <= overflow.vw && overflow.sheet <= 0, JSON.stringify(overflow));
    await shot(bp, `bag-mixed-family-${vp}`);
    await bp.locator('.bag-sheet .bag-summary').scrollIntoViewIfNeeded();
    await shot(bp, `bag-mixed-family-${vp}-summary`);
    await bagCtx.close();
  }
  const coded = await page.evaluate(async () => (await fetch('/api/cart', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'discount', discountCodes: ['iqon10']})})).json());
  record('D-CART-3:code-10pct-cart-wide-after-bundles', coded.orderDiscounts?.[0]?.title === 'IQON10' && Math.abs(coded.orderDiscounts[0].amount - Math.round(coded.subtotal * 10) / 100) < 0.011, JSON.stringify({subtotal: coded.subtotal, orderDiscounts: coded.orderDiscounts, total: coded.total}));
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('button[aria-label^="Bag"], .bag-button, [aria-label*="bag" i]').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'bag-mixed-desktop');
  const checkout = await page.evaluate(async () => { const r = await fetch('/api/checkout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({visitorConsent: {analytics: false, marketing: false, preferences: false, saleOfData: false}})}); return {status: r.status, body: await r.json()}; });
  record('D-CART-3:checkout-handoff', checkout.status === 200 && checkout.body.checkoutUrl.startsWith('https://iqon-test.myshopify.com/'), JSON.stringify(checkout).slice(0, 160));
  await page.goto(checkout.body.checkoutUrl).catch(() => {});
  record('X-SAFE-1:checkout-navigation-blocked', blocked.some(b => b.includes('iqon-test.myshopify.com')), blocked.slice(-3).join('|'));
  await ctx.close();
  stop();
  // Fail-closed server states.
  for (const [mode, port] of [['held-retinol', 3292], ['down', 3293]]) {
    const stopMode = await start(port, {FAKE_SKINCARE: mode});
    const c = await context(browser, {width: 1440, height: 900}); const pg = await c.newPage();
    for (const id of ['retinol-rx', 'exfoliating-pads']) {
      await pg.goto(`http://localhost:${port}/products/${id}`, {waitUntil: 'networkidle'});
      const summary = await pg.locator('.product-summary').textContent();
      const expectHeld = mode === 'down' || id === 'retinol-rx';
      record(`D-HOLD-3:${mode}:${id}`, expectHeld ? /Unavailable right now/.test(summary) && !/Coming soon/.test(summary) && (await pg.locator('.add-to-bag-row').count()) === 0 : summary.includes(PRICES[id]), summary.slice(0, 80));
      if (id === 'retinol-rx') await retinolCopy(pg, `D-CONT-2:${mode}:held:retinol-rx`);
      await shot(pg, `failclosed-${mode}-${id}`);
    }
    await pg.goto(`http://localhost:${port}/products/creatine-monohydrate`, {waitUntil: 'networkidle'});
    record(`D-HOLD-3:${mode}:supplement-unaffected`, /\$48\.97/.test(await pg.locator('.product-summary').textContent()));
    await c.close(); stopMode();
  }
  const serverBlocked = fs.readdirSync(out).filter(f => f.startsWith('server-blocked-')).flatMap(f => fs.readFileSync(path.join(out, f), 'utf8').trim().split('\n').filter(Boolean));
  fs.writeFileSync(path.join(out, 'matrix.json'), JSON.stringify({total: matrix.length, passed: matrix.filter(m => m.ok).length, matrix, browserBlocked: [...new Set(blocked)], serverBlocked}, null, 2));
  assert.deepEqual(matrix.filter(m => !m.ok), []);
});
