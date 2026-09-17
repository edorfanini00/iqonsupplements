import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relayAffiliateRequest } from '../../lib/affiliates/shared-relay';
const env = { SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test', SHARED_AFFILIATE_PORTAL_ORIGIN:'https://supplements.example.test', SHARED_AFFILIATE_RELAY_SECRET:'a'.repeat(40), NODE_ENV:'production' };
const req = (path='/api/affiliates/login', origin: string | null=env.SHARED_AFFILIATE_PORTAL_ORIGIN) => new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+path,{method:'POST',headers:{...(origin?{origin}:{}),'content-type':'application/json',cookie:'cart=private; iqon_affiliate_wp_jwt=token; iqon_affiliate_portal_snapshot=snapshot',authorization:'Bearer forged','x-iqon-portal':'forged'},body:'{"email":"user@example.test","password":"fixture"}'});
test('legacy financial write paths stay unavailable even with an idempotency header',async()=> {
 for(const [path,method] of [['admin/payouts','POST'],['admin/payouts/payout_1','DELETE'],['admin/app','POST']]) {
  for(const key of ['valid-key','','k'.repeat(201)]) {
   const request=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/'+path,{method,headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'application/json','idempotency-key':key},body:'{}'});
   let called=false;
   const response=await relayAffiliateRequest(request,{env,fetch:async()=>{called=true;return Response.json({ok:true});}});
   assert.equal(response.status,501);assert.equal(called,false);
  }
 }
});
test('bodyless logout uses authority and non-JSON body is rejected',async()=> {
 const empty=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/logout',{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN}});
 assert.equal((await relayAffiliateRequest(empty,{env,fetch:async()=>Response.json({ok:true})})).status,200);
 const form=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/login',{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'text/plain'},body:'password=x'});
 assert.equal((await relayAffiliateRequest(form,{env})).status,415);
});
test('Shopify-shaped IDs cannot trigger Health provider operations',async()=> {
 for(const path of ['/api/affiliates/admin/orders/987654/refund','/api/affiliates/admin/subscriptions/987654','/api/affiliates/admin/accounting/orders','/api/affiliates/admin/customers/email']) {
  let called=false;const result=await relayAffiliateRequest(req(path),{env,fetch:async()=>{called=true;return Response.json({ok:true});}});
  assert.equal(result.status,501);assert.equal(called,false);
 }
});
test('unconfigured authority never falls through',async()=> { assert.equal((await relayAffiliateRequest(req(),{env:{}})).status,503); });
test('only named auth cookies and trusted portal credential go to fixed authority',async()=> {
 let sent=false;
 const response=await relayAffiliateRequest(req(),{env,fetch:async(url,init)=>{
  sent=true; assert.equal(String(url),'https://health.example.test/api/affiliates/login');
  const h=new Headers(init?.headers); assert.equal(h.get('authorization'),null); assert.equal(h.get('cookie'),'iqon_affiliate_wp_jwt=token; iqon_affiliate_portal_snapshot=snapshot');
  assert.equal(h.get('x-iqon-portal'),env.SHARED_AFFILIATE_PORTAL_ORIGIN); assert.equal(init?.redirect,'error');
  const headers=new Headers(); headers.append('set-cookie','iqon_affiliate_wp_jwt=issued; Domain=health.example.test; Path=/evil; HttpOnly'); headers.append('set-cookie','cart=leak'); headers.set('location','https://evil.test');
  return new Response('{"ok":true}',{headers});
 }});
 assert.equal(sent,true); assert.equal(response.status,200); const cookie=response.headers.get('set-cookie')!; assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=Lax/); assert.doesNotMatch(cookie,/Domain=|cart=|evil/); assert.equal(response.headers.get('location'),null);
});
test('CSRF null absent foreign origins and non-JSON mutations rejected',async()=> { for(const origin of [null,'null','https://evil.test']) assert.equal((await relayAffiliateRequest(req(undefined,origin),{env})).status,403); });
test('unknown targets ingestion jobs and method escalation denied',async()=> { for(const path of ['/api/affiliates/../../admin','/api/affiliates/webhooks/shopify','/api/affiliates/admin/portal-commerce-sync','/api/cron/leaderboard','/api/affiliates/%2f%2fevil.test','/api/affiliates/shared-session']) assert.equal((await relayAffiliateRequest(req(path),{env})).status,404); });
test('unsafe authority and transport failures fail closed',async()=> {
 for(const url of ['http://health.example.test','https://user:pass@health.example.test','https://health.example.test/path']) assert.equal((await relayAffiliateRequest(req(),{env:{...env,SHARED_AFFILIATE_HEALTH_ORIGIN:url}})).status,503);
 assert.equal((await relayAffiliateRequest(req(),{env,fetch:async()=>{throw Error('offline')}})).status,502);
 assert.equal((await relayAffiliateRequest(req(),{env,fetch:async()=>new Response(null,{status:302,headers:{location:'https://evil.test'}})})).status,502);
});
