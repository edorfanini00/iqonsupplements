import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.test',SHARED_AFFILIATE_RELAY_SECRET:'x'.repeat(40)};
test('SSR compatibility request targets only additive Body session namespace',async()=>{
 let target='';
 const result=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/shared-session',{headers:{cookie:'iqon_affiliate_wp_jwt=fixture'}}),{env,fetch:async(url,init)=>{target=String(url);assert.equal(new Headers(init?.headers).get('cookie'),'iqon_affiliate_wp_jwt=fixture');return Response.json({session:null},{status:401});}});
 assert.equal(target,env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/integrations/body/session');
 assert.equal(result.status,401);
});
test('audited marketing reads preserve complete Customers tab without permitting unkeyed sends',async()=>{
 for(const path of ['/api/affiliates/admin/marketing/audience','/api/affiliates/admin/marketing/campaigns','/api/affiliates/admin/marketing/campaigns/campaign_1']){
  let called=false;
  const read=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+path),{env,fetch:async()=>{called=true;return Response.json({ok:true});}});
  assert.equal(read.status,200);assert.equal(called,true);
  const write=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+path,{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN}}),{env,fetch:async()=>{throw Error('must not send');}});
  assert.equal(write.status,path==='/api/affiliates/admin/marketing/campaigns'?400:501);
 }
});
test('shop-manager read uses canonical full source rather than nonexistent local data',async()=>{
 let target='';const result=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/shop-manager/orders?range=m%3A2026-08'),{env,fetch:async url=>{target=String(url);return Response.json({orders:[]});}});
 assert.equal(result.status,200);assert.equal(target,env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/affiliates/shop-manager/orders?range=m%3A2026-08');
});
