import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));

test('Vercel uses the qualified webpack build without database migrations', () => {
  assert.equal(vercel.buildCommand, 'npm run build:vercel');
  assert.equal(pkg.scripts['build:vercel'], 'prisma generate && next build --webpack');
  assert.equal(pkg.scripts.postinstall, 'prisma generate');
  for (const hook of ['prebuild:vercel', 'postbuild:vercel']) {
    assert.equal(pkg.scripts[hook], undefined, `${hook} requires separate qualification`);
  }
});
