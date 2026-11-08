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
async function open({gpc=false,consentFailure=false,tagFailure=false,metaRecorder=false,holdMeta,holdCheckout,viewport={width:390,height:844}}={}){
 const context=await browser.newContext({serviceWorkers:'block',viewport});const requests=[],errors=[],metaCalls=[];
 let closing=false;const closeContext=context.close.bind(context);
 context.close=async()=>{closing=true;await closeContext()};
 if(metaRecorder)await context.exposeFunction('__recordMeta',(...args)=>metaCalls.push(args));
 if(gpc)await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
 await context.route('**/*',async route=>{
  try{
  const r=route.request(),u=new URL(r.url());requests.push({url:r.url(),method:r.method(),body:r.postData(),headers:await r.allHeaders()});
  if(metaRecorder&&u.hostname==='connect.facebook.net'){
   if(holdMeta&&!holdMeta.used){holdMeta.used=true;holdMeta.notify();await holdMeta.released;}
   return route.fulfill({contentType:'text/javascript',body:"window.fbq.callMethod=(...args)=>window.__recordMeta(...args);window.fbq.queue.splice(0).forEach(args=>window.fbq.callMethod(...args));"}).catch(()=>{});
  }
  if(tagFailure&&u.hostname==='www.googletagmanager.com')return route.abort();
  const script=scripts.get(u.origin+u.pathname);if(script)return route.fulfill({body:script,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  if(u.origin===source){
   if(consentFailure&&u.pathname==='/api/unstable/graphql.json')return route.fulfill({status:503,body:'unavailable'});
   const headers={...await r.allHeaders(),host:`127.0.0.1:${port}`,'x-forwarded-proto':'http'};
   // Translate only the isolated loopback transport origin; browser URLs stay canonical.
   if(headers.origin===source)headers.origin=`http://localhost:${port}`;
   if(gpc)headers['sec-gpc']='1';
   const response=await route.fetch({url:local+u.pathname+u.search,headers,maxRedirects:0,timeout:5000});if(holdCheckout&&u.pathname==='/api/checkout'&&!holdCheckout.used){holdCheckout.used=true;holdCheckout.notify(await response.json());await holdCheckout.released;}
   return route.fulfill({response}).catch(()=>{});
  }
  if(u.origin===destination&&r.isNavigationRequest()){
   const consent=JSON.parse(u.searchParams.get('_cs')||'{}');
   const setup=`window.subscriptions={};self.webPixelsManager={createShopifyExtend:()=>({extend:(name,callback)=>callback({settings:{config:JSON.stringify({google_tag_ids:['AW-18501766604'],gtag_events:[{type:'purchase',action_label:'AW-18501766604/Ig36CKDCy6MdEMybqvZE'}]})},init:{customerPrivacy:{marketingAllowed:${consent.marketing===true},analyticsProcessingAllowed:${consent.analytics===true},saleOfDataAllowed:${consent.saleOfData===true}},data:{shop:{myshopifyDomain:'nr9zd0-t5.myshopify.com'}}},_pixelInfo:{surfaceNext:'checkout'},analytics:{subscribe:(name,fn)=>subscriptions[name]=fn},customerPrivacy:{subscribe:()=>{}}})})};`;
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Offline checkout</title><body><script>${setup}</script><script>${fixture('native-pixel')}</script>`});
  }
  return await route.abort();
  }catch(error){if(!closing)throw error;} // Only absorb cancellation caused by this test's teardown.
 });
 context.setDefaultTimeout(10000);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {page,context,requests,errors,metaCalls};
}
const tagRequests=requests=>requests.filter(r=>r.url.startsWith('https://www.googletagmanager.com/gtag/js'));
const googleRequests=requests=>requests.filter(r=>/google|doubleclick/.test(new URL(r.url).hostname));
async function nativeReady(page){await page.waitForFunction(()=>window.Shopify?.customerPrivacy?.consentStatus==='loaded');}
test('actual Shopify banner and checkout linker in production Next build',async()=>{
 const {page,context,requests,errors}=await open();
 try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await nativeReady(page);
  assert.equal(tagRequests(requests).length,0);
  await page.screenshot({path:path.join(output,'native-banner-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Accept all',exact:true}).first().click();
  await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  await page.locator('.add-to-bag-row .button:enabled').click();
  await page.locator('.bag-sheet .cart-line').waitFor();
  await page.getByRole('link',{name:/Secure checkout/i}).click();
  await page.waitForURL(destination+'/**');await page.waitForTimeout(800);
  assert.ok(new URL(page.url()).searchParams.has('_gl'));
  assert.ok((await context.cookies(destination)).some(c=>c.name==='_gcl_aw'&&c.value.includes(clickId)));
  const sourcePings=googleRequests(requests).filter(r=>r.headers.referer===source+'/'&&/\/(ccm\/collect|pagead\/set_partitioned_cookie)/.test(new URL(r.url).pathname));
  assert.ok(sourcePings.length>0,'document standard Ads attribution pings despite send_page_view:false');
  for(const request of sourcePings){
    const u=new URL(request.url);assert.equal(u.searchParams.get('npa'),'1');assert.equal(u.searchParams.get('en'),'page_view');
    const referrer=u.searchParams.get('dr')||u.searchParams.get('ref');assert.ok(!referrer||referrer===source+'/');
    assert.equal(u.searchParams.get('dl')||u.searchParams.get('url'),source+'/products/creatine-monohydrate');
  }
  fs.writeFileSync(path.join(output,'requests.json'),JSON.stringify(requests,null,2));
  assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync(path.join(output,'requests.json'),JSON.stringify(requests,null,2));await context.close()}
});
async function grant(page){await nativeReady(page);await page.getByRole('button',{name:'Accept all',exact:true}).first().click();await page.waitForFunction(()=>Shopify.customerPrivacy.marketingAllowed());}
async function addAndCheckout(page){await page.locator('.add-to-bag-row .button:enabled').click();await page.locator('.bag-sheet .cart-line').waitFor();await page.getByRole('link',{name:/Secure checkout/i}).click();}
function noSensitiveGoogle(requests){
 const sent=JSON.stringify(googleRequests(requests));assert.doesNotMatch(decodeURIComponent(sent),/SENSITIVE_|customer@example|purchase|user_data|add_to_cart/);
}
for(const [name,options,action] of [
 ['refusal',{},async page=>{await nativeReady(page);await page.getByRole('button',{name:'Decline all',exact:true}).first().click()}],
 ['GPC',{gpc:true},grant],
 ['unavailable native consent',{consentFailure:true},async page=>{await page.waitForTimeout(300)}],
])test(`${name}: no storefront Google; checkout carries denied marketing`,async()=>{
 const {page,context,requests}=await open(options);
 try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await action(page);
  assert.equal(requests.filter(r=>new URL(r.url).hostname==='connect.facebook.net').length,0);
  assert.equal(tagRequests(requests).length,0);assert.equal((await context.cookies(source)).filter(c=>c.name.startsWith('_gcl_')).length,0);
  await addAndCheckout(page);await page.waitForURL(destination+'/**');
  const u=new URL(page.url());assert.equal(u.searchParams.has('_gl'),false);const consent=JSON.parse(u.searchParams.get('_cs'));assert.equal(consent.marketing,false);
  if(options.gpc||options.consentFailure)assert.equal(consent.saleOfData,false);
  assert.equal(googleRequests(requests).filter(r=>r.headers.referer===source+'/').length,0);
 }finally{await context.close()}
});
test('native preferences link withdraws consent and removes attribution cookies',async()=>{
 const {page,context,requests}=await open({viewport:{width:1440,height:1000}});
 try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  const before=tagRequests(requests).length;
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();
  await page.getByRole('button',{name:'Decline all',exact:true}).first().waitFor();
  await page.screenshot({path:path.join(output,'native-preferences-desktop.png')});
  await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await page.waitForFunction(()=>window.Shopify?.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed()&&typeof window.gtag==='undefined');
  assert.equal((await context.cookies(source)).filter(c=>c.name.startsWith('_gcl_')).length,0);
  await page.reload();await nativeReady(page);assert.equal(tagRequests(requests).length,before);
  await addAndCheckout(page);await page.waitForURL(destination+'/**');assert.equal(new URL(page.url()).searchParams.has('_gl'),false);
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('_cs')).marketing,false);
 }finally{await context.close()}
});
test('sensitive query, malformed click ID and sensitive route never load Google after native grant',async()=>{
 for(const route of ['/products/creatine-monohydrate?email=SENSITIVE_EMAIL','/products/creatine-monohydrate?gclid=bad%40email','/products/creatine-monohydrate#SENSITIVE_HASH','/products/gut-health?gclid='+clickId]){
  const {page,context,requests}=await open();try{
   await page.goto(source+route,{referer:source+'/account?customer=SENSITIVE_REFERRER'});await grant(page);await page.waitForTimeout(200);
   assert.equal(tagRequests(requests).length,0,route);noSensitiveGoogle(requests);
  }finally{await context.close()}
 }
});
test('protected SPA navigation unloads Google before sensitive URL mutation',async()=>{
 const {page,context,requests}=await open();try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId,{referer:source+'/account?customer=SENSITIVE_REFERRER'});await grant(page);await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  await page.evaluate(()=>{const input=document.createElement('input');input.type='email';input.value='customer@example.test';document.body.append(input);input.focus();input.blur()});
  const before=tagRequests(requests).length;
  await page.evaluate(()=>history.pushState({},'', '/products/gut-health?medical=SENSITIVE_QUERY'));
  await page.waitForURL('**/products/gut-health?medical=SENSITIVE_QUERY');await nativeReady(page);await page.waitForTimeout(200);
  assert.equal(tagRequests(requests).length,before);assert.equal(await page.evaluate(()=>typeof window.gtag),'undefined');noSensitiveGoogle(requests);
 }finally{await context.close()}
});

test('tag fetch failure keeps real checkout available without claiming attribution',async()=>{
 const {page,context}=await open({tagFailure:true});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await addAndCheckout(page);await page.waitForURL(destination+'/**');
  assert.equal(new URL(page.url()).searchParams.has('_gl'),false);assert.equal(JSON.parse(new URL(page.url()).searchParams.get('_cs')).marketing,true);
 }finally{await context.close()}
});
test('late prepared checkout response cannot restore consent after native withdrawal',async()=>{
 const gate={};gate.arrived=new Promise(resolve=>gate.notify=resolve);gate.released=new Promise(resolve=>gate.release=resolve);
 const {page,context,requests}=await open({holdCheckout:gate});try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  await page.locator('.add-to-bag-row .button:enabled').click();
  const old=await gate.arrived;assert.equal(JSON.parse(new URL(old.checkoutUrl).searchParams.get('_cs')).marketing,true);
  assert.equal(await page.getByRole('link',{name:/Secure checkout/i}).count(),0);
  await page.evaluate(()=>Shopify.customerPrivacy.setTrackingConsent({marketing:false,analytics:false,preferences:false,sale_of_data:false},()=>{}));
  await page.waitForFunction(()=>window.Shopify?.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed()&&typeof window.gtag==='undefined');
  gate.release();await page.waitForTimeout(200);
  assert.equal(requests.filter(r=>r.url.startsWith(destination)).length,0);
  await page.goto(source+'/checkout');await nativeReady(page);
  const link=page.getByRole('link',{name:/Continue to checkout/i});await link.waitFor();
  assert.equal(JSON.parse(new URL(await link.getAttribute('href')).searchParams.get('_cs')).marketing,false);
  await link.click();await page.waitForURL(destination+'/**');assert.equal(new URL(page.url()).searchParams.has('_gl'),false);
 }finally{gate.release();await context.close()}
});
test('cart mutation invalidates a prepared link before the next user activation',async()=>{
 const {page,context}=await open();try{
  await page.goto(source+'/products/creatine-monohydrate');await nativeReady(page);await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await page.locator('.add-to-bag-row .button:enabled').click();await page.getByRole('link',{name:/Secure checkout/i}).waitFor();
  let release;const wait=new Promise(resolve=>release=resolve);
  await page.route('**/api/cart',async route=>{if(route.request().method()==='POST')await wait;await route.fallback()});
  await page.locator('.bag-sheet button[aria-label^="Increase"]').click();
  assert.equal(await page.getByRole('link',{name:/Secure checkout/i}).count(),0);
  release();await page.getByRole('link',{name:/Secure checkout/i}).waitFor();
  assert.equal(await page.locator('.bag-sheet .quantity span').innerText(),'2');
 }finally{await context.close()}
});
test('ordinary SPA browsing then sensitive product returns through safe review; keyboard links preserve attribution',async()=>{
 const {page,context,requests}=await open();try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);await page.waitForFunction(()=>document.cookie.includes('_gcl_aw='));
  await page.getByRole('link',{name:'IQON home',exact:true}).first().click();await page.waitForURL(source+'/');
  await page.getByRole('link',{name:'Supplements',exact:true}).last().click();await page.waitForURL(source+'/collections/supplements');
  await page.locator('a[href="/products/gut-health"]').first().click();await page.waitForURL(source+'/products/gut-health');await nativeReady(page);
  assert.equal(await page.evaluate(()=>typeof window.gtag),'undefined');
  await page.locator('.add-to-bag-row .button:enabled').click();
  const review=page.getByRole('link',{name:/Secure checkout/i});await review.waitFor();assert.equal(await review.getAttribute('href'),'/checkout');
  await review.click();await page.waitForURL(source+'/checkout');await nativeReady(page);
  const link=page.getByRole('link',{name:/Continue to checkout/i});await link.waitFor();// Real keyboard navigation (Tab keyup is part of native link activation).
  for(let i=0;i<45;i++){
    if(await link.evaluate(el=>el===document.activeElement))break;
    await page.keyboard.press('Tab');
  }
  assert.equal(await link.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');
  await page.waitForURL(destination+'/**');await page.waitForTimeout(500);
  assert.ok(new URL(page.url()).searchParams.has('_gl'));
  assert.ok((await context.cookies(destination)).some(c=>c.name==='_gcl_aw'&&c.value.includes(clickId)));
  const storefrontHits=googleRequests(requests).filter(r=>r.headers.referer===source+'/');
  assert.doesNotMatch(JSON.stringify(storefrontHits),/gut-health/);
 }finally{await context.close()}
});
test('GPC changed after preparation blocks the stale anchor synchronously',async()=>{
 const {page,context,requests}=await open();try{
  await page.goto(source+'/products/creatine-monohydrate?gclid='+clickId);await grant(page);
  await page.locator('.add-to-bag-row .button:enabled').click();const link=page.getByRole('link',{name:/Secure checkout/i});await link.waitFor();
  await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
  await page.evaluate(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
  await link.dispatchEvent('pointerdown',{bubbles:true});
  await page.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!document.cookie.includes('_gcl_'));
  assert.equal(requests.filter(r=>r.url.startsWith(destination)).length,0);
  await page.goto(source+'/checkout');await page.getByRole('link',{name:/Continue to checkout/i}).waitFor();
  const href=await page.getByRole('link',{name:/Continue to checkout/i}).getAttribute('href');const consent=JSON.parse(new URL(href).searchParams.get('_cs'));
  assert.equal(consent.marketing,false);assert.equal(consent.saleOfData,false);
 }finally{await context.close()}
});
test('existing Meta independently honors native grant, withdrawal and resumption on a Google-excluded product',async()=>{
 const {page,context,requests,metaCalls}=await open({metaRecorder:true});
 const metaRequests=()=>requests.filter(r=>new URL(r.url).hostname==='connect.facebook.net');
 const events=name=>metaCalls.filter(c=>c[0]==='trackSingle'&&c[1]==='1006368245818889'&&c[2]===name);
 try{
  await page.goto(source+'/products/gut-health');await nativeReady(page);
  assert.equal(metaRequests().length,0);assert.equal(await page.evaluate(()=>typeof fbq),'undefined');
  await grant(page);await page.waitForFunction(()=>!!window.fbq?.callMethod);
  await page.waitForTimeout(100);assert.equal(events('PageView').length,1);assert.equal(events('ViewContent').length,1);
  assert.equal(metaRequests().length,1);assert.equal(tagRequests(requests).length,0);
  await page.evaluate(()=>{for(let i=0;i<3;i++){document.dispatchEvent(new Event('visitorConsentCollected'));document.dispatchEvent(new Event('consentTrackingApiLoaded'))}});await page.waitForTimeout(100);
  assert.equal(events('PageView').length,1);assert.equal(events('ViewContent').length,1);
  await page.locator('.add-to-bag-row .button:enabled').click();await page.locator('.bag-sheet .cart-line').waitFor();await page.waitForTimeout(100);
  assert.equal(events('AddToCart').length,1);await page.keyboard.press('Escape');
  await page.evaluate(()=>{document.cookie='_fbp=synthetic; Path=/; Secure';document.cookie='_fbc=synthetic; Path=/; Secure'});
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await page.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed()&&typeof fbq==='undefined');
  assert.equal(metaRequests().length,1);assert.equal((await context.cookies(source)).filter(c=>/^_fb[pc]$/.test(c.name)).length,0);
  assert.ok(metaCalls.some(c=>c[0]==='consent'&&c[1]==='revoke'));
  const before=metaCalls.length;
  await page.locator('.add-to-bag-row .button:enabled').click();await page.locator('.bag-sheet .cart-line').waitFor();await page.keyboard.press('Escape');
  assert.equal(metaCalls.length,before,'denied cart action adds no Meta events or queue');
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Accept all',exact:true}).first().click();
  await page.waitForFunction(()=>!!window.fbq?.callMethod);await page.waitForTimeout(100);
  assert.equal(metaRequests().length,2);assert.equal(events('PageView').length,2);assert.equal(events('ViewContent').length,2);assert.equal(events('AddToCart').length,1);
  assert.equal(tagRequests(requests).length,0,'Meta consent does not depend on the Google allowlist');
  fs.writeFileSync(path.join(output,'meta-consent-events.json'),JSON.stringify(metaCalls,null,2));
 }finally{await context.close()}
});
test('withdrawal while Meta vendor script is delayed prevents stale grant and event replay',async()=>{
 const gate={};gate.arrived=new Promise(resolve=>gate.notify=resolve);gate.released=new Promise(resolve=>gate.release=resolve);
 const {page,context,requests,metaCalls}=await open({metaRecorder:true,holdMeta:gate});
 try{
  await page.goto(source+'/products/gut-health');await grant(page);await gate.arrived;
  const queued=await page.evaluate(()=>window.fbq.queue);assert.ok(queued.some(c=>c[0]==='trackSingle'));
  await page.getByRole('link',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Decline all',exact:true}).first().click();
  await page.waitForFunction(()=>Shopify.customerPrivacy?.consentStatus==='loaded'&&!Shopify.customerPrivacy.marketingAllowed()&&typeof fbq==='undefined');
  gate.release();await page.waitForTimeout(300);
  assert.equal(metaCalls.length,0,'delayed external loader must not replay old granted events after refusal');
  assert.equal(requests.filter(r=>new URL(r.url).hostname==='connect.facebook.net').length,1,'denied reload must not request the vendor again');
  assert.equal(tagRequests(requests).length,0);
  fs.writeFileSync(path.join(output,'meta-delayed-withdrawal.json'),JSON.stringify({queuedBeforeWithdrawal:queued,executedAfterWithdrawal:metaCalls,allNetworkIntercepted:true},null,2));
 }finally{gate.release();await context.close()}
});
