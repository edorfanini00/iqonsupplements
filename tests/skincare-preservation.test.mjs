import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const freeze=JSON.parse(readFileSync(new URL('../docs/qa/premium-site/skincare-freeze.json',import.meta.url)));
for(const [file,expected] of Object.entries(freeze.sha256)) test(`skincare preservation: ${file}`,()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL(`../${file}`,import.meta.url))).digest('hex'),expected);
});
test('skincare home retains its illustrative comparison and approved results',()=>{
 const home=readFileSync(new URL('../app/skincare/skincare-home.tsx',import.meta.url),'utf8');
 assert.match(home,/<SkinResults results=\{approvedSkincareResults\} products=\{skin\} showIllustrations\/>/);
});
