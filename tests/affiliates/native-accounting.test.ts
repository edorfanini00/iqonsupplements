import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.test',SHARED_AFFILIATE_RELAY_SECRET:'s'.repeat(40),NODE_ENV:'production'};
const methods=[...['adjustments','expenses','orders','products','purchases','sales'].map(r=>['POST',r]),...['adjustments','expenses','purchases','sales','orders'].map(r=>['DELETE',r+'/record1']),['PATCH','items/record1'],['PATCH','orders/record1']];
const key='35a7e3a4-940b-4e0d-b0d2-d2b2ae238820';
test('exact thirteen accounting methods route to fixed native authority and carry receipt key',async()=>{
 assert.equal(methods.length,13);
 for(const [method,path] of methods){
  let calls=0;
  const req=new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/accounting/'+path,{method,headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'application/json','idempotency-key':key},...(method==='DELETE'?{body:new ReadableStream({start(c){c.close();}}),duplex:'half' as const}:{body:'{}'})});
  const res=await relayAffiliateRequest(req,{env,fetch:async(url,init)=>{calls++;assert.equal(String(url),env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/integrations/body/native/accounting/'+path);assert.equal(new Headers(init?.headers).get('idempotency-key'),key);return Response.json({ok:true});}});
  assert.equal(res.status,200,method+' '+path);assert.equal(calls,1);
 }
});
test('accounting neighboring methods, source queries and forged origin remain fail closed',async()=>{
 for(const [method,path,origin] of [['PUT','expenses',env.SHARED_AFFILIATE_PORTAL_ORIGIN],['DELETE','products/record1',env.SHARED_AFFILIATE_PORTAL_ORIGIN],['POST','expenses?store=body',env.SHARED_AFFILIATE_PORTAL_ORIGIN],['POST','expenses','https://evil.invalid'],['POST','unknown',env.SHARED_AFFILIATE_PORTAL_ORIGIN]]){
  let calls=0;const res=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/accounting/'+path,{method,headers:{origin,'content-type':'application/json'},body:'{}'}),{env,fetch:async()=>{calls++;return Response.json({ok:true});}});
  assert.ok(res.status>=400);assert.equal(calls,0);
 }
});
test('all thirteen original accounting form mutations retain a durable operation UUID',()=>{
 const page=readFileSync(new URL('../../app/affiliates/admin/accounting/page.tsx',import.meta.url),'utf8');
 assert.equal((page.match(/accountingMutationFetch\([^\n]+, \{\s*method: "(?:POST|PATCH|DELETE)"/g)??[]).length,13);
});

test('accounting form response loss retains UUID and does not report unreadable success',async()=>{
 const {accountingMutationFetch}=await import('../../lib/affiliates/accounting-mutation-fetch');
 const state=new Map<string,string>();const storage={getItem:(k:string)=>state.get(k)??null,setItem:(k:string,v:string)=>{state.set(k,v);},removeItem:(k:string)=>{state.delete(k);}};
 const keys:string[]=[];let lose=true;
 const options={storage,randomUUID:()=>key,fetch:async(_url:string,init?:RequestInit)=>{keys.push(new Headers(init?.headers).get('idempotency-key')!);return lose?new Response('{',{status:200}):Response.json({ok:true,expense:{id:'kept'}});}};
 await assert.rejects(accountingMutationFetch('/api/affiliates/admin/accounting/expenses',{method:'POST',body:'{}'},options));assert.equal(state.size,1);
 lose=false;assert.equal((await accountingMutationFetch('/api/affiliates/admin/accounting/expenses',{method:'POST',body:'{}'},options)).status,200);assert.deepEqual(keys,[key,key]);assert.equal(state.size,0);
});

test('accounting without a UUID never dispatches a financial operation',async()=>{
 let calls=0;const response=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/admin/accounting/expenses',{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'application/json'},body:'{}'}),{env,fetch:async()=>{calls++;return Response.json({ok:true});}});
 assert.equal(response.status,400);assert.equal(calls,0);
});
