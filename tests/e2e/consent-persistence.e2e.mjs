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
async function open({gpc=false,consentFailure=false,tagFailure=false,metaRecorder=false,holdMeta,holdGoogle,holdCheckout,holdCart,holdNative,holdChoice,noChannel=false,viewport={width:390,height:844}}={}){
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
   if(holdChoice&&!holdChoice.used&&u.pathname==='/api/unstable/graphql.json'&&/marketing\s*:\s*false/.test(r.postData()||'')){holdChoice.used=true;holdChoice.notify();await holdChoice.released;}
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

function gate(){const result={};result.arrived=new Promise(resolve=>result.notify=resolve);result.released=new Promise(resolve=>result.release=resolve);return result;}
test('protected form late native response must not restore grant at next shopping boundary',{timeout:30000},async()=>{
 const held=gate();const {page:peer,context,requests,metaCalls}=await open({holdNative:held,metaRecorder:true});
 try{
  await peer.goto(source+'/products/gut-health');await grant(peer);
  const page=await context.newPage();held.page=page;held.enabled=true;
  await page.route('**/api/account/session',route=>route.fulfill({json:{status:'signed_in',csrf:'offline-only',firstName:'Synthetic',email:null,hostedAccountUrl:destination,subscriptionManagementUrl:null}}));
  await page.route('**/api/account/profile',route=>route.fulfill({json:{firstName:'Synthetic',lastName:'Fixture',displayName:'Synthetic Fixture',email:null,phone:null}}));
  await page.goto(source+'/account/profile');const oldResponse=await held.arrived;
  const input=page.locator('input[autocomplete="given-name"]');await input.fill('SYNTHETIC_REVIEW_FORM');
  await page.evaluate(()=>{window.__sameDocument=true;document.addEventListener('iqon:native-consent-invalidated',()=>window.__invalidated=true)});
  await peer.getByRole('link',{name:'Cookie preferences',exact:true}).click();await peer.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await peer.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed());
  await page.waitForFunction(()=>window.__invalidated===true);
  const cookiesDenied=await context.cookies(source);const afterDenial=metaCalls.length;held.release();await nativeReady(page);await page.waitForTimeout(200);const cookiesAfterLate=await context.cookies(source);
  assert.equal(await input.inputValue(),'SYNTHETIC_REVIEW_FORM');assert.equal(await page.evaluate(()=>window.__sameDocument),true);
  const stale=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.getByRole('link',{name:'IQON home',exact:true}).first().click();await page.waitForURL(source+'/');
  await page.waitForFunction(()=>!window.__sameDocument&&window.Shopify?.customerPrivacy?.consentStatus==='loaded');
  const fresh=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),sale:Shopify.customerPrivacy.saleOfDataAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);
  await page.locator('.add-to-bag-row .button:enabled').click();const checkout=page.getByRole('link',{name:/Secure checkout/i});await checkout.waitFor();
  const prepared=JSON.parse(new URL(await checkout.getAttribute('href')).searchParams.get('_cs'));
  fs.writeFileSync(path.join(output,'protected-late-native.json'),JSON.stringify({oldResponse,stale,fresh,prepared,cookiesDenied,cookiesAfterLate,metaCalls,allRequestsIntercepted:true},null,2));console.log(JSON.stringify({stale,fresh}));
  assert.equal(fresh.marketing,false,'old response must not persist a grant past the freshness reload');
  assert.deepEqual(cookiesAfterLate.filter(c=>c.name==='_shopify_essential'),cookiesDenied.filter(c=>c.name==='_shopify_essential'),'late read cannot replace the refused native cookie');
  assert.equal(prepared.marketing,false);assert.equal(prepared.analytics,false);assert.equal(prepared.preferences,false);
  assert.equal(metaCalls.slice(afterDenial).filter(c=>c[0]==='trackSingle'||c[0]==='init'||(c[0]==='consent'&&c[1]==='grant')).length,0);
  assert.equal(fresh.meta,'undefined');
 }finally{held.release();await context.close()}
});

test('granted returning shopper retains Meta attribution cookies across ordinary blur/focus',{timeout:30000},async()=>{
 const {page,context,metaCalls}=await open({metaRecorder:true});try{
  await page.goto(source+'/products/creatine-monohydrate');await grant(page);await page.waitForFunction(()=>!!window.fbq?.callMethod);
  await page.evaluate(()=>{document.cookie='_fbc=fb.1.1794090000000.SYNTHETIC_OFFLINE_META_CLICK; Path=/; Secure; SameSite=Lax';document.cookie='_fbp=fb.1.1794090000000.123456789; Path=/; Secure; SameSite=Lax';});
  const before=(await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name));
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const afterBlur=(await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name));
  try{await page.evaluate(()=>window.dispatchEvent(new Event('focus')));}catch(e){if(!/Execution context was destroyed|Cannot find context/.test(e.message))throw e;}
  await page.waitForTimeout(500);await nativeReady(page);await page.waitForFunction(()=>!!window.fbq?.callMethod);
  const granted=await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed());
  const afterFocus=(await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name));
  fs.writeFileSync(path.join(output,'returning-meta-cookies.json'),JSON.stringify({before,afterBlur,afterFocus,granted,metaCalls,actualMetaVendor:false,networkIntercepted:true},null,2));
  assert.equal(granted,true);assert.equal(before.length,2);
  assert.deepEqual(afterBlur,before);assert.deepEqual(afterFocus,before);
  assert.ok(afterFocus.some(c=>c.name==='_fbc'&&c.value.includes('SYNTHETIC_OFFLINE_META_CLICK')),'ordinary focus with unchanged native grant must preserve the previous Meta click');
 }finally{await context.close()}
});

test('ordinary full product navigation preserves granted Meta click cookie',{timeout:30000},async()=>{
 const {page,context}=await open({metaRecorder:true});try{
  await page.goto(source+'/products/creatine-monohydrate');await grant(page);await page.waitForFunction(()=>!!window.fbq?.callMethod);
  await page.evaluate(()=>{document.cookie='_fbc=fb.1.1794090000000.SYNTHETIC_OFFLINE_META_CLICK; Path=/; Secure; SameSite=Lax';document.cookie='_fbp=fb.1.1794090000000.123456789; Path=/; Secure; SameSite=Lax';});
  const before=(await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name));
  await page.goto(source+'/products/gut-health');await nativeReady(page);await page.waitForFunction(()=>!!window.fbq?.callMethod);
  const granted=await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed());
  const after=(await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name));
  fs.writeFileSync(path.join(output,'navigating-meta-cookies.json'),JSON.stringify({before,after,granted,actualMetaVendor:false,networkIntercepted:true},null,2));
  assert.equal(granted,true);assert.equal(before.length,2);
  assert.deepEqual(after,before);
  assert.ok(after.some(c=>c.name==='_fbc'&&c.value.includes('SYNTHETIC_OFFLINE_META_CLICK')),'ordinary product navigation with unchanged native grant must preserve the previous Meta click');
 }finally{await context.close()}
});

test('old read completes before peer refusal',{timeout:30000},async()=>{
 const held=gate();const {page:peer,context,requests,metaCalls}=await open({holdNative:held,metaRecorder:true});
 try{
  await peer.goto(source+'/products/gut-health');await grant(peer);
  const page=await context.newPage();held.page=page;held.enabled=true;
  await page.route('**/api/account/session',route=>route.fulfill({json:{status:'signed_in',csrf:'offline-only',firstName:'Synthetic',email:null,hostedAccountUrl:destination,subscriptionManagementUrl:null}}));
  await page.route('**/api/account/profile',route=>route.fulfill({json:{firstName:'Synthetic',lastName:'Fixture',displayName:'Synthetic Fixture',email:null,phone:null}}));
  await page.goto(source+'/account/profile');const oldResponse=await held.arrived;
  const input=page.locator('input[autocomplete="given-name"]');await input.fill('SYNTHETIC_REVIEW_FORM');
  await page.evaluate(()=>{window.__sameDocument=true;document.addEventListener('iqon:native-consent-invalidated',()=>window.__invalidated=true)});
  held.release();await nativeReady(page);
  await peer.getByRole('link',{name:'Cookie preferences',exact:true}).click();await peer.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await peer.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed());
  await page.waitForFunction(()=>window.__invalidated===true);
  const cookiesDenied=await context.cookies(source);const afterDenial=metaCalls.length;held.release();await nativeReady(page);await page.waitForTimeout(200);const cookiesAfterLate=await context.cookies(source);
  assert.equal(await input.inputValue(),'SYNTHETIC_REVIEW_FORM');assert.equal(await page.evaluate(()=>window.__sameDocument),true);
  const stale=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.getByRole('link',{name:'IQON home',exact:true}).first().click();await page.waitForURL(source+'/');
  await page.waitForFunction(()=>!window.__sameDocument&&window.Shopify?.customerPrivacy?.consentStatus==='loaded');
  const fresh=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),sale:Shopify.customerPrivacy.saleOfDataAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);
  await page.locator('.add-to-bag-row .button:enabled').click();const checkout=page.getByRole('link',{name:/Secure checkout/i});await checkout.waitFor();
  const prepared=JSON.parse(new URL(await checkout.getAttribute('href')).searchParams.get('_cs'));
  fs.writeFileSync(path.join(output,'before-refusal.json'),JSON.stringify({oldResponse,stale,fresh,prepared,cookiesDenied,cookiesAfterLate,metaCalls,allRequestsIntercepted:true},null,2));console.log(JSON.stringify({stale,fresh}));
  assert.equal(fresh.marketing,false,'old response must not persist a grant past the freshness reload');
  assert.deepEqual(cookiesAfterLate.filter(c=>c.name==='_shopify_essential'),cookiesDenied.filter(c=>c.name==='_shopify_essential'),'late read cannot replace the refused native cookie');
  assert.equal(prepared.marketing,false);assert.equal(prepared.analytics,false);assert.equal(prepared.preferences,false);
  assert.equal(metaCalls.slice(afterDenial).filter(c=>c[0]==='trackSingle'||c[0]==='init'||(c[0]==='consent'&&c[1]==='grant')).length,0);
  assert.equal(fresh.meta,'undefined');
 }finally{held.release();await context.close()}
});


test('old read releases with peer refusal response',{timeout:30000},async()=>{
 const held=gate(),choice=gate();const {page:peer,context,requests,metaCalls}=await open({holdNative:held,holdChoice:choice,metaRecorder:true});
 try{
  await peer.goto(source+'/products/gut-health');await grant(peer);
  const page=await context.newPage();held.page=page;held.enabled=true;
  await page.route('**/api/account/session',route=>route.fulfill({json:{status:'signed_in',csrf:'offline-only',firstName:'Synthetic',email:null,hostedAccountUrl:destination,subscriptionManagementUrl:null}}));
  await page.route('**/api/account/profile',route=>route.fulfill({json:{firstName:'Synthetic',lastName:'Fixture',displayName:'Synthetic Fixture',email:null,phone:null}}));
  await page.goto(source+'/account/profile');const oldResponse=await held.arrived;
  const input=page.locator('input[autocomplete="given-name"]');await input.fill('SYNTHETIC_REVIEW_FORM');
  await page.evaluate(()=>{window.__sameDocument=true;document.addEventListener('iqon:native-consent-invalidated',()=>window.__invalidated=true)});
  await peer.getByRole('link',{name:'Cookie preferences',exact:true}).click();await peer.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await choice.arrived;held.release();await nativeReady(page);choice.release();
  await peer.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed());
  await page.waitForFunction(()=>window.__invalidated===true);
  const cookiesDenied=await context.cookies(source);const afterDenial=metaCalls.length;held.release();await nativeReady(page);await page.waitForTimeout(200);const cookiesAfterLate=await context.cookies(source);
  assert.equal(await input.inputValue(),'SYNTHETIC_REVIEW_FORM');assert.equal(await page.evaluate(()=>window.__sameDocument),true);
  const stale=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.getByRole('link',{name:'IQON home',exact:true}).first().click();await page.waitForURL(source+'/');
  await page.waitForFunction(()=>!window.__sameDocument&&window.Shopify?.customerPrivacy?.consentStatus==='loaded');
  const fresh=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),sale:Shopify.customerPrivacy.saleOfDataAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);
  await page.locator('.add-to-bag-row .button:enabled').click();const checkout=page.getByRole('link',{name:/Secure checkout/i});await checkout.waitFor();
  const prepared=JSON.parse(new URL(await checkout.getAttribute('href')).searchParams.get('_cs'));
  fs.writeFileSync(path.join(output,'completing-refusal.json'),JSON.stringify({oldResponse,stale,fresh,prepared,cookiesDenied,cookiesAfterLate,metaCalls,allRequestsIntercepted:true},null,2));console.log(JSON.stringify({stale,fresh}));
  assert.equal(fresh.marketing,false,'old response must not persist a grant past the freshness reload');
  assert.deepEqual(cookiesAfterLate.filter(c=>c.name==='_shopify_essential'),cookiesDenied.filter(c=>c.name==='_shopify_essential'),'late read cannot replace the refused native cookie');
  assert.equal(prepared.marketing,false);assert.equal(prepared.analytics,false);assert.equal(prepared.preferences,false);
  assert.equal(metaCalls.slice(afterDenial).filter(c=>c[0]==='trackSingle'||c[0]==='init'||(c[0]==='consent'&&c[1]==='grant')).length,0);
  assert.equal(fresh.meta,'undefined');
 }finally{held.release();choice.release();await context.close()}
});


for(const gpc of [false,true])test(`confirmed native refusal/GPC removes Meta cookies, including before initialization: ${gpc}`,{timeout:30000},async()=>{
 const {page,context}=await open({gpc,metaRecorder:true});try{
  // Synthetic existing identifiers only, installed before native readiness.
  await context.addCookies(['_fbc','_fbp'].map(name=>({name,value:'SYNTHETIC_OFFLINE_EXISTING_META',url:source,path:undefined,secure:true,sameSite:'Lax'})));
  await page.goto(source+'/products/gut-health');await nativeReady(page);
  await page.waitForFunction(()=>!document.cookie.match(/(?:^|;\s*)_fb[cp]=/));
  assert.equal((await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name)).length,0);
  assert.equal(await page.evaluate(()=>typeof fbq),'undefined');
 }finally{await context.close()}
});

test('native first visit, explicit accept/decline/regrant persist and checkout follows native choices',{timeout:30000},async()=>{
 const {page,context}=await open({metaRecorder:true});const stages=[];
 const state=async name=>{await nativeReady(page);const marketing=await page.evaluate(()=>Shopify.customerPrivacy.marketingAllowed());stages.push({name,marketing});return marketing;};
 try{
  await page.goto(source+'/products/creatine-monohydrate');assert.equal(await state('bootstrap'),false);
  await grant(page);await page.reload();assert.equal(await state('returning-granted'),true);
  await page.waitForFunction(()=>!!window.fbq?.callMethod);
  await page.evaluate(()=>{document.cookie='_fbc=SYNTHETIC_OFFLINE_META; Path=/; Secure';document.cookie='_fbp=SYNTHETIC_OFFLINE_BROWSER; Path=/; Secure';});
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await page.waitForFunction(()=>window.Shopify?.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed()&&typeof window.fbq==='undefined');
  assert.equal((await context.cookies(source)).filter(c=>/^_fb[cp]$/.test(c.name)).length,0);
  await page.reload();assert.equal(await state('returning-denied'),false);
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await grant(page);
  await page.reload();assert.equal(await state('returning-regranted'),true);
  await page.locator('.add-to-bag-row .button:enabled').click();const checkout=page.getByRole('link',{name:/Secure checkout/i});await checkout.waitFor();
  const prepared=JSON.parse(new URL(await checkout.getAttribute('href')).searchParams.get('_cs'));
  assert.deepEqual(prepared,{marketing:true,analytics:true,preferences:true,saleOfData:true});
  assert.ok((await context.cookies(source)).some(c=>c.name==='_shopify_essential'&&c.httpOnly));
  fs.writeFileSync(path.join(output,'native-choice-lifecycle.json'),JSON.stringify({stages,prepared},null,2));
 }finally{await context.close()}
});

test('protected form held native read with missing notification channel',{timeout:30000},async()=>{
 const held=gate();const {page:peer,context,requests,metaCalls}=await open({holdNative:held,metaRecorder:true,noChannel:true});
 try{
  await peer.goto(source+'/products/gut-health');await grant(peer);
  const page=await context.newPage();held.page=page;held.enabled=true;
  await page.route('**/api/account/session',route=>route.fulfill({json:{status:'signed_in',csrf:'offline-only',firstName:'Synthetic',email:null,hostedAccountUrl:destination,subscriptionManagementUrl:null}}));
  await page.route('**/api/account/profile',route=>route.fulfill({json:{firstName:'Synthetic',lastName:'Fixture',displayName:'Synthetic Fixture',email:null,phone:null}}));
  await page.goto(source+'/account/profile');const oldResponse=await held.arrived;
  const input=page.locator('input[autocomplete="given-name"]');await input.fill('SYNTHETIC_REVIEW_FORM');
  await page.evaluate(()=>{window.__sameDocument=true;document.addEventListener('iqon:native-consent-invalidated',()=>window.__invalidated=true)});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await peer.getByRole('link',{name:'Cookie preferences',exact:true}).click();await peer.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await peer.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed());
  await page.waitForFunction(()=>window.__invalidated===true);
  const cookiesDenied=await context.cookies(source);const afterDenial=metaCalls.length;held.release();await nativeReady(page);await page.waitForTimeout(200);const cookiesAfterLate=await context.cookies(source);
  assert.equal(await input.inputValue(),'SYNTHETIC_REVIEW_FORM');assert.equal(await page.evaluate(()=>window.__sameDocument),true);
  const stale=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.getByRole('link',{name:'IQON home',exact:true}).first().click();await page.waitForURL(source+'/');
  await page.waitForFunction(()=>!window.__sameDocument&&window.Shopify?.customerPrivacy?.consentStatus==='loaded');
  const fresh=await page.evaluate(()=>({marketing:Shopify.customerPrivacy.marketingAllowed(),sale:Shopify.customerPrivacy.saleOfDataAllowed(),google:typeof gtag,meta:typeof fbq}));
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);
  await page.locator('.add-to-bag-row .button:enabled').click();const checkout=page.getByRole('link',{name:/Secure checkout/i});await checkout.waitFor();
  const prepared=JSON.parse(new URL(await checkout.getAttribute('href')).searchParams.get('_cs'));
  fs.writeFileSync(path.join(output,'protected-no-channel.json'),JSON.stringify({oldResponse,stale,fresh,prepared,cookiesDenied,cookiesAfterLate,metaCalls,allRequestsIntercepted:true},null,2));console.log(JSON.stringify({stale,fresh}));
  assert.equal(fresh.marketing,false,'old response must not persist a grant past the freshness reload');
  assert.deepEqual(cookiesAfterLate.filter(c=>c.name==='_shopify_essential'),cookiesDenied.filter(c=>c.name==='_shopify_essential'),'late read cannot replace the refused native cookie');
  assert.equal(prepared.marketing,false);assert.equal(prepared.analytics,false);assert.equal(prepared.preferences,false);
  assert.equal(metaCalls.slice(afterDenial).filter(c=>c[0]==='trackSingle'||c[0]==='init'||(c[0]==='consent'&&c[1]==='grant')).length,0);
  assert.equal(fresh.meta,'undefined');
 }finally{held.release();await context.close()}
});
