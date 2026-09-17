import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('minimal-principal dependent legacy routes never import independent financial store',()=>{
 for(const route of ['bank','dashboard','invite','me','messages','network','onboarding']){
 const source=readFileSync(new URL(`../../app/api/affiliates/${route}/route.ts`,import.meta.url),'utf8');
 assert.doesNotMatch(source,/from ["']@\/lib\/affiliates\/store["']/,route);
 assert.match(source,/relayAffiliateRequest/,route);
 }
});
