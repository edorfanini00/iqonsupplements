import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.invalid',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.invalid',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-only-'.repeat(4)};
// Safety acceptance, NOT method completion: failed shared-finance qualification
// must not be bypassed by widening the Body relay into original unsafe writers.
const cases=[
 ['POST','/api/affiliates/admin/woocommerce-sync'],
 ['POST','/api/affiliates/admin/portal-commerce-sync'],
 ['POST','/api/affiliates/admin/orders/123/attribute'],
 ['DELETE','/api/affiliates/admin/orders/123/attribute'],
 ['POST','/api/affiliates/admin/orders/123/refund'],
 ['POST','/api/affiliates/admin/subscriptions/sub_123'],
 ['GET','/api/affiliates/orders/order_123?refresh=1'],
] as const;
for(const [method,path] of cases)test(`unqualified exact-seven gate: ${method} ${path}`,async()=>{
 let calls=0;const response=await relayAffiliateRequest(new Request('https://body.invalid'+path,{method,headers:{origin:'https://body.invalid','content-type':'application/json','idempotency-key':'00000000-0000-4000-8000-000000000001'},...(method==='GET'?{}:{body:'{}'})}),{env,fetch:async()=>{calls++;throw Error('UNQUALIFIED_FORWARD');}});
 assert.ok([404,501].includes(response.status));assert.equal(calls,0);
});
