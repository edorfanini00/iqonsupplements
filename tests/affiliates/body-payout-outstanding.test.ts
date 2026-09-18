import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'local-only-test-secret-32-characters'};
test('only exact outstanding GET and affiliateId reach canonical authority',async()=>{
 let target='',calls=0;
 const transport=async(url:string|URL,init?:RequestInit)=>{calls++;target=String(url);assert.equal(init?.cache,'no-store');assert.equal(new Headers(init?.headers).get('origin'),'https://body.test');return Response.json({ok:true,version:1,buckets:[]});};
 const res=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/payouts/outstanding?affiliateId=fixture'),{env,fetch:transport});
 assert.equal(res.status,200);assert.equal(target,'https://health.test/api/integrations/body/payouts/outstanding?affiliateId=fixture');
 for(const [path,method] of [['?affiliateId=fixture','POST'],['?affiliateId=fixture&category=app','GET'],['?affiliateId=fixture&affiliateId=other','GET'],['','GET'],['/extra?affiliateId=fixture','GET']]){
  const response=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/payouts/outstanding'+path,{method}),{env,fetch:transport});assert.equal(response.status,404);
 }
 assert.equal(calls,1);
});
