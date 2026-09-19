import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.invalid',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.invalid',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-only-'.repeat(4)};
const headers={'sec-fetch-site':'same-origin','sec-fetch-mode':'cors','sec-fetch-dest':'empty','idempotency-key':'00000000-0000-4000-8000-000000000001'};
test('original browser refresh GET without Origin forwards only explicit same-origin fetch with UUID',async()=>{
 let calls=0;const result=await relayAffiliateRequest(new Request('https://body.invalid/api/affiliates/orders/order_123?refresh=1',{headers}),{env,fetch:async(url,init)=>{calls++;assert.equal(String(url),'https://health.invalid/api/integrations/body/native/order-refresh/order_123?refresh=1');assert.equal(new Headers(init?.headers).get('origin'),'https://body.invalid');return Response.json({ok:true})}});
 assert.equal(result.status,200);assert.equal(calls,1);
});
for(const [label,changes] of Object.entries({'cross-site':{'sec-fetch-site':'cross-site'},'same-site':{'sec-fetch-site':'same-site'},'navigation':{'sec-fetch-mode':'navigate'},'image':{'sec-fetch-dest':'image'},'prefetch':{'purpose':'prefetch'},'sec-prefetch':{'sec-purpose':'prefetch'},'explicit bad origin':{'origin':'https://evil.invalid'},'no metadata':{'sec-fetch-site':''}}))test('refresh rejects '+label,async()=>{
 const r=await relayAffiliateRequest(new Request('https://body.invalid/api/affiliates/orders/order_123?refresh=1',{headers:{...headers,...changes}}),{env,fetch:async()=>{throw Error('MUST_NOT_FORWARD')}});assert.equal(r.status,403);
});
