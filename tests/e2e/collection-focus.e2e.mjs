// Local completed production build, synthetic Shopify boundary, real assets.
// Owns and cleans up loopback servers. No purchases, emails or external tracking.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const root=process.cwd(),out=process.env.E2E_SCREENSHOTS||'/tmp/iqon-collection-focus';
const port=Number(process.env.E2E_PORT||4030),assetPort=3991;
fs.mkdirSync(out,{recursive:true});
const servers=[],evidence=[];
const browser=await chromium.launch();
process.on('exit',()=>servers.forEach(s=>s.child.kill('SIGTERM')));
test.after(async()=>{
 await browser.close();
 await Promise.all(servers.map(({child})=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');})));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));
 fs.writeFileSync(path.join(out,'owned-processes.json'),JSON.stringify(servers.map(({child,...s})=>({...s,pid:child.pid,exitCode:child.exitCode,signal:child.signalCode})),null,2));
});
async function start(name,args,env,serverPort){
 try{await fetch(`http://localhost:${serverPort}`);throw Error(`Port ${serverPort} occupied`);}catch(e){if(e.message.includes('occupied'))throw e;}
 const log=fs.openSync(path.join(out,`${name}.log`),'w');
 const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:['ignore',log,log]});servers.push({child,name,port:serverPort});
 if(name==='assets'){await new Promise(r=>setTimeout(r,250));assert.equal(child.exitCode,null);return;}
 for(let i=0;i<80;i++){try{if((await fetch(`http://localhost:${serverPort}/collections/supplements`)).ok)return `http://localhost:${serverPort}`;}catch{}await new Promise(r=>setTimeout(r,250));}
 throw Error(`${name} did not start`);
}
await start('assets',['tests/e2e/premium-asset-server.mjs'],{QA_ASSET_PORT:String(assetPort)},assetPort);
const bases={};
for(const [i,mode]of ['live','preview','empty','down'].entries())bases[mode]=await start(mode,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port+i)],{
 NODE_ENV:'production',VERCEL_ENV:mode==='preview'?'preview':'production',NEXT_PUBLIC_META_PIXEL_ID:'',
 FAKE_SHOPIFY:mode,FAKE_CATALOG:'purchase-clarity',SHOPIFY_STORE_DOMAIN:mode==='preview'?'':'iqon-test.myshopify.com',SHOPIFY_STOREFRONT_PRIVATE_TOKEN:mode==='preview'?'':'test-token',
 NODE_OPTIONS:`--import tsx --import ${path.join(root,'tests/e2e/collection-focus-hook.mjs')}`,
},port+i);
async function open(width=390,mode='live',route='/collections/supplements'){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
 await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(bases[mode]+route);await settle(page);return {page,context,errors};
}
async function settle(page){await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);}
const names=page=>page.locator('.product-card h3').allTextContents();
async function count(page,n){await page.waitForFunction(n=>document.querySelectorAll('.product-card').length===n,n);assert.equal(await page.locator('.catalog-count').innerText(),`${n} ${n===1?'product':'products'}`);}
async function clickLink(page,link){const href=await link.getAttribute('href');await Promise.all([page.waitForURL(new URL(href,page.url()).href),link.click()]);await settle(page);}
async function focus(page,label){await clickLink(page,page.getByRole('navigation',{name:'Browse by focus'}).getByRole('link',{name:label,exact:true}));}
async function reset(page,label){const url=new URL(page.url()),sort=url.searchParams.get('sort');url.search=sort?`sort=${sort}`:'';await Promise.all([page.waitForURL(url.href),page.getByRole('button',{name:label,exact:true}).click()]);await settle(page);}
async function capture(page,name){
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);
 await page.evaluate(()=>document.querySelectorAll('.product-card img').forEach(i=>i.loading='eager'));
 await page.waitForFunction(()=>[...document.querySelectorAll('.product-card img')].every(i=>i.complete&&i.naturalWidth>0));
 const m=await page.evaluate(()=>({focusBoxes:[...document.querySelectorAll('.catalog-focus a')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}),gridTop:document.querySelector('.product-grid').getBoundingClientRect().top,selectionBottom:document.querySelector('.catalog-selection').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth-innerWidth,images:[...document.querySelectorAll('.product-card img')].map(i=>({src:i.src,width:i.naturalWidth})),focus:[...document.querySelectorAll('.catalog-focus a[aria-current]')].map(a=>a.textContent),count:document.querySelector('.catalog-count').textContent}));
 assert.ok(m.overflow<=1);assert.ok(m.gridTop>=m.selectionBottom);for(let i=0;i<m.focusBoxes.length;i++)for(let j=i+1;j<m.focusBoxes.length;j++){const a=m.focusBoxes[i],b=m.focusBoxes[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=1,'focus controls do not overlap');}evidence.push({name,url:page.url(),...m});await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});await page.screenshot({path:path.join(out,`${name}-viewport.png`)});
}
for(const width of [320,390,1440])test(`live ${width}: focus, format, search, sort, empty/reset, history and real assets`,async t=>{
 const {page,context,errors}=await open(width);try{
 const all=await page.locator('.product-card').count();assert.ok(all>=11);
 await t.test('All retains unmatched supplements and no skincare',async()=>{assert.ok((await names(page)).includes('GLP-1 Support'));assert.equal(await page.locator('.skincare-product').count(),0);await capture(page,`all-${width}`);});
 await t.test('keyboard selection of Training',async()=>{const allLink=page.getByRole('navigation',{name:'Browse by focus'}).getByRole('link',{name:'All',exact:true});await allLink.focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Training');await page.keyboard.press('Enter');await page.waitForURL(/focus=training/);await settle(page);await count(page,1);assert.deepEqual(await names(page),['Creatine Monohydrate']);await capture(page,`training-${width}`);});
 await t.test('format combines with focus; impossible intersection is resettable',async()=>{await clickLink(page,page.getByRole('navigation',{name:'Shop by format'}).getByRole('link',{name:'Capsules',exact:true}));assert.match(page.url(),/format=capsules&focus=training/);await count(page,0);assert.ok(await page.getByRole('heading',{name:'No products found.'}).isVisible());await capture(page,`empty-${width}`);await reset(page,'Show all products');await count(page,all);});
 await t.test('Everyday nutrition includes only the two collagen formulas and Gummies',async()=>{await focus(page,'Everyday nutrition');await count(page,3);assert.deepEqual(new Set(await names(page)),new Set(['Hydrolyzed Collagen Peptides','Grass-Fed Collagen Peptides','Hair, Skin & Nails Gummies']));await capture(page,`nutrition-${width}`);});
 await t.test('sort retains focus, format retains sort, search stays local and combines',async()=>{
 await page.getByRole('combobox',{name:'Sort products'}).click();await Promise.all([page.waitForURL(/sort=name/),page.getByRole('option',{name:'Name: A to Z',exact:true}).click()]);await settle(page);assert.match(page.url(),/focus=everyday-nutrition&sort=name/);const n=await names(page);assert.deepEqual(n,[...n].sort((a,b)=>a.localeCompare(b)));
 await clickLink(page,page.getByRole('navigation',{name:'Shop by format'}).getByRole('link',{name:'Powders',exact:true}));await count(page,2);assert.match(page.url(),/format=powder&focus=everyday-nutrition&sort=name/);
 const search=page.getByRole('searchbox',{name:'Find a product'});await search.fill('unflavored');await count(page,1);assert.deepEqual(await names(page),['Hydrolyzed Collagen Peptides']);
 await focus(page,'Training');await count(page,0);assert.equal(await search.inputValue(),'unflavored');await page.getByRole('button',{name:'Clear product search'}).click();await count(page,1);
 });
 await t.test('back, forward and reload restore URL focus/format/sort',async()=>{
 await page.goBack();await settle(page);await count(page,2);assert.equal(await page.locator('.catalog-focus a[aria-current]').innerText(),'Everyday nutrition');assert.match(page.url(),/sort=name/);
 await page.goForward();await settle(page);await count(page,1);assert.equal(await page.locator('.catalog-focus a[aria-current]').innerText(),'Training');await page.reload();await settle(page);await count(page,1);
 await reset(page,'Reset filters');await count(page,all);assert.match(page.url(),/supplements\?sort=name$/);
 });
 await t.test('price ordering composes with focus and unavailable products remain visible',async()=>{
 await focus(page,'Everyday nutrition');await page.getByRole('combobox',{name:'Sort products'}).click();await Promise.all([page.waitForURL(/sort=high/),page.getByRole('option',{name:'Price: high to low',exact:true}).click()]);await settle(page);
 const prices=(await page.locator('.product-card-info>span:first-child').allTextContents()).map(t=>Number(t.replace(/[^\d.]/g,'')));assert.deepEqual(prices,[...prices].sort((a,b)=>b-a));assert.match(page.url(),/focus=everyday-nutrition&sort=high/);
 await focus(page,'Digestive support');await count(page,1);assert.deepEqual(await names(page),['Gut Health']);assert.equal(await page.locator('.card-availability').innerText(),'Currently unavailable');assert.equal(await page.getByRole('button',{name:/Add to bag: Gut/}).count(),0);await capture(page,`digestive-unavailable-${width}`);
 });
 await t.test('actual 200% focus text remains usable and contained',async()=>{const text=await page.locator('.catalog-focus').evaluate(nav=>{const es=[...nav.querySelectorAll('a,span')],before=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=`${before[i]*2}px`);return {before,after:es.map(e=>parseFloat(getComputedStyle(e).fontSize))};});assert.deepEqual(text.after,text.before.map(n=>n*2));await capture(page,`focus-text-200-${width}`);await focus(page,'All');await count(page,all);});
 assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('unknown focus defaults to All; focus never filters all-products or skincare collections',async()=>{
 for(const [route,expected,control]of [['/collections/supplements?focus=unsupported',11,true],['/collections/all?focus=training',18,false],['/collections/skincare?focus=training',7,false]]){
 const {page,context}=await open(390,'preview',route);try{await count(page,expected);assert.equal(await page.locator('.catalog-focus').count(),Number(control));if(control)assert.equal(await page.locator('.catalog-focus a[aria-current]').innerText(),'All');else{await page.getByRole('searchbox',{name:'Find a product'}).fill('no-match');await count(page,0);assert.ok(await page.getByText('Try another product name or clear your search.').isVisible());await page.getByRole('button',{name:'Show all products',exact:true}).click();await count(page,expected);assert.equal(page.url(),bases.preview+route);}}finally{await context.close();}
 }
});
for(const mode of ['preview','empty','down'])test(`${mode}: honest availability and empty state`,async()=>{
 const {page,context}=await open(390,mode);try{
 if(mode==='preview'||mode==='empty'){if(mode==='empty'){await count(page,11);assert.equal(await page.locator('.product-card button').count(),0);assert.equal(await page.locator('.card-availability').count(),11);}await focus(page,'Digestive support');await count(page,1);assert.equal(await page.locator('.card-availability').innerText(),'Currently unavailable');}
 else{await count(page,0);assert.ok(await page.getByRole('heading',{name:'We’ll be back shortly.'}).isVisible());}
 await capture(page,`${mode}-390`);
 }finally{await context.close();}
});
function get(base,route,host){return new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:new URL(base).port,path:route,headers:{host,'user-agent':'Googlebot'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);});}
test('SEO: focus variants retain the clean canonical and existing host/catalog indexing policy',async t=>{
 for(const [mode,host,indexable]of [['live','www.iqondaily.com',true],['live','iqondaily.com',false],['preview','www.iqondaily.com',false],['empty','www.iqondaily.com',false],['down','www.iqondaily.com',false]])await t.test(`${mode} ${host}`,async()=>{
 for(const query of ['','?focus=training','?format=powder&focus=everyday-nutrition&sort=name','?focus=unknown','?focus=training&focus=digestive-support']){
 const r=await get(bases[mode],'/collections/supplements'+query,host);assert.equal(r.status,200);const head=r.body.split('</head>')[0];assert.match(head,/<link rel="canonical" href="https:\/\/www.iqondaily.com\/collections\/supplements"/);assert.match(head,indexable?/<meta name="robots" content="index, follow"/:/<meta name="robots" content="noindex, follow"/);
 }
 });
});
for(const width of [390,1440])test(`protected layout ${width}: product opening and frozen skincare slider`,async()=>{
 const {page,context}=await open(width,'preview','/products/colostrum-powder');try{
 const metrics=await page.evaluate(()=>{const size=document.querySelector('.product-size'),desc=document.querySelector('.product-summary-description');return {gap:desc.getBoundingClientRect().top-size.getBoundingClientRect().bottom,font:getComputedStyle(desc).fontSize,order:[...document.querySelector('#overview').children].map(e=>e.className),overflow:document.documentElement.scrollWidth-innerWidth};});
 assert.equal(metrics.gap,16);assert.equal(metrics.font,width===390?'16px':'17px');assert.match(metrics.order[0],/product-visual-gallery/);assert.match(metrics.order[2],/panel-info/);assert.ok(metrics.overflow<=1);evidence.push({name:`protected-product-${width}`,...metrics});
 await page.waitForFunction(()=>{const i=document.querySelector('.visual-pack img');return i.complete&&i.naturalWidth>0;});await page.screenshot({path:path.join(out,`protected-product-${width}.png`)});
 // Match the original frozen baseline viewport (390x844, 1440x900).
 await page.setViewportSize({width,height:width===390?844:900});
 await page.goto(bases.preview+'/skincare');await settle(page);await page.locator('#skincare-results').scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 const slider=page.getByRole('slider');assert.equal(await slider.getAttribute('aria-valuenow'),'50');
 const actual=await page.locator('#skincare-results').screenshot({path:path.join(out,`protected-slider-${width}.png`)});
 const {default:sharp}=await import('sharp');const baseline=fs.readFileSync(`docs/qa/premium-site/screenshots/baseline-slider-${width}.png`);const meta=await sharp(baseline).metadata();const frame={left:0,top:0,width:meta.width,height:meta.height-1};
 assert.ok((await sharp(actual).extract(frame).raw().toBuffer()).equals(await sharp(baseline).extract(frame).raw().toBuffer()),'frozen slider content pixels unchanged');
 await slider.focus();await page.keyboard.press('ArrowRight');assert.equal(await slider.getAttribute('aria-valuenow'),'51');
 await page.keyboard.press('Home');assert.equal(await slider.getAttribute('aria-valuenow'),'0');await page.keyboard.press('End');assert.equal(await slider.getAttribute('aria-valuenow'),'100');
 }finally{await context.close();}
});
