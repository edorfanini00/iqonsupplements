import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-relay-test-secret-32-characters'};
test('unqualified writes never reach canonical finance or provider state',async()=>{
 // Onboarding/notes now use explicit local-state adapters; neighboring provider and finance actions stay denied.
 for(const [path,method] of [['admin/payouts','POST'],['admin/affiliates/a','PATCH'],['admin/app','POST'],['creator-code','POST'],['admin/rates','PUT'],['admin/notes/note1','DELETE']]){
  let calls=0;const result=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/'+path,{method,headers:{origin:'https://body.test','content-type':'application/json'},body:'{}'}),{env,fetch:async()=>{calls++;return Response.json({ok:true});}});
  assert.equal(calls,0,path);assert.equal(result.status,501,path);
 }
});
test('order detail query cannot escalate into refreshed writes',async()=>{
 for(const query of ['?refresh=0&refresh=1','?%72efresh=1','?refresh=true','?unknown=1']){
 let calls=0;const result=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/orders/123'+query),{env,fetch:async()=>{calls++;return Response.json({});}});
 assert.equal(calls,0,query);assert.equal(result.status,501,query);
 }
});
test('communication read markers need exact browser origin and no prefetch',async()=>{
 for(const path of ['messages','admin/affiliate-messages/a'])for(const headers of [{},{origin:'https://evil.test'},{origin:'https://body.test',purpose:'prefetch'}]){
 let calls=0;const result=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/'+path,{headers}),{env,fetch:async()=>{calls++;return Response.json({});}});
 assert.equal(calls,0);assert.equal(result.status,403);
 }
});
test('upstream cookie lifetimes are never extended',async()=>{
 const result=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/login',{method:'POST',headers:{origin:'https://body.test','content-type':'application/json'},body:'{}'}),{env,fetch:async()=>new Response('{}',{headers:{'set-cookie':'iqon_affiliate_wp_jwt=short; Max-Age=120; Domain=health.test'}})});
 assert.match(result.headers.getSetCookie()[0],/Max-Age=120(?:;|$)/);
 assert.doesNotMatch(result.headers.getSetCookie()[0],/Domain=/);
});
