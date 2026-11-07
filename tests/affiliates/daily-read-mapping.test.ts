import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relayAffiliateRequest} from '../../lib/affiliates/shared-relay';
const env={NODE_ENV:'production',SHARED_AFFILIATE_HEALTH_ORIGIN:'https://health.test',SHARED_AFFILIATE_PORTAL_ORIGIN:'https://body.test',SHARED_AFFILIATE_RELAY_SECRET:'synthetic-test-credential-at-least-32'};
for(const name of ['shopify-orders','supplements-code','supplements-codes'])test(`${name}: GET-only canonical relay, exact origin/cookie scope`,async()=>{
 let target='',calls=0;const fetcher=async(url:string|URL,init?:RequestInit)=>{calls++;target=String(url);assert.equal(new Headers(init?.headers).get('cookie'),'iqon_affiliate_wp_jwt=fixture');return Response.json({state:'pending'});};
 const response=await relayAffiliateRequest(new Request(`https://body.test/api/affiliates/${name}`,{headers:{cookie:'other=private;iqon_affiliate_wp_jwt=fixture'}}),{env,fetch:fetcher});assert.equal(response.status,200);assert.equal(target,`https://health.test/api/integrations/body/${name}`);
 await relayAffiliateRequest(new Request(`https://body.test/api/affiliates/${name}`,{method:'POST',headers:{origin:'https://body.test'}}),{env,fetch:fetcher});assert.equal(calls,1);
 const wrong=await relayAffiliateRequest(new Request(`https://evil.test/api/affiliates/${name}`),{env,fetch:fetcher});assert.equal(wrong.status,403);assert.equal(calls,1);
});
