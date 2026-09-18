import {test} from 'node:test';import assert from 'node:assert/strict';
import {providerMutationFetch} from '../../lib/affiliates/provider-mutation-fetch';
test('truncated or negative successful acknowledgements retain the UUID and cannot clear forms',async()=>{
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 for(const body of ['{','{"ok":false}'])await assert.rejects(providerMutationFetch('/fixture',{method:'POST'},{storage,randomUUID:()=> 'fixture-uuid',fetch:async()=>new Response(body,{status:200})}));
 assert.equal(values.size,1);let key='';await providerMutationFetch('/fixture',{method:'POST'},{storage,fetch:async(_,init)=>{key=new Headers(init?.headers).get('idempotency-key')??'';return Response.json({ok:true});}});assert.equal(key,'fixture-uuid');assert.equal(values.size,0);
});
