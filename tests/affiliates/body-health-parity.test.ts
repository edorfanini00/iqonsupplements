import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/health-original-parity.json',import.meta.url),'utf8'));
for(const [path,expected] of Object.entries(fixture.files)) {
 test(`Body preserves restored Health behavior and full reporting: ${path}`,()=>{
  const file=new URL('../../'+path,import.meta.url);
  assert.ok(existsSync(file),`Missing restored source ${path}`);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,'Only recorded Body style token changes are permitted; update against reviewed Health source, not Body output');
 });
}
