import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCommandClient,commandComplete} from '../../lib/affiliates/canonical-command-client';
test('admin-create completion follows its own canonical tasks, never coupon-only success',()=>{
 const base={command:{state:'committed'},affiliate:{id:'new-admin'}};
 assert.equal(commandComplete('admin-create',{...base,outbox:[]}),true);
 assert.equal(commandComplete('admin-create',{...base,outbox:[{store:'identity',operation:'admin-identity',state:'blocked'},{store:'woo',operation:'public-code',state:'confirmed'},{store:'shopify',operation:'public-code',state:'confirmed'}]}),false);
});
test('approval cannot finish native form while canonical identity or notification work is unresolved',()=>{
 const codes=['woo','shopify'].map(store=>({store,operation:'public-code',state:'confirmed'}));
 for(const operation of ['admin-identity','approval-email','rejection-email']){
  const blocked={store:operation==='admin-identity'?'identity':'notification',operation,state:'blocked'};
  assert.equal(commandComplete('affiliate-approval',{command:{state:'committed'},outbox:[...codes,blocked]}),false,operation);
 }
 assert.equal(commandComplete('affiliate-approval',{command:{state:'committed'},outbox:[...codes,{store:'notification',operation:'approval-email',state:'confirmed'}]}),true);
});
const uuid='87bfc143-8302-4073-b184-a000ee947ff1';
function store(){const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}};}
test('durably retains exact key/payload on lost response; pending is not success; completed readback matches receipt',async()=>{
 const storage=store();const bodies:string[]=[];let fail=true;let state='pending';
 const transport=async(_url:string,init?:RequestInit)=>{bodies.push(String(init?.body));if(fail){fail=false;throw Error('lost response')}return Response.json({ok:true,command:{id:uuid,kind:'payout-record',state},payout:{id:'p'}})};
 const payload={affiliateId:'a',method:'bank',amount:10};
 let client=createCommandClient({storage,fetch:transport,uuid:()=>uuid});
 const first=await client.submit('wp:1','payout-record',payload);assert.equal(first.ok,false);assert.match((await first.json()).error,/unknown/i);assert.equal(storage.data.size,1);
 client=createCommandClient({storage,fetch:transport,uuid:()=>{throw Error('must not generate retry ID')}});
 const pending=await client.submit('wp:1','payout-record',payload);assert.equal(pending.ok,false);assert.match((await pending.json()).error,/pending/i);assert.equal(bodies[0],bodies[1]);
 const changed=await client.submit('wp:1','payout-record',{...payload,amount:20});assert.equal(changed.ok,false);assert.equal(bodies.length,2);
 state='committed';const final=await client.submit('wp:1','payout-record',payload);assert.equal(final.ok,true);assert.equal(bodies[0],bodies[2]);
});
test('signup never persists password and supports resubmission with same key',async()=>{
 const storage=store();const bodies:any[]=[];const client=createCommandClient({storage,uuid:()=>uuid,fetch:async(_url,init)=>{bodies.push(JSON.parse(String(init?.body)));return Response.json({ok:true,command:{id:uuid,kind:'signup',state:'pending'}})}});
 await client.submit('signup:test@example.test','signup',{email:'test@example.test',password:'private-secret',nickname:'test'});
 assert.ok(![...storage.data.values()].join('').includes('private-secret'));
 await client.submit('signup:test@example.test','signup',{email:'test@example.test',password:'resupplied-secret',nickname:'test'});
 assert.equal(bodies[0].commandId,bodies[1].commandId);assert.equal(bodies[1].payload.password,'resupplied-secret');
});
test('canonical committed payout is complete but committed code with blocked provider is not advertised complete',async()=>{
 const storage=store();const client=createCommandClient({storage,uuid:()=>uuid,fetch:async(url)=>Response.json({ok:true,command:{id:uuid,kind:url.includes('payout-record')?'payout-record':'creator-code-sync',state:'committed'},payout:{id:'fixture-payout'},outbox:[{store:'shopify',operation:'public-code',state:'blocked',reason:'Explicit terms required'}]})});
 assert.equal((await client.submit('wp:1','payout-record',{affiliateId:'a'})).ok,true);
 const code=await client.submit('wp:1','creator-code-sync',{affiliateId:'a'},0);assert.equal(code.ok,false);assert.match((await code.json()).error,/committed.*provider/i);
});
test('new version is explicit after canonical commit readback and archives unresolved provider receipt',async()=>{
 const storage=store();const ids=[uuid,'87bfc143-8302-4073-b184-a000ee947ff2'];let n=0;
 const client=createCommandClient({storage,uuid:()=>ids[n++],fetch:async(url,init)=>{const body=init?.body?JSON.parse(String(init.body)):null;return Response.json({ok:true,command:{id:body?.commandId??url.split('/').at(-1),kind:'commission-settings',state:'committed'},outbox:[{store:'shopify',operation:'public-code',state:'blocked'}]})}});
 await client.submit('wp:1','commission-settings',{affiliateId:'a',commissionRate:10},0);
 assert.equal(await client.finish('wp:1',client.list('wp:1')[0]),true);
 await client.submit('wp:1','commission-settings',{affiliateId:'a',commissionRate:20},1);
 assert.equal(client.list('wp:1').length,2);assert.equal(client.list('wp:1').filter(a=>a.archived).length,1);
});
test('correction requires definite validation rejection AND exact authorized canonical no-record readback',async()=>{
 const storage=store();let proof=false;
 const client=createCommandClient({storage,uuid:()=>uuid,fetch:async(_url,init)=>init?.method==='POST'?Response.json({error:'Invalid amount',errorDetail:{code:'VALIDATION_ERROR',message:'Invalid amount'}},{status:400}):Response.json(proof?{error:'Command not found',errorDetail:{code:'VALIDATION_ERROR',message:'Command not found'}}:{error:'Not Found'},{status:404})});
 await client.submit('wp:1','payout-record',{affiliateId:'a',amount:-1});
 const a=client.list('wp:1')[0];assert.equal(await client.allowCorrection('wp:1',a),false);assert.equal(client.list('wp:1')[0].archived,undefined);
 proof=true;assert.equal(await client.allowCorrection('wp:1',a),true);assert.equal(client.list('wp:1')[0].archived,true);
});
for(const code of ['VERSION_CONFLICT','PROVIDER_BUSY','REJECTED_CONFLICT'])test(`${code} permits corrected user submission without replaying an impossible attempt`,async()=>{
 const storage=store();let calls=0;const sent:any[]=[];
 const client=createCommandClient({storage,uuid:()=>calls++===0?uuid:'87bfc143-8302-4073-b184-a000ee947ff2',fetch:async(_url,init)=>{sent.push(JSON.parse(String(init?.body)));return Response.json({error:'Definitive non-commit',errorDetail:{code,message:'Definitive non-commit'}},{status:409})}});
 await client.submit('wp:1','commission-settings',{affiliateId:'a',commissionRate:10},1);
 await client.submit('wp:1','commission-settings',{affiliateId:'a',commissionRate:20},2);
 assert.equal(sent.length,2);assert.notEqual(sent[0].commandId,sent[1].commandId);assert.equal(sent[1].expectedVersion,2);
 assert.equal(client.list('wp:1').filter(a=>!a.archived).length,0);
});
test('anonymous signup DTO rejection permits correction without inaccessible authenticated status and never stores password',async()=>{
 const storage=store();let seq=0;const sent:any[]=[];
 const client=createCommandClient({storage,uuid:()=>seq++===0?uuid:'87bfc143-8302-4073-b184-a000ee947ff2',fetch:async(_url,init)=>{sent.push(JSON.parse(String(init?.body)));return Response.json({error:'Invalid phone',errorDetail:{code:'VALIDATION_ERROR',message:'Invalid phone'}},{status:400})}});
 await client.submit('signup:a','signup',{email:'a@example.test',phone:'',password:'secret'});
 await client.submit('signup:a','signup',{email:'a@example.test',phone:'5551234567',password:'secret'});
 assert.equal(sent.length,2);assert.notEqual(sent[0].commandId,sent[1].commandId);assert.ok(![...storage.data.values()].join('').includes('secret'));
});
test('payload CONFLICT never releases an uncertain financial key',async()=>{
 const storage=store();let calls=0;
 const client=createCommandClient({storage,uuid:()=>uuid,fetch:async()=>{calls++;return Response.json({error:{code:'CONFLICT',message:'Command payload conflict'}},{status:409})}});
 await client.submit('wp:1','payout-record',{affiliateId:'a',amount:10});
 await client.submit('wp:1','payout-record',{affiliateId:'a',amount:20});
 assert.equal(calls,1);assert.equal(client.list('wp:1')[0].archived,undefined);
});
test('storage unavailable blocks before network and mismatched command receipt is not success',async()=>{
 let calls=0;const storage={getItem:()=>null,setItem:()=>{throw Error('disabled')},removeItem:()=>{}};
 const client=createCommandClient({storage,uuid:()=>uuid,fetch:async()=>{calls++;return Response.json({})}});
 assert.equal((await client.submit('wp:1','payout-record',{affiliateId:'a'})).ok,false);assert.equal(calls,0);
 const other=createCommandClient({storage:store(),uuid:()=>uuid,fetch:async()=>Response.json({ok:true,command:{id:'wrong',kind:'payout-record',state:'completed'}})});
 assert.equal((await other.submit('wp:1','payout-record',{affiliateId:'a'})).ok,false);
});
