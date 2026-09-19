import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeMutationFetch} from '../../lib/affiliates/native-mutation-fetch';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.example.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.example.test',SHARED_AFFILIATE_RELAY_SECRET:'s'.repeat(40),NODE_ENV:'production'};
const key='00000000-0000-4000-8000-000000000001';
test('exact native account/contact/thread actions preserve the operation key and never retry transport',async()=>{
 for(const [path,target] of [['change-password','change-password'],['forgot-password','forgot-password'],['reset-password','reset-password'],['contact','contact'],['invite','invite'],['creator-code','creator-code'],['admin/affiliate-messages/broadcast','broadcast'],['admin/messages/fixture/reply','contact-reply/fixture'],['messages','messages'],['admin/affiliate-messages/fixture','affiliate-messages/fixture']]){
  let calls=0;const r=await relayAffiliateRequest(new Request(env.SHARED_AFFILIATE_PORTAL_ORIGIN+'/api/affiliates/'+path,{method:'POST',headers:{origin:env.SHARED_AFFILIATE_PORTAL_ORIGIN,'content-type':'application/json','idempotency-key':key},body:'{}'}),{env,fetch:async(url,init)=>{calls++;assert.equal(String(url),env.SHARED_AFFILIATE_HEALTH_ORIGIN+'/api/integrations/body/native/'+target);assert.equal(new Headers(init?.headers).get('idempotency-key'),key);throw Error('fixture response lost');}});assert.equal(r.status,502);assert.equal(calls,1);
 }
});
test('client retains only a UUID across response loss/reload; never passwords or automatic retries',async()=>{
 const items=new Map<string,string>();const storage={getItem:(k:string)=>items.get(k)??null,setItem:(k:string,v:string)=>{items.set(k,v);},removeItem:(k:string)=>{items.delete(k);}};
 let calls=0;const init={method:'POST',body:JSON.stringify({currentPassword:'OLD_SECRET',newPassword:'NEW_SECRET'})};
 const opts={storage,randomUUID:()=>key,fetch:async(_url:string,options?:RequestInit)=>{calls++;assert.equal(new Headers(options?.headers).get('idempotency-key'),key);throw Error('lost');}};
 await assert.rejects(nativeMutationFetch('/api/affiliates/change-password',init,opts));assert.equal(calls,1);assert.deepEqual([...items.values()],[key]);assert.ok(!JSON.stringify([...items]).includes('SECRET'));
 const response=await nativeMutationFetch('/api/affiliates/change-password',init,{...opts,fetch:async(_url,options)=>{assert.equal(new Headers(options?.headers).get('idempotency-key'),key);return Response.json({ok:true});}});assert.equal(response.status,200);assert.equal(items.size,0);
});

test('unreadable or negative success responses keep the operation key for safe recovery',async()=>{
 const items=new Map<string,string>();
 const storage={getItem:(k:string)=>items.get(k)??null,setItem:(k:string,v:string)=>{items.set(k,v);},removeItem:(k:string)=>{items.delete(k);}};
 for(const response of [new Response('{"ok":', {status:200}),Response.json({ok:false}),new Response(null,{status:204})]){
  const returned=await nativeMutationFetch('/api/affiliates/invite',{method:'POST',body:'{}'},{storage,randomUUID:()=>key,fetch:async()=>response});
  assert.equal(returned,response);
  assert.deepEqual([...items.values()],[key]);
 }
});

test('generic forgot-password acknowledgement retains its key; never assumes mail delivery',async()=>{
 const items=new Map<string,string>();const keys:string[]=[];
 const storage={getItem:(k:string)=>items.get(k)??null,setItem:(k:string,v:string)=>{items.set(k,v);},removeItem:(k:string)=>{items.delete(k);}};
 const options={storage,randomUUID:()=>key,fetch:async(_url:string,init?:RequestInit)=>{keys.push(new Headers(init?.headers).get('idempotency-key')!);return Response.json({ok:true,message:'If eligible, check your inbox.'});}};
 const init={method:'POST',body:JSON.stringify({email:'fixture@example.invalid'})};
 await nativeMutationFetch('/api/affiliates/forgot-password',init,options);
 assert.deepEqual([...items.values()],[key]);
 await nativeMutationFetch('/api/affiliates/forgot-password',init,options);
 assert.deepEqual(keys,[key,key]);
});
