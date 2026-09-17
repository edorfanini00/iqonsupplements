import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-test-credential-at-least-32'};
test('accounting picker only maps GET with no query to additive read-only endpoint',async()=>{
 let target='';const response=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/admin/accounting/products'),{env,fetch:async(url)=>{target=String(url);return Response.json({ok:true,products:[],reconciled:[]});}});
 assert.equal(response.status,200);assert.equal(target,'https://health.test/api/integrations/body/accounting-products');
 for(const [method,query] of [['POST',''],['GET','?reconcile=1']]){
 let calls=0;const blocked=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/admin/accounting/products'+query,{method,headers:{origin:'https://body.test'}}),{env,fetch:async()=>{calls++;return Response.json({});}});
 assert.equal(calls,0);assert.equal(blocked.status,501);
 }
});
