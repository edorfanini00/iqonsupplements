const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
// Execute the real route/component modules without databases, effects or network.
function load(relative, dependencies, globals = {}) {
  const filename = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console,
    require(name) { if (name in dependencies) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`); },
    ...globals,
  }, { filename });
  return module.exports;
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
function hooks(states) {
  let index = 0;
  return { useState: initial => [index < states.length ? states[index++] : initial, () => {}],
    useEffect() {}, useCallback: fn => fn, useRef: value => ({ current: value }) };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [tree];
  return [tree, ...nodes(tree.props?.children)];
}
async function queue() {
  const all = ['health', 'supplements', null, undefined].map((originPortal, i) => ({
    id: String(i), originPortal, firstName: `Applicant${i}`, lastName: 'Test', email: `test${i}@example.invalid`,
    role: 'affiliate', status: 'pending', createdAt: '2026-09-16T00:00:00Z', promoCode: `TEST${i}`,
  }));
  // Health authority DTO contract; Body's proxy relays this response unchanged.
  return all.map(a => ({ ...a, originPortal: a.originPortal ?? null }));
}
test('request queue UI displays each returned source rather than the viewing portal', async () => {
  const requests = await queue();
  const { default: Page } = load('app/affiliates/admin/requests/page.tsx', {
    react: hooks([requests, [], false, null]), 'react/jsx-runtime': jsx,
    '@/components/affiliates/shared/SharedProgram': {},
    '@/components/affiliates/shared/program-view': {},
    '@/components/affiliates/shared/program-api': {}, 'lucide-react': {},
    '@/components/affiliates/shared/ui': { formatShortDate: s => s },
  });
  const rendered = nodes(Page()).filter(n => typeof n === 'string');
  assert.equal(rendered.filter(s => s === 'IQON Health').length, 1);
  assert.equal(rendered.filter(s => s === 'IQON Supplements').length, 1);
  assert.equal(rendered.filter(s => s === 'Legacy / not recorded').length, 2);
});

// Captured from the disposable local browser-acceptance DB, not invented totals:
// remaining-20260916/health-filtered.json (September/New York, peptides).
const canonical = require('./fixtures/final-filtered-report.json');
async function exportCSV(report = canonical, currency = 'USD') {
  let blob, clicked = false;
  const view = load('components/affiliates/shared/program-view.ts', {});
  const { SharedProgram } = load('components/affiliates/shared/SharedProgram.tsx', {
    react: hooks([report.category, '2026-09-01', '2026-09-30', '', currency, true, report, [], '', '', false, '']),
    'react/jsx-runtime': jsx, 'next/link': {}, './ui': {}, './program-api': {}, './SharedPayoutForm': {}, './program-view': view,
  }, { Blob, URL: { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { clicked = true; } }) }, setTimeout() {} });
  const button = nodes(SharedProgram({ admin: true })).find(n => n?.type === 'button' && n.props.children === 'Export entries CSV');
  assert.ok(button); assert.equal(button.props.disabled, false);
  button.props.onClick(); assert.ok(clicked);
  return blob.text();
}
function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell); cell = ''; if (c === '\n') { rows.push(row); row = []; }
    } else if (c !== '\r' || quoted) cell += c;
  }
  row.push(cell); rows.push(row); return rows;
}
test('actual CSV download preserves gross history and exports canonical net revenue including refunds', async () => {
  const parsed = parseCSV(await exportCSV());
  const headerIndex = parsed.findIndex(r => r[0] === 'id');
  const columns = parsed[headerIndex];
  assert.ok(columns.includes('reportedRevenue'), 'CSV must export canonical reportedRevenue, not gross-only orderTotal');
  const rows = parsed.slice(headerIndex + 1).map(r => Object.fromEntries(columns.map((key, i) => [key, r[i]])));
  assert.deepEqual(rows.map(r => r.id), canonical.orders.map(r => r.id));
  for (const row of rows) {
    const source = canonical.orders.find(o => o.id === row.id);
    for (const field of ['orderTotal', 'reportedRevenue', 'commission', 'paidAmount', 'outstandingAmount']) assert.equal(Number(row[field]), source[field], `${row.id}:${field}`);
  }
  const sum = field => rows.reduce((s, r) => s + Math.round(Number(r[field]) * 100), 0) / 100;
  assert.equal(sum('reportedRevenue'), canonical.currencies[0].totalRevenue);
  assert.equal(sum('orderTotal'), 200); assert.equal(sum('reportedRevenue'), 180);
  assert.ok(rows.some(r => Number(r.orderTotal) === 120 && Number(r.reportedRevenue) === 100));
  assert.deepEqual(rows.filter(r => Number(r.reportedRevenue) < 0).map(r => Number(r.reportedRevenue)).sort((a,b) => a-b), [-75, -25]);
  const metadata = Object.fromEntries(parsed.slice(0, headerIndex));
  assert.equal(metadata.start, canonical.start); assert.equal(metadata.end, canonical.end);
  assert.equal(metadata.timezone, canonical.timezone); assert.equal(metadata.category, 'peptides'); assert.equal(metadata.currency, 'USD');
  assert.match(metadata['orderTotal semantics'], /gross|historical/);
  assert.match(metadata['reportedRevenue semantics'], /canonical/i);
  assert.match(metadata['revenue aggregation'], /referral/);
});
test('CSV preserves zero and missing net values without gross fallback and respects currency selection', async () => {
  const base = canonical.orders[0];
  const report = { ...canonical, orders: [
    {...base, id: 'zero', orderTotal: 120, reportedRevenue: 0},
    {...base, id: 'missing', orderTotal: 120, reportedRevenue: undefined},
    {...base, id: 'other-currency', currency: 'EUR'},
    {...base, id: '=quoted,"value"', matchType: 'referral', reportedRevenue: 100},
  ] };
  const parsed = parseCSV(await exportCSV(report));
  const index = parsed.findIndex(r => r[0] === 'id'), columns = parsed[index];
  assert.ok(columns.includes('reportedRevenue'));
  const rows = parsed.slice(index + 1).map(r => Object.fromEntries(columns.map((key, i) => [key, r[i]])));
  assert.equal(rows.length, 3); assert.equal(rows[0].reportedRevenue, '0'); assert.equal(rows[1].reportedRevenue, '');
  assert.equal(rows[2].id, "'=quoted,\"value\""); assert.equal(rows[2].matchType, 'referral');
  assert.equal(rows[2].reportedRevenue, '100'); // Raw repeated base remains available, not silently zeroed.
});
