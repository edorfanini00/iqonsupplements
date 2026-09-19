import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.invalid',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.invalid',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-only-'.repeat(4)};
// Exact mounts only; corresponding real-PG native tests live in Health.
const cases=[
 ['POST','/api/affiliates/admin/woocommerce-sync'],
 ['POST','/api/affiliates/admin/portal-commerce-sync'],
 ['POST','/api/affiliates/admin/orders/123/attribute'],
 ['DELETE','/api/affiliates/admin/orders/123/attribute'],
 ['POST','/api/affiliates/admin/orders/123/refund'],
 ['POST','/api/affiliates/admin/subscriptions/sub_123'],
 ['GET','/api/affiliates/orders/order_123?refresh=1'],
] as const;
for(const [method,path] of cases)test(`exact-seven canonical adapter: ${method} ${path}`,async()=>{
 let calls=0;let target='';const response=await relayAffiliateRequest(new Request('https://body.invalid'+path,{method,headers:{origin:'https://body.invalid','content-type':'application/json','idempotency-key':'00000000-0000-4000-8000-000000000001'},...(method==='GET'?{}:{body:'{}'})}),{env,fetch:async(url)=>{calls++;target=String(url);return Response.json({ok:true});}});
 assert.equal(response.status,200);assert.equal(calls,1);assert.ok(target.startsWith('https://health.invalid/api/integrations/body/native/'));
 const denied=await relayAffiliateRequest(new Request('https://body.invalid'+path,{method,headers:{origin:'https://evil.invalid','idempotency-key':'00000000-0000-4000-8000-000000000001'},...(method==='GET'?{}:{body:'{}'})}),{env,fetch:async()=>{throw Error('FORBIDDEN_FORWARD');}});assert.equal(denied.status,403);
 const noKey=await relayAffiliateRequest(new Request('https://body.invalid'+path,{method,headers:{origin:'https://body.invalid'},...(method==='GET'?{}:{body:'{}'})}),{env,fetch:async()=>{throw Error('NO_KEY_FORWARD');}});assert.equal(noKey.status,400);
});
