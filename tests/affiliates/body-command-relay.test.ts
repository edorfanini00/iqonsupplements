import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-test-credential-at-least-32'};
const id='87bfc143-8302-4073-b184-a000ee947ff1';
test('only fixed canonical commands relay exact envelope and authenticated receipt reads',async()=>{
 for(const kind of ['signup','affiliate-approval','commission-settings','payout-record','creator-code-sync']){
  const body=JSON.stringify({version:1,commandId:id,payload:{affiliateId:'a'}});let target='',sent='';
  const res=await relayAffiliateRequest(new Request(`https://body.test/api/affiliates/commands/${kind}`,{method:'POST',headers:{origin:'https://body.test','content-type':'application/json'},body}),{env,fetch:async(url,init)=>{target=String(url);sent=new TextDecoder().decode(init!.body as Uint8Array);return Response.json({ok:true,command:{id,kind,state:'pending'}},{status:202});}});
  assert.equal(res.status,202);assert.equal(target,`https://health.test/api/integrations/body/commands/${kind}`);assert.equal(sent,body);
  const read=await relayAffiliateRequest(new Request(`https://body.test/api/affiliates/commands/${kind}/${id}`),{env,fetch:async()=>Response.json({state:'pending'})});assert.equal(read.status,200);
 }
});
test('canonical current command version uses dedicated admin state read, not guessed zero',async()=>{
 let target='';const res=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/commands/state/a'),{env,fetch:async(url)=>{target=String(url);return Response.json({affiliateId:'a',version:3,terms:[],outbox:[]})}});assert.equal(res.status,200);assert.equal(target,'https://health.test/api/integrations/body/commands/state/a');
});
test('unknown commands, missing/cross origin, nonPOST command writes never dispatch',async()=>{
 for(const [path,method,origin] of [['payout-record','POST','https://evil.test'],['payout-record','POST',''],['payout-record','DELETE','https://body.test'],['run-any-route','POST','https://body.test'],['payout-record/not-a-uuid','GET','https://body.test']]){
 let count=0;const res=await relayAffiliateRequest(new Request(`https://body.test/api/affiliates/commands/${path}`,{method,headers:{origin}}),{env,fetch:async()=>{count++;return Response.json({})}});assert.ok(res.status>=400);assert.equal(count,0);
 }
});
