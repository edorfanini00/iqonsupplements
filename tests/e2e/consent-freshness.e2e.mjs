// Every browser request is intercepted; every server Shopify request is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const root=fileURLToPath(new URL('../..',import.meta.url));
const source='https://www.iqondaily.com',destination='https://nr9zd0-t5.myshopify.com';
const port=Number(process.env.E2E_PORT||3987),local=`http://127.0.0.1:${port}`;
const output=process.env.E2E_SCREENSHOTS||'/tmp/iqon-google-attribution';fs.mkdirSync(output,{recursive:true});
const fixture=name=>gunzipSync(fs.readFileSync(path.join(root,'tests/fixtures/google-attribution',name+'.js.gz'))).toString();
const scripts=new Map([
 ['https://www.googletagmanager.com/gtag/js',fixture('google-tag')],
 ['https://cdn.shopify.com/shopifycloud/privacy-banner/storefront-banner.js',fixture('native-banner')],
 ['https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.2/consent-tracking-api.js',fixture('native-consent')],
 ['https://cdn.shopify.com/storefront/standard-events.js',fixture('standard-events')],
 ['https://cdn.shopify.com/storefront/standard-actions.js',fixture('standard-actions')],
]);
try{await fetch(local);throw Error('Test port already occupied')}catch(e){if(e.message.includes('occupied'))throw e}
const log=fs.openSync(path.join(output,'server.log'),'w');
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',String(port)],{cwd:root,stdio:['ignore',log,log],env:{...process.env,NODE_ENV:'production',VERCEL_ENV:'production',FAKE_SHOPIFY:'live',FAKE_CATALOG:'purchase-clarity',FAKE_POLICIES:'',SHOPIFY_STORE_DOMAIN:'iqon-test.myshopify.com',SHOPIFY_STOREFRONT_PRIVATE_TOKEN:'test-token',NODE_OPTIONS:`--import ${pathToFileURL(path.join(root,'tests/e2e/attribution-shopify-hook.mjs'))}`}});
process.on('exit',()=>server.kill('SIGTERM'));
for(let i=0;;i++){try{if((await fetch(local)).status)break}catch{}if(i===60)throw Error('Preview failed');await new Promise(r=>setTimeout(r,500));}
const executablePath=process.env.CHROME_PATH||(fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
const browser=await chromium.launch({executablePath});
test.after(async()=>{await browser.close();server.kill('SIGTERM')});
const clickId='SYNTHETIC_OFFLINE_ONLY_0123456789abcdefghijklmnopqrstuvwxyz';
async function open({gpc=false,consentFailure=false,tagFailure=false,metaRecorder=false,holdMeta,holdGoogle,holdCheckout,holdCart,holdNative,noChannel=false,viewport={width:390,height:844}}={}){
 const context=await browser.newContext({serviceWorkers:'block',viewport});const requests=[],errors=[],metaCalls=[];
 let closing=false;const pending=new Set(),closeContext=context.close.bind(context);
 context.close=async()=>{
  closing=true;
  // Keep interception installed; abort pending browser requests before closing.
  await Promise.all([...pending].map(route=>route.abort().catch(()=>{})));
  await closeContext();
 };
 if(noChannel)await context.addInitScript(()=>Object.defineProperty(window,'BroadcastChannel',{value:undefined}));
 if(metaRecorder)await context.exposeFunction('__recordMeta',(...args)=>metaCalls.push(args));
 if(gpc)await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
 await context.route('**/*',async route=>{
  pending.add(route);try{
  const r=route.request(),u=new URL(r.url());requests.push({url:r.url(),method:r.method(),body:r.postData(),headers:await r.allHeaders()});
  if(metaRecorder&&u.hostname==='connect.facebook.net'){
   if(holdMeta&&!holdMeta.used){holdMeta.used=true;holdMeta.notify();await holdMeta.released;}
   return route.fulfill({contentType:'text/javascript',body:"window.fbq.callMethod=(...args)=>window.__recordMeta(...args);window.fbq.queue.splice(0).forEach(args=>window.fbq.callMethod(...args));"}).catch(()=>{});
  }
  if(tagFailure&&u.hostname==='www.googletagmanager.com')return route.abort();
  if(holdGoogle&&u.hostname==='www.googletagmanager.com'&&!holdGoogle.used){holdGoogle.used=true;holdGoogle.notify();await holdGoogle.released;}
  const script=scripts.get(u.origin+u.pathname);if(script)return route.fulfill({body:script,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  if(u.origin===source){
   if(consentFailure&&u.pathname==='/api/unstable/graphql.json')return route.fulfill({status:503,body:'unavailable'});
   const headers={...await r.allHeaders(),host:`127.0.0.1:${port}`,'x-forwarded-proto':'http'};
   // Translate only the isolated loopback transport origin; browser URLs stay canonical.
   if(headers.origin===source)headers.origin=`http://localhost:${port}`;
   if(gpc)headers['sec-gpc']='1';
   const response=await route.fetch({url:local+u.pathname+u.search,headers,maxRedirects:0,timeout:5000});if(holdCheckout&&u.pathname==='/api/checkout'&&!holdCheckout.used){holdCheckout.used=true;holdCheckout.notify(await response.json());await holdCheckout.released;}
   if(holdCart&&u.pathname==='/api/cart'&&r.method()==='POST'&&!holdCart.used){holdCart.used=true;holdCart.notify(await response.json());await holdCart.released;}
   if(holdNative?.enabled&&!holdNative.used&&u.pathname==='/api/unstable/graphql.json'&&r.frame().page()===holdNative.page&&!r.postData()?.includes('banner')){holdNative.used=true;holdNative.notify(await response.json());await holdNative.released;}
   return route.fulfill({response}).catch(()=>{});
  }
  if(u.origin===destination&&r.isNavigationRequest()){
   const consent=JSON.parse(u.searchParams.get('_cs')||'{}');
   const setup=`window.subscriptions={};self.webPixelsManager={createShopifyExtend:()=>({extend:(name,callback)=>callback({settings:{config:JSON.stringify({google_tag_ids:['AW-18501766604'],gtag_events:[{type:'purchase',action_label:'AW-18501766604/Ig36CKDCy6MdEMybqvZE'}]})},init:{customerPrivacy:{marketingAllowed:${consent.marketing===true},analyticsProcessingAllowed:${consent.analytics===true},saleOfDataAllowed:${consent.saleOfData===true}},data:{shop:{myshopifyDomain:'nr9zd0-t5.myshopify.com'}}},_pixelInfo:{surfaceNext:'checkout'},analytics:{subscribe:(name,fn)=>subscriptions[name]=fn},customerPrivacy:{subscribe:()=>{}}})})};`;
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Offline checkout</title><body><script>${setup}</script><script>${fixture('native-pixel')}</script>`});
  }
  return await route.abort();
  }catch(error){if(!closing)throw error;}finally{pending.delete(route);} // Teardown cancellation only.
 });
 context.setDefaultTimeout(10000);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {page,context,requests,errors,metaCalls};
}
const tagRequests=requests=>requests.filter(r=>r.url.startsWith('https://www.googletagmanager.com/gtag/js'));
const googleRequests=requests=>requests.filter(r=>/google|doubleclick/.test(new URL(r.url).hostname));
async function nativeReady(page){await page.waitForFunction(()=>window.Shopify?.customerPrivacy?.consentStatus==='loaded');}

async function grant(page){await nativeReady(page);await page.getByRole('button',{name:'Accept all',exact:true}).first().click();await page.waitForFunction(()=>Shopify.customerPrivacy.marketingAllowed());}
test('independent cross-tab native withdrawal must deny resumed page and checkout',{timeout:30000},async()=>{
 const {page,context,metaCalls}=await open({metaRecorder:true});
 try {
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  const second=await context.newPage();await second.goto(source+'/products/gut-health');await nativeReady(second);
  assert.equal(await second.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),true);
  await second.getByRole('link',{name:'Cookie preferences',exact:true}).click();
  await second.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await second.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed());
  await page.bringToFront();await resume(page);await page.waitForTimeout(500);
  const resumed=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),sale:Shopify.customerPrivacy.saleOfDataAllowed(),status:Shopify.customerPrivacy.consentStatus,google:typeof gtag,meta:typeof fbq}));
  await page.locator('.add-to-bag-row .button:enabled').click();
  const link=page.getByRole('link',{name:/Secure checkout/i});await link.waitFor();
  const prepared=JSON.parse(new URL(await link.getAttribute('href')).searchParams.get('_cs'));
  const beforeClick=metaCalls.length;
  await link.click();await page.waitForURL(destination+'/**');
  const checkoutConsent=JSON.parse(new URL(page.url()).searchParams.get('_cs'));
  const result={withdrawnInSecondTab:true,resumed,prepared,checkoutConsent,metaCalls,beforeClick};
  fs.writeFileSync(path.join(output,'cross-tab.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({resumed,prepared}));
  assert.equal(resumed.marketing,false,'resumed first tab still grants marketing after native Decline in second tab');
  assert.equal(prepared.marketing,false);
  assert.equal(checkoutConsent.marketing,false);
  assert.equal(resumed.google,'undefined');assert.equal(resumed.meta,'undefined');
  assert.equal(metaCalls.filter(call=>call[2]==='AddToCart').length,0);
 }finally{await context.close()}
});
test('independent attribution storage lifecycle after native withdrawal',{timeout:30000},async()=>{
 const {page,context}=await open();try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  await page.waitForTimeout(500);
  await page.evaluate(()=>localStorage.setItem('unrelated-shopping-state','keep'));
  const before=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await page.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed()&&typeof gtag==='undefined');
  const after=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Accept all',exact:true}).first().click();
  await page.waitForTimeout(700);const cookies=await context.cookies(source);
  fs.writeFileSync(path.join(output,'storage-lifecycle.json'),JSON.stringify({before,after,cookies},null,2));
  assert.ok(JSON.stringify(before).includes(clickId),'real Google runtime stored the synthetic identifier');
  assert.ok(!JSON.stringify(after).includes(clickId),'withdrawal retains original click ID in browser storage');
  assert.equal(after._gcl_ls,undefined);assert.equal(after['unrelated-shopping-state'],'keep');
  assert.ok(!cookies.some(c=>c.name==='_gcl_aw'&&c.value.includes(clickId)));
  assert.ok(!(await page.evaluate(()=>localStorage.getItem('_gcl_ls')))?.includes(clickId));
 }finally{await context.close()}
});
async function resumeDocument(page,kind='focus'){
 try{await page.evaluate(kind=>window.dispatchEvent(kind==='focus'?new Event('focus'):new PageTransitionEvent('pageshow',{persisted:true})),kind);}
 catch(error){if(!/Execution context was destroyed|Cannot find context with specified id/.test(error.message))throw error;}
 // Reload is the expected repair; assertions below still require native denial.
 await page.waitForLoadState('domcontentloaded');
}
const resume=page=>resumeDocument(page);
function gate(){const result={};result.arrived=new Promise(resolve=>result.notify=resolve);result.released=new Promise(resolve=>result.release=resolve);return result;}
async function withdraw(page){
 await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();
 await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
 await page.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed());
}
async function deniedCheckout(page,suspended=false,existingBag=false){
 if(!existingBag)await page.locator('.add-to-bag-row .button:enabled').click();
 const link=page.getByRole('link',{name:/Secure checkout/i});
 try{await link.waitFor();}catch(error){fs.writeFileSync(path.join(output,'missing-link.txt'),await page.locator('body').innerText());throw error;}
 const consent=JSON.parse(new URL(await link.getAttribute('href')).searchParams.get('_cs'));
 assert.equal(consent.marketing,false);assert.equal(consent.analytics,false);assert.equal(consent.preferences,false);
 // Native Decline all does not opt out of sale in this real SDK contract.
 // Once fresh, preserve that native value; unknown/invalidated stays all denied.
 assert.equal(consent.saleOfData,suspended?false:await page.evaluate(()=>Shopify?.customerPrivacy?.consentStatus==='loaded'&&Shopify.customerPrivacy.saleOfDataAllowed()));
 return consent;
}
for(const resume of ['focus','pageshow'])test(`missed peer message: ${resume} refreshes native state and preserves cart availability`,{timeout:30000},async()=>{
 const {page,context,metaCalls}=await open({noChannel:true,metaRecorder:true});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  await page.locator('.add-to-bag-row .button:enabled').click();await page.getByRole('link',{name:/Secure checkout/i}).waitFor();
  const peer=await context.newPage();await peer.goto(source+'/products/gut-health');await nativeReady(peer);await withdraw(peer);
  const before=metaCalls.length;
  // Do not rely on Chromium headless actually suspending/backgrounding the tab.
  const resumed=page.waitForEvent('domcontentloaded');
  await resumeDocument(page,resume);
  await resumed;await nativeReady(page);
  assert.equal(await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),false);
  const consent=await deniedCheckout(page,false,true);assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[]);
  await page.getByRole('link',{name:/Secure checkout/i}).click();await page.waitForURL(destination+'/**');
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('_cs')).marketing,false);
  fs.writeFileSync(path.join(output,`missed-${resume}.json`),JSON.stringify({consent,metaCalls},null,2));
 }finally{await context.close()}
});
test('peer withdrawal invalidates a delayed native grant response before it can restore permission',{timeout:30000},async()=>{
 const held=gate();const {page:peer,context,requests,metaCalls}=await open({metaRecorder:true,holdNative:held});try{
  await peer.goto(source+'/products/gut-health');await grant(peer);
  const page=await context.newPage();held.page=page;held.enabled=true;
  // Hold the unmodified native SDK's initial granted backend response in tab A.
  await page.goto(source+'/products/creatine-monohydrate');const oldResponse=await held.arrived;
  assert.ok(JSON.stringify(oldResponse).includes('trackingConsentCookie'));
  const before=metaCalls.length;const navigated=page.waitForEvent('domcontentloaded');
  await withdraw(peer);await navigated;await nativeReady(page);
  held.release();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),false);
  assert.equal(await page.evaluate(()=>typeof gtag),'undefined');assert.equal(await page.evaluate(()=>typeof fbq),'undefined');
  const consent=await deniedCheckout(page);assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[]);
  assert.equal(tagRequests(requests).length,0);
  await page.reload();await nativeReady(page);
  assert.equal(await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),false,'late response cannot restore the native cookie for a subsequent document');
  fs.writeFileSync(path.join(output,'late-native-response.json'),JSON.stringify({oldResponse,consent,metaCalls},null,2));
 }finally{held.release();await context.close()}
});
test('peer withdrawal disposes delayed Meta grants and delayed checkout response',{timeout:30000},async()=>{
 const vendor=gate(),checkout=gate();const {page,context,metaCalls}=await open({metaRecorder:true,holdMeta:vendor,holdCheckout:checkout});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await vendor.arrived;
  await page.locator('.add-to-bag-row .button:enabled').click();const stale=await checkout.arrived;
  assert.equal(JSON.parse(new URL(stale.checkoutUrl).searchParams.get('_cs')).marketing,true);
  const peer=await context.newPage();await peer.goto(source+'/products/gut-health');await nativeReady(peer);
  const navigated=page.waitForEvent('domcontentloaded');await withdraw(peer);await navigated;await nativeReady(page);
  const before=metaCalls.length;vendor.release();checkout.release();await page.waitForTimeout(200);
  const consent=await deniedCheckout(page,false,true);assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[],'old vendor queue and old checkout cannot resume');
  assert.equal(await page.evaluate(()=>typeof fbq),'undefined');
  fs.writeFileSync(path.join(output,'late-peer-vendor-checkout.json'),JSON.stringify({stale,consent,metaCalls},null,2));
 }finally{vendor.release();checkout.release();await context.close()}
});
test('native refresh failure after missed withdrawal keeps cart and checkout denied',{timeout:30000},async()=>{
 const {page,context,requests,metaCalls}=await open({noChannel:true,metaRecorder:true});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  const peer=await context.newPage();await peer.goto(source+'/products/gut-health');await nativeReady(peer);await withdraw(peer);
  await page.route('**/api/unstable/graphql.json',route=>route.fulfill({status:503,body:'offline refresh failure'}));
  const before=metaCalls.length,googleBefore=tagRequests(requests).length,navigated=page.waitForEvent('domcontentloaded');
  await resume(page);await navigated;
  const consent=await deniedCheckout(page);assert.equal(consent.saleOfData,false);assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[]);assert.equal(tagRequests(requests).length,googleBefore);
  assert.equal(await page.evaluate(()=>typeof fbq),'undefined');
  fs.writeFileSync(path.join(output,'refresh-failure.json'),JSON.stringify({consent},null,2));
 }finally{await context.close()}
});
test('suspended document denies old native cache and removes prepared href synchronously',{timeout:30000},async()=>{
 const {page,context,metaCalls}=await open({noChannel:true,metaRecorder:true});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  await page.locator('.add-to-bag-row .button:enabled').click();await page.getByRole('link',{name:/Secure checkout/i}).waitFor();await page.waitForTimeout(100);
  const before=metaCalls.length;
  const immediate=await page.evaluate(()=>{
   const anchor=document.querySelector('.bag-sheet a.button');
   window.dispatchEvent(new Event('blur'));
   return {href:anchor?.getAttribute('href'),oldNativeGrant:Shopify.customerPrivacy.marketingAllowed()};
  });
  assert.equal(immediate.href,null);assert.equal(immediate.oldNativeGrant,true,'real SDK still has the stale per-document grant');
  // Late native events cannot bless that invalidated cache again.
  await page.evaluate(()=>document.dispatchEvent(new Event('consentTrackingApiLoaded')));
  const pending=page.getByRole('link',{name:/Secure checkout/i});await pending.waitFor();
  assert.deepEqual(JSON.parse(new URL(await pending.getAttribute('href')).searchParams.get('_cs')),{analytics:false,marketing:false,preferences:false,saleOfData:false});
  await page.locator('.bag-sheet .cart-line').getByRole('button',{name:/Increase/}).first().click();
  const consent=await deniedCheckout(page,true,true);assert.equal(consent.saleOfData,false);
  assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[]);
  fs.writeFileSync(path.join(output,'suspended-document.json'),JSON.stringify({immediate,consent,metaCalls},null,2));
 }finally{await context.close()}
});
test('peer withdrawal cannot replay Google configuration through a delayed vendor loader',{timeout:30000},async()=>{
 const held=gate();const {page,context,requests}=await open({holdGoogle:held});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await held.arrived;
  const peer=await context.newPage();await peer.goto(source+'/products/gut-health');await nativeReady(peer);
  const navigated=page.waitForEvent('domcontentloaded');await withdraw(peer);await navigated;await nativeReady(page);
  const before=googleRequests(requests).length;held.release();await page.waitForTimeout(200);
  await deniedCheckout(page);assert.equal(googleRequests(requests).length,before);
  assert.equal(await page.evaluate(()=>typeof gtag),'undefined');
  fs.writeFileSync(path.join(output,'late-google-loader.json'),JSON.stringify({requests:googleRequests(requests)},null,2));
 }finally{held.release();await context.close()}
});
for(const gpc of [false,true])test(`initial ${gpc?'GPC':'native denial'} removes only attribution storage`,{timeout:30000},async()=>{
 const {page,context}=await open({gpc});try{
  await context.addInitScript(()=>{localStorage.setItem('_gcl_ls','SYNTHETIC_RETAINED_ID');localStorage.setItem('unrelated-shopping-state','keep')});
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);
  await page.waitForFunction(()=>localStorage.getItem('_gcl_ls')===null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-shopping-state')),'keep');
  assert.equal(await page.evaluate(()=>typeof gtag),'undefined');
 }finally{await context.close()}
});
test('cart mutation committed before refresh remains available; delayed response cannot replay Meta',{timeout:30000},async()=>{
 const held=gate();const {page,context,metaCalls}=await open({metaRecorder:true,holdCart:held});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  await page.evaluate(()=>document.addEventListener('iqon:native-consent-invalidated',()=>window.__observedInvalidation=true));
  await page.locator('.add-to-bag-row .button:enabled').click();const committed=await held.arrived;
  assert.equal(committed.items[0].quantity,1);
  const peer=await context.newPage();await peer.goto(source+'/products/gut-health');await nativeReady(peer);
  const navigated=page.waitForEvent('domcontentloaded');await withdraw(peer);
  // While the essential cart response is pending, the document stays alive
  // but the freshness barrier must deny trackers and remove checkout hrefs.
  await page.waitForFunction(()=>window.__observedInvalidation===true);
  assert.equal(await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),true,'old native cache is still present while cart settles');
  assert.equal(await page.getByRole('link',{name:/Secure checkout/i}).count(),0);
  const before=metaCalls.length;held.release();await navigated;await nativeReady(page);
  await page.locator('.bag-sheet .cart-line').waitFor();
  const link=page.getByRole('link',{name:/Secure checkout/i});await link.waitFor();
  const consent=JSON.parse(new URL(await link.getAttribute('href')).searchParams.get('_cs'));
  assert.equal(consent.marketing,false);
  assert.equal(await page.locator('.bag-sheet .cart-line .quantity span').textContent(),'1');
  assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[]);
  assert.equal(metaCalls.filter(c=>c[2]==='AddToCart').length,0);
  fs.writeFileSync(path.join(output,'late-cart-response.json'),JSON.stringify({committed,consent,metaCalls},null,2));
 }finally{held.release();await context.close()}
});
for(const form of [
 {path:'/account/profile',selector:'input[autocomplete="given-name"]'},
 {path:'/affiliates/contact',selector:'textarea[name="message"]'},
 {path:'/affiliates/login',selector:'input[type="email"]'},
])test(`protected form ${form.path} survives blur/focus and peer withdrawal; refresh waits for shopping`,{timeout:30000},async()=>{
 const {page,context,requests,metaCalls}=await open({metaRecorder:true});try{
  // Synthetic account view models only; no auth provider, database or mutation.
  await page.route('**/api/account/session',route=>route.fulfill({json:{status:'signed_in',csrf:'offline-only',firstName:'Synthetic',email:null,hostedAccountUrl:destination,subscriptionManagementUrl:null}}));
  await page.route('**/api/account/profile',route=>route.fulfill({json:{firstName:'Synthetic',lastName:'Fixture',displayName:'Synthetic Fixture',email:null,phone:null}}));
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  await page.locator('.add-to-bag-row .button:enabled').click();await page.getByRole('link',{name:/Secure checkout/i}).waitFor();
  await page.goto(source+form.path);await nativeReady(page);
  const input=page.locator(form.selector);await input.fill('SYNTHETIC_FORM_VALUE');
  await page.evaluate(()=>window.__sameFormDocument=true);
  const peer=await context.newPage();await peer.goto(source+'/products/gut-health');await nativeReady(peer);await withdraw(peer);
  const before=metaCalls.length,googleBefore=googleRequests(requests).length;
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__sameFormDocument),true,'ordinary resume must preserve this form document');
  assert.equal(await input.inputValue(),'SYNTHETIC_FORM_VALUE');
  assert.equal(await page.evaluate(()=>typeof fbq),'undefined');assert.equal(await page.evaluate(()=>typeof gtag),'undefined');
  assert.deepEqual(metaCalls.slice(before).filter(c=>c[0]!=='consent'||c[1]!=='revoke'),[]);
  assert.equal(googleRequests(requests).length,googleBefore);
  assert.equal(await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),true,'protected document keeps the stale SDK cache, never its permission');
  await page.getByRole('button',{name:/Open shopping bag/}).click();
  const checkout=page.getByRole('link',{name:/Secure checkout/i});await checkout.waitFor();
  assert.deepEqual(JSON.parse(new URL(await checkout.getAttribute('href')).searchParams.get('_cs')),{analytics:false,marketing:false,preferences:false,saleOfData:false});
  await page.keyboard.press('Escape');await page.locator('.bag-sheet').waitFor({state:'hidden'});
  assert.equal(await input.inputValue(),'SYNTHETIC_FORM_VALUE');
  assert.ok(!JSON.stringify(requests).includes('SYNTHETIC_FORM_VALUE'),'typed test data was never transmitted');
  // Real SPA navigation is the safe refresh boundary; no tracking while stale.
  await page.getByRole('link',{name:'IQON home',exact:true}).first().click();await page.waitForURL(source+'/');
  await page.waitForFunction(()=>!window.__sameFormDocument&&Shopify.customerPrivacy?.consentStatus==='loaded');
  assert.equal(await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed()),false);
  assert.equal(await page.evaluate(()=>typeof fbq),'undefined');
  fs.writeFileSync(path.join(output,`form-${form.path.replaceAll('/','-')}.json`),JSON.stringify({form:form.path,preserved:true,refreshedAtShoppingBoundary:true,typedDataTransmitted:false},null,2));
 }finally{await context.close()}
});
