import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.invalid',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.invalid',SHARED_AFFILIATE_RELAY_SECRET:'x'.repeat(40)};
for(const [method,suffix] of [['POST',''],['PATCH','/campaign_1'],['DELETE','/campaign_1'],['POST','/campaign_1/run']])test(`maps only marketing ${method} ${suffix}`,async()=>{
 const calls:string[]=[];const transport=async(url:string|URL)=>{calls.push(String(url));return Response.json({ok:true});};
 const r=await relayAffiliateRequest(new Request('https://body.invalid/api/affiliates/admin/marketing/campaigns'+suffix,{method,headers:{origin:'https://body.invalid','content-type':'application/json','idempotency-key':'00000000-0000-4000-8000-000000000001'},body:'{}'}),{env,fetch:transport});
 assert.equal(r.status,200);assert.deepEqual(calls,['https://health.invalid/api/integrations/body/native/marketing/campaigns'+suffix]);
});
for(const path of ['test-email','customers/email'])test(`maps exact mail action ${path}`,async()=>{
 const calls:string[]=[];const fetch=async(url:string|URL)=>{calls.push(String(url));return Response.json({ok:true});};
 const result=await relayAffiliateRequest(new Request('https://body.invalid/api/affiliates/admin/'+path,{method:'POST',headers:{origin:'https://body.invalid','content-type':'application/json','idempotency-key':'00000000-0000-4000-8000-000000000001'},body:'{}'}),{env,fetch});
 assert.equal(result.status,200);assert.deepEqual(calls,['https://health.invalid/api/integrations/body/native/'+path]);
});
test('rejects arbitrary marketing writes and missing keys',async()=>{
 let calls=0;const transport=async()=>{calls++;return Response.json({ok:true});};for(const path of ['campaigns','arbitrary']){
 const r=await relayAffiliateRequest(new Request('https://body.invalid/api/affiliates/admin/marketing/'+path,{method:'POST',headers:{origin:'https://body.invalid'}}),{env,fetch:transport});assert.equal(r.ok,false);
 }assert.equal(calls,0);
});
