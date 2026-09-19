import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('both original Overview pages mount role-specific additive cards using their exact selected preset',()=>{
 for(const [page,role] of [['admin','admin'],['dashboard','affiliate']]){
 const source=readFileSync(new URL(`../../app/affiliates/${page}/page.tsx`,import.meta.url),'utf8');
 assert.ok(source.includes(`<CategoryRevenue preset={preset} audience="${role}" />`));
 }
});
