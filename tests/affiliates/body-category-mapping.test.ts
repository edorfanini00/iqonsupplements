import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-test-credential-at-least-32'};
test('category revenue uses only canonical additive read with independent reporting budget',async()=>{
 const query='?start=2026-08-01T04%3A00%3A00.000Z&end=2026-09-01T04%3A00%3A00.000Z';
 let target=''; let timeout=0;
 const original=AbortSignal.timeout;
 AbortSignal.timeout=(ms)=>{timeout=ms;return original(ms)};
 try {
 const res=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/category-revenue'+query),{env,fetch:async(url)=>{target=String(url);return Response.json({version:1});}});
 assert.equal(res.status,200);assert.equal(target,'https://health.test/api/integrations/body/category-revenue'+query);assert.ok(timeout>=30000);
 let called=false;
 const denied=await relayAffiliateRequest(new Request('https://body.test/api/affiliates/category-revenue',{method:'POST',headers:{origin:'https://body.test'}}),{env,fetch:async()=>{called=true;return Response.json({});}});
 assert.equal(called,false);assert.ok(denied.status>=400);
 } finally {AbortSignal.timeout=original;}
});
