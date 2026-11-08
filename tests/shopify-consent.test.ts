import test from "node:test";
import assert from "node:assert/strict";
import {consentQuery,shopifyConsentProxy} from "../lib/shopify-consent-proxy";
import {parseVisitorConsent} from "../lib/shopify-consent";

test("native consent proxy strips sensitive context and refuses non-consent operations",()=>{
  const query=consentQuery({query:'query { consentManagement { cookies(visitorConsent:{marketing:true},landingPage:"https://site/account?email=secret",origReferrer:"secret",visitorEmail:"secret") { trackingConsentCookie } } }'});
  assert.match(query,/marketing: true/);assert.doesNotMatch(query,/secret|landingPage|origReferrer|visitorEmail/);
  for(const query of ['mutation {cartCreate(input:{}){cart{id}}}','{products(first:1){nodes{id}}}','{a:consentManagement{banner{enabled}} products(first:1){nodes{id}}}',
    '{consentManagement{cookies(visitorConsent:{marketing:"yes"}){cookieDomain}}}','query A{consentManagement{banner{enabled}}} query B{shop{name}}'])assert.throws(()=>consentQuery({query}));
  assert.throws(()=>consentQuery({query:'{consentManagement{banner{enabled}}}',variables:{email:'secret'}}));
  assert.match(consentQuery({query:'query bannerQuery($isPreviewMode:Boolean=false){consentManagement{banner{enabled regionVisibility @include(if:$isPreviewMode)}}}',variables:{isPreviewMode:false}}),/@include\(if: false\)/);
  assert.deepEqual(parseVisitorConsent(undefined),{analytics:false,marketing:false,preferences:false,saleOfData:false});
});

test("official proxy forwards native cookies and GPC but no credentials or referrer; external fetch mocked",async t=>{
  let seen:RequestInit|undefined;
  t.mock.method(globalThis,"fetch",async(url:unknown,init:RequestInit)=>{
    assert.equal(String(url),'https://nr9zd0-t5.myshopify.com/api/unstable/graphql.json');seen=init;
    const body=await new Response(init.body).text();assert.doesNotMatch(body,/secret|email|landingPage|origReferrer/);
    return Response.json({data:{consentManagement:{banner:{enabled:true}}}},{headers:{'set-cookie':'_shopify_essential=opaque; Path=/; Secure; HttpOnly; SameSite=Lax'}});
  });
  const origin='https://www.iqondaily.com';
  const req=()=>new Request(origin+'/api/unstable/graphql.json',{method:'POST',headers:{Origin:origin,'content-type':'application/json','Sec-GPC':'1',
    'Shopify-Storefront-Consent-Management':'1',Cookie:'iqon_session=secret; _shopify_essential=opaque','Authorization':'Bearer secret','Referer':origin+'/account?email=secret'},
    body:JSON.stringify({query:'{consentManagement{cookies(visitorConsent:{marketing:false}){cookieDomain}}}'})});
  const result=await shopifyConsentProxy(req());assert.equal(result.status,200);
  assert.match(result.headers.get('set-cookie')||'',/_shopify_essential=opaque/);
  const headers=new Headers(seen!.headers);assert.equal(headers.get('cookie'),' _shopify_essential=opaque'.trim());
  assert.equal(headers.get('sec-gpc'),'1');assert.equal(headers.get('authorization'),null);assert.equal(headers.get('referer'),null);
  assert.equal(headers.get('Shopify-Storefront-Private-Token'),null);
  const wrong=req();wrong.headers.set('Origin','https://evil.invalid');assert.equal((await shopifyConsentProxy(wrong)).status,400);
});

test('native reads cannot persist stale consent; explicit native choices retain all provider headers',async t=>{
  const cookies=['_shopify_essential=opaque-old; Path=/; HttpOnly; Secure',
    '_shopify_cmp=opaque-cmp; Path=/; Secure','_tracking_consent=opaque-legacy; Path=/; Secure',
    '__cf_bm=provider-protection; Path=/; HttpOnly; Secure',
    '_shopify_analytics=provider-analytics; Path=/; HttpOnly; Secure'];
  t.mock.method(globalThis,'fetch',async()=>{
    const headers=new Headers();for(const cookie of cookies)headers.append('Set-Cookie',cookie);
    return Response.json({data:{consentManagement:{cookies:{cookieDomain:'www.iqondaily.com'}}}},{headers});
  });
  const origin='https://www.iqondaily.com';
  for(const prior of ['', '_shopify_essential=opaque-current'])for(const choice of ['','visitorConsent:{}','visitorConsent:{marketing:true,analytics:true,preferences:true}','visitorConsent:{marketing:false,analytics:false,preferences:false}']){
    const result=await shopifyConsentProxy(new Request(origin+'/api/unstable/graphql.json',{method:'POST',headers:{Origin:origin,'content-type':'application/json',Cookie:prior,'Shopify-Storefront-Consent-Management':'1'},body:JSON.stringify({query:`{consentManagement{cookies${choice?'('+choice+')':''}{cookieDomain}}}`})}));
    assert.equal(result.status,200);
    assert.deepEqual(result.headers.getSetCookie(),choice.includes('marketing:')?cookies:cookies.slice(3));
    assert.match(result.headers.get('cache-control')||'',/no-store/);
  }
});
