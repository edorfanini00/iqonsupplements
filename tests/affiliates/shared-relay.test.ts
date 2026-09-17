import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relayAffiliateRequest } from '../../lib/affiliates/shared-relay';
const env = { SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test', SHARED_AFFILIATE_PORTAL_ORIGIN:'https://supplements.example.test', SHARED_AFFILIATE_RELAY_SECRET:'a'.repeat(40), NODE_ENV:'production' };
const req = (path='/api/affiliates/login', origin: string | null=env.SHARED_AFFILIATE_PORTAL_ORIGIN) => new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+path,{method:'POST',headers:{...(origin?{origin}:{}),'content-type':'application/json',cookie:'cart=private; iqon_affiliate_wp_jwt=token; iqon_affiliate_portal_snapshot=snapshot',authorization:'Bearer forged','x-iqon-portal':'forged'},body:'{"email":"user@example.test","password":"fixture"}'});
test('payout POST forwards header-only idempotency unchanged without widening trusted headers',async()=> {
 for(const key of ['x','payout:external/2026_09-16.v1','k'.repeat(200)]) {
  const request=req('/api/affiliates/admin/payouts');
  request.headers.set('iDeMpOtEnCy-KeY',key);
  request.headers.set('x-iqon-relay-secret','forged');
  request.headers.set('x-untrusted','private');
  let sent=false;let forwardedKey:string | null=null;
  const response=await relayAffiliateRequest(request,{env,fetch:async(url,init)=>{
   sent=true;
   assert.equal(String(url),'https://health.example.test/api/affiliates/admin/payouts');
   const headers=new Headers(init?.headers);
   forwardedKey=headers.get('idempotency-key');
   assert.equal(headers.get('authorization'),null);
   assert.equal(headers.get('x-untrusted'),null);
   assert.equal(headers.get('x-iqon-relay-secret'),env.SHARED_AFFILIATE_RELAY_SECRET);
   assert.equal(headers.get('origin'),env.SHARED_AFFILIATE_PORTAL_ORIGIN);
   assert.equal(new TextDecoder().decode(init?.body as Uint8Array),'{"email":"user@example.test","password":"fixture"}');
   return Response.json({ok:true});
  }});
  assert.equal(sent,true);assert.equal(response.status,200);assert.equal(forwardedKey,key);
 }
});
test('invalid payout idempotency headers fail closed instead of falling back to a body token',async()=> {
 for(const key of ['', ' ', 'k'.repeat(201), 'key\tpart', 'key\u0001part', 'key\u007fpart', '\u00a0']) {
  const request=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/payouts',{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'application/json','idempotency-key':key},body:'{"idempotencyKey":"body-token"}'});
  let called=false;
  const response=await relayAffiliateRequest(request,{env,fetch:async()=>{called=true;return Response.json({ok:true});}});
  assert.equal(response.status,400,JSON.stringify(key));assert.equal(called,false);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
test('idempotency forwarding is limited to the exact allowed payout POST',async()=> {
 const cases: [string,string,number][]=[
  ['/api/affiliates/admin/payouts','GET',200],
  ['/api/affiliates/admin/payouts/payout_1','DELETE',200],
  ['/api/affiliates/login','POST',200],
  ['/api/affiliates/admin/app','POST',200],
  ['/api/affiliates/admin/payouts/payout_1','POST',404],
  ['/api/affiliates/admin/payouts/','POST',404],
  ['/api/affiliates/admin/payouts','PATCH',404],
 ];
 for(const [path,method,status] of cases) {
  const request=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+path,{method,headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'idempotency-key':'k'.repeat(201)}});
  let called=false;let forwardedKey:string | null='not-called';
  const response=await relayAffiliateRequest(request,{env,fetch:async(_url,init)=>{called=true;forwardedKey=new Headers(init?.headers).get('idempotency-key');return Response.json({ok:true});}});
  assert.equal(response.status,status,`${method} ${path}`);
  assert.equal(called,status===200);
  if(called)assert.equal(forwardedKey,null);
 }
});
test('payout body tokens and bytes remain unchanged with or without a header token',async()=> {
 const body=' { "affiliateId": "fixture", "idempotencyKey": "body-token" } ';
 for(const key of [null,'header-token']) {
  const request=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/payouts?fixture=1',{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},body});
  let forwardedBody:string | undefined;let forwardedKey:string | null= null;
  const response=await relayAffiliateRequest(request,{env,fetch:async(_url,init)=>{forwardedBody=new TextDecoder().decode(init?.body as Uint8Array);forwardedKey=new Headers(init?.headers).get('idempotency-key');return Response.json({ok:true});}});
  assert.equal(response.status,200);assert.equal(forwardedBody,body);assert.equal(forwardedKey,key);
 }
});
test('payout header forwarding cannot bypass origin or content-type checks',async()=> {
 for(const [origin,contentType,status] of [['https://evil.test','application/json',403],[env.SHARED_AFFILIATE_PORTAL_ORIGIN,'text/plain',415]] as const) {
  const request=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/payouts',{method:'POST',headers:{origin,'content-type':contentType,'idempotency-key':'valid-key'},body:'{}'});
  let called=false;
  const response=await relayAffiliateRequest(request,{env,fetch:async()=>{called=true;return Response.json({ok:true});}});
  assert.equal(response.status,status);assert.equal(called,false);
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
