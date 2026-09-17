import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',VERCEL_ENV:'preview',VERCEL_URL:'body-candidate-owner.vercel.app',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.test',SHARED_AFFILIATE_RELAY_SECRET:'x'.repeat(40)};
test('exact server-assigned preview supports local sessions with canonical authority attribution',async()=>{
 const preview='https://'+env.VERCEL_URL;
 const request=new Request(preview+'/api/affiliates/login',{method:'POST',headers:{origin:preview,'content-type':'application/json'},body:'{"email":"synthetic@example.test","password":"synthetic"}'});
 let called=false;
 const response=await relayAffiliateRequest(request,{env,fetch:async(url,init)=>{called=true;assert.equal(String(url),env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/affiliates/login');const headers=new Headers(init?.headers);assert.equal(headers.get('origin'),env.SHARED_AFFILIATE_PORTAL_ORIGIN);assert.equal(headers.get('x-iqon-portal'),env.SHARED_AFFILIATE_PORTAL_ORIGIN);return Response.json({ok:true});}});
 assert.equal(response.status,200);assert.equal(called,true);
});
test('preview support never trusts arbitrary Host/Origin or widens production origins',async()=>{
 const preview='https://'+env.VERCEL_URL;
 for(const [url,origin,overrides] of [[preview,'https://other.vercel.app',{}],['https://other.vercel.app','https://other.vercel.app',{}],[preview,preview,{VERCEL_ENV:'production'}],[preview,preview,{VERCEL_URL:'user@evil.test'}]] as const){
  let called=false;const response=await relayAffiliateRequest(new Request(url+'/api/affiliates/logout',{method:'POST',headers:{origin}}),{env:{...env,...overrides},fetch:async()=>{called=true;return Response.json({ok:true});}});
  assert.equal(response.status,403);assert.equal(called,false);
 }
});
