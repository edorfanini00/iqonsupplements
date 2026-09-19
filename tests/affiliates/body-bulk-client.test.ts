import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBulkClient} from '../../lib/affiliates/canonical-bulk-client';
const id='87bfc143-8302-4073-b184-a000ee947ff1';
const dto=(version:number|null=1)=>({version:1,batchId:id,portal:'supplements',total:1,remaining:1,providerActivation:'disabled',targets:[{affiliateId:'a',commandId:id,commandVersion:version,state:'pending',outbox:[],events:[]}]});
function storage(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};}
test('persists one actor-bound all-affiliate attempt before dispatch; lost create recovers status without resubmission',async()=>{
 const s=storage();const calls:string[]=[];let lost=true;
 const client=createBulkClient({storage:s,uuid:()=>id,fetch:async(url,init)=>{calls.push(`${init?.method??'GET'} ${url}`);assert.ok(s.getItem('iqon:bulk:v1:wp:1'));if(lost){lost=false;throw Error('lost');}return Response.json(dto());}});
 await assert.rejects(client.advance('wp:1',true));assert.deepEqual(await client.advance('wp:1'),dto());assert.deepEqual(calls,['POST /api/affiliates/commands/creator-code-bulk',`GET /api/affiliates/commands/creator-code-bulk/${id}`]);assert.equal(await client.advance('wp:2'),null);
});
test('404 replays exact all selection and resume only admits missing children once per step',async()=>{
 const s=storage();const calls:{url:string;init?:RequestInit}[]=[];let n=0;
 const client=createBulkClient({storage:s,uuid:()=>id,fetch:async(url,init)=>{calls.push({url,init});n++;if(n===1)throw Error('lost');if(n===2)return Response.json({}, {status:404});return Response.json(dto(n===3?null:1));}});
 await assert.rejects(client.advance('wp:1',true));await client.advance('wp:1');await client.advance('wp:1');
 assert.equal(calls[0].init?.body,calls[2].init?.body);assert.deepEqual(JSON.parse(String(calls[2].init?.body)),{version:1,batchId:id,selection:{}});assert.equal(calls[3].init?.method,'POST');assert.equal(calls[3].url,`/api/affiliates/commands/creator-code-bulk/${id}`);assert.equal(calls[3].init?.body,undefined);await client.advance('wp:1');assert.equal(calls[4].init?.method,'GET');
});
test('revoked session stops admission, retaining journal; pending/conflict never becomes completion',async()=>{
 const s=storage();let n=0;const c=createBulkClient({storage:s,uuid:()=>id,fetch:async()=>++n===1?Response.json(dto(null)):Response.json({error:'Revoked'},{status:403})});await c.advance('wp:1',true);await assert.rejects(c.advance('wp:1'),/403/);assert.ok(s.getItem('iqon:bulk:v1:wp:1'));assert.equal(n,2);
});
