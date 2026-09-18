import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-test-credential-at-least-32'};
const id='87bfc143-8302-4073-b184-a000ee947ff1';
test('bulk create, scoped status and bodyless resume relay only exact contract',async()=>{
 for(const [suffix,method] of [['','POST'],['/'+id,'GET'],['/'+id,'POST']]){
  let target='';const body=suffix?'':JSON.stringify({version:1,batchId:id,selection:{}});
  const res=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/commands/creator-code-bulk'+suffix,{method,headers:{origin:'https://body.test','content-type':'application/json'},...(body?{body}:{})}),{env,fetch:async(url)=>{target=String(url);return Response.json({version:1,batchId:id},{status:method==='GET'?200:202});}});
  assert.equal(res.status,method==='GET'?200:202);assert.equal(target,'https://health.test/api/integrations/body/commands/creator-code-bulk'+suffix);
 }
});
test('bulk rejects query, resume body, invalid id, foreign origin and scheduler',async()=>{
 for(const [path,method,body,origin] of [['creator-code-bulk/'+id+'?limit=5','POST','','https://body.test'],['creator-code-bulk/'+id,'POST','{}','https://body.test'],['creator-code-bulk/nope','GET','','https://body.test'],['creator-code-bulk','POST','{}','https://evil.test'],['../recovery','GET','','https://body.test']]){
  let called=false;const res=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/commands/'+path,{method,headers:{origin,'content-type':'application/json'},...(body?{body}:{})}),{env,fetch:async()=>{called=true;return Response.json({});}});
  assert.ok(res.status>=400);assert.equal(called,false);
 }
});
