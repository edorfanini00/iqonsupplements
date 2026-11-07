// Offline upstream only: extend the existing synthetic catalog/cart server.
import '../seo/fake-shopify-hook.mjs';
import {parse,visit,valueFromASTUntyped} from 'graphql';
const previous=globalThis.fetch;
const banner={enabled:true,position:'BOTTOM_LEFT',policyLinkText:'Privacy policy',policyLinkUrl:'https://www.iqondaily.com/policies/privacy-policy',title:'Your privacy choices',text:'Synthetic settings rendered by the unmodified Shopify banner.',buttonPrefsOpenText:'Manage preferences',buttonAcceptText:'Accept all',buttonDeclineText:'Decline all',theme:{theme:'light',fontColor:'#202020',backgroundColor:'#ffffff',buttonFontColor:'#ffffff',buttonBackgroundColor:'#202020'},preferences:{title:'Cookie preferences',introTitle:'Your choices',introText:'Choose which purposes to allow.',buttonAcceptText:'Accept all',buttonDeclineText:'Decline all',buttonSaveText:'Save preferences',bulletPoints:{enabled:false,title:'',firstText:'',secondText:'',thirdText:''},purposes:{essentialName:'Essential',essentialDesc:'Required for shopping.',performanceName:'Analytics',performanceDesc:'Measure store performance.',preferencesName:'Preferences',preferencesDesc:'Remember preferences.',marketingName:'Marketing',marketingDesc:'Measure advertising.'}}};
globalThis.fetch=async(input,init)=>{
 const url=String(typeof input==='string'||input instanceof URL?input:input.url);
 if(/^https:\/\/[a-z0-9-]+\.myshopify\.com\/api\//.test(url)){
  const bodyText=init?.body?await new Response(init.body).text():'{}';
  init={...init,body:bodyText};
  const {query='',variables={}}=JSON.parse(bodyText);
  if(query.includes('consentManagement')){
   if(query.includes('banner'))return Response.json({data:{consentManagement:{banner}}});
   const headers=new Headers(init?.headers);
   let saved={};try{saved=JSON.parse(Buffer.from((headers.get('cookie')||'').match(/_shopify_essential=([^;]+)/)?.[1]||'','base64url').toString())}catch{}
   visit(parse(query),{Argument(node){if(node.name.value==='visitorConsent')saved={...saved,...valueFromASTUntyped(node.value)}}});
   const names={analytics:'a',marketing:'m',preferences:'p',saleOfData:'s'};const cmp={},purposes={};
   for(const [key,short] of Object.entries(names)){cmp[short]=saved[key]===true?'1':saved[key]===false?'0':'';purposes[short==='s'?'t':short]=short==='s'?saved[key]!==false&&headers.get('sec-gpc')!=='1':saved[key]===true;}
   const trackingConsentCookie=encodeURIComponent(JSON.stringify({v:'2.1',con:{CMP:cmp},purposes,display_banner:!Object.keys(saved).length,sale_of_data_region:true,region:'USCA'}));
   return Response.json({data:{consentManagement:{cookies:{trackingConsentCookie,cookieDomain:'www.iqondaily.com',landingPageCookie:null,origReferrerCookie:null,shopifyUnique:null,shopifyVisit:null},customerAccountUrl:null}}},{headers:{'set-cookie':`_shopify_essential=${Buffer.from(JSON.stringify(saved)).toString('base64url')}; Path=/; Secure; HttpOnly; SameSite=Lax`}});
  }
  if(query.includes('IQONCheckoutConsent')){
   const response=await previous(input,{...init,body:JSON.stringify({query:query.replace('IQONCheckoutConsent','IQONCartRead'),variables})});
   const body=await response.json();
   if(body.data?.cart)body.data.cart.checkoutUrl=`https://nr9zd0-t5.myshopify.com/checkouts/offline-only?key=synthetic&_cs=${encodeURIComponent(JSON.stringify(variables.visitorConsent))}`;
   return Response.json(body);
  }
 }
 return previous(input,init);
};
