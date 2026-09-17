import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.test',SHARED_AFFILIATE_RELAY_SECRET:'x'.repeat(40)};
test('bounded slow canonical commerce reads do not inherit the short auth timeout',async()=>{
 const durations:number[]=[];
 const replacement=mock.method(AbortSignal,'timeout',(ms:number)=>{durations.push(ms);return new AbortController().signal;});
 try {
 for(const path of ['/api/affiliates/admin/orders?range=m%3A2026-08','/api/affiliates/me']) await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+path),{env,fetch:async()=>Response.json({ok:true})});
 assert.deepEqual(durations,[90000,15000]);
 } finally {replacement.mock.restore();}
});
