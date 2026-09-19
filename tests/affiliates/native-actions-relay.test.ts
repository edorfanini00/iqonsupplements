import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.test',SHARED_AFFILIATE_RELAY_SECRET:'s'.repeat(40),NODE_ENV:'production'};
const req=(path:string,method:string,origin=env.SHARED_AFFILIATE_PORTAL_ORIGIN)=>new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/'+path,{method,headers:{origin,'content-type':'application/json'},body:'{}'});
test('bank PUT uses its dedicated fixed canonical adapter without an independent DB',async()=>{
 let called=0;
 const response=await relayAffiliateRequest(req('bank','PUT'),{env,fetch:async(url,init)=>{called++;assert.equal(String(url),env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/integrations/body/native/bank');assert.equal(init?.method,'PUT');return Response.json({ok:true});}});
 assert.equal(response.status,200);assert.equal(called,1);
});
test('onboarding and notes route only their exact mounted methods',async()=>{
 for(const [path,method,target] of [['onboarding','POST','onboarding'],['admin/notes','POST','notes'],['admin/notes/note1','PATCH','notes/note1'],['admin/messages/message1','PATCH','message-status/message1']]){
 const response=await relayAffiliateRequest(req(path,method),{env,fetch:async(url,init)=>{assert.equal(String(url),env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/integrations/body/native/'+target);assert.equal(init?.method,method);return Response.json({ok:true});}});assert.equal(response.status,200);
 }
});
test('payout reversal relays the original bodyless DELETE including a Next empty stream',async()=>{
 for(const streamed of [false,true]){
  const request=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/payouts/payout1',{method:'DELETE',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN},...(streamed?{body:new ReadableStream({start(controller){controller.close();}}),duplex:'half' as const}:{})});
  let calls=0;const response=await relayAffiliateRequest(request,{env,fetch:async(url,init)=>{calls++;assert.equal(String(url),env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/integrations/body/native/payout-reversal/payout1');assert.equal(init?.method,'DELETE');return Response.json({ok:true,receipt:{payoutId:'payout1',state:'reversed'}});}});
  assert.equal(response.status,200);assert.equal(calls,1);
 }
});
test('native bank rejects forged Origin, queries and neighboring method escalation without dispatch',async()=>{
 for(const request of [req('bank','PUT','https://evil.invalid'),req('bank?affiliateId=other','PUT'),req('bank','DELETE')]){
 let called=false;const response=await relayAffiliateRequest(request,{env,fetch:async()=>{called=true;return Response.json({});}});assert.equal(called,false);assert.ok(response.status>=400);
 }
});
