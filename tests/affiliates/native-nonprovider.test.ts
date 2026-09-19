import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'test',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.invalid',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.invalid',SHARED_AFFILIATE_RELAY_SECRET:'fixture-secret-'.repeat(4)};
const cases=[['DELETE','admin/messages/x','messages/x'],['DELETE','admin/notes/x','notes/x'],['DELETE','admin/affiliates/x','affiliates/x'],['DELETE','admin/commissions/x','commissions/x'],['POST','admin/app','app'],['POST','tiktok','tiktok'],['PATCH','admin/tiktok','tiktok-settings'],['PATCH','admin/rankings','rankings'],['DELETE','admin/tiktok/x','tiktok/x']];
for(const [method,path,target] of cases)test(`fixed ${method} ${path} relay`,async()=>{
 let calls=0;const send=async(url:string|URL)=>{calls++;assert.equal(new URL(String(url)).pathname,'/api/integrations/body/native/nonprovider/'+target);return Response.json({ok:true});};
 const req=(suffix='')=>new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/'+path+suffix,{method,headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'idempotency-key':'11111111-1111-4111-8111-111111111111'}});
 assert.equal((await relayAffiliateRequest(req(),{env,fetch:send})).status,200);assert.equal(calls,1);
 calls=0;assert.equal((await relayAffiliateRequest(req('?extra=1'),{env,fetch:send})).ok,false);assert.equal(calls,0);
});

test('unchanged form helper retains UUID and throws on lost committed acknowledgement',async()=>{
 const {nonproviderMutationFetch}=await import('../../lib/affiliates/nonprovider-mutation-fetch');
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const keys:string[]=[];let lose=true;
 const options={storage,randomUUID:()=> '11111111-1111-4111-8111-111111111111',fetch:async(_u:string,i?:RequestInit)=>{keys.push(new Headers(i?.headers).get('idempotency-key')!);return lose?new Response('{',{status:200}):Response.json({ok:true});}};
 await assert.rejects(nonproviderMutationFetch('/api/affiliates/admin/app',{method:'POST',body:'{}'},options));assert.equal(values.size,1);
 lose=false;await nonproviderMutationFetch('/api/affiliates/admin/app',{method:'POST',body:'{}'},options);assert.deepEqual(keys,[options.randomUUID(),options.randomUUID()]);assert.equal(values.size,0);
});
