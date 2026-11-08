// Production local preview, original in-repository catalog/assets, no asset interception.
// Commerce uses the separate synthetic purchase-clarity suite. Never submits orders or emails.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const base=process.env.QA_BASE||'http://localhost:3987';
const out=process.env.E2E_SCREENSHOTS||'docs/qa/premium-site/screenshots';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const measurements=[];
test.after(async()=>{fs.writeFileSync(path.join(out,'render-measurements.json'),JSON.stringify(measurements,null,2));await browser.close();});
const supplements=['creatine-monohydrate','hydrolyzed-collagen-peptides','collagen-peptides-chocolate','colostrum-powder','gut-health','keto-5','glp-1-support','liver-support','nmn','resveratrol','hair-skin-nails-gummies'];
async function open(route,width=390){
 const context=await browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce'});
 await context.route(/https:\/\/(connect\.facebook\.net|www\.facebook\.com)/,r=>r.abort());
 await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.layoutShifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.layoutShifts.push(e.value)}).observe({type:'layout-shift',buffered:true});});
 const response=await page.goto(base+route);assert.equal(response.status(),200);
 await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');
 return {page,context,errors};
}
async function inspect(page,route,width){
 // Initial paint is measured first; explicitly request offscreen carousel images too.
 // No image URL replacement or network aborts.
 await page.evaluate(()=>document.querySelectorAll('main img').forEach(i=>i.loading='eager'));
 await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=650){scrollTo(0,y);await new Promise(r=>setTimeout(r,35));}scrollTo(0,0);});
 await page.waitForFunction(()=>[...document.querySelectorAll('main img')].every(i=>i.complete&&i.naturalWidth>0));
 await page.waitForTimeout(150);
 const measure=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,fonts:document.fonts.check('16px Inter'),images:[...document.querySelectorAll('main img')].map(i=>({src:i.getAttribute('src'),naturalWidth:i.naturalWidth})),h1:document.querySelector('h1')?.innerText,cls:window.layoutShifts.reduce((s,n)=>s+n,0),intro:document.querySelector('.product-summary-description')?(()=>{const e=document.querySelector('.product-summary-description');const r=e.getBoundingClientRect();const c=getComputedStyle(e);return {x:r.x,y:r.y,font:c.fontSize,line:c.lineHeight,color:c.color}})():null}));
 measurements.push({route,...measure});assert.ok(measure.overflow<=1,`${route} at ${width}: overflow ${measure.overflow}`);assert.ok(measure.fonts,'Inter loaded');
 return measure;
}
for(const width of [390,1440])for(const [name,route] of Object.entries({home:'/',collection:'/collections/supplements',all:'/collections/all',skincare:'/skincare',approach:'/approach',help:'/help',journal:'/journal/reading-a-supplement-label',colostrum:'/products/colostrum-powder',creatine:'/products/creatine-monohydrate'}))test(`${name} ${width}: real assets, stable reading layout and capture`,async()=>{
 const {page,context,errors}=await open(route,width);try{
 const m=await inspect(page,route,width);assert.deepEqual(errors,[]);
 if(name==='home'||name==='skincare')assert.doesNotMatch(await page.locator('main').innerText(),/reviews will appear|sample rating/i);
 if(name==='home'){
  assert.equal(await page.locator('.home-edit .product-card').count(),3);
  assert.equal(await page.locator('.home-opening .button').getAttribute('href'),'/collections/supplements');
  assert.ok(m.cls<0.1,`first paint CLS ${m.cls}`);
 }
 for(const a of await page.getByRole('link',{name:'Shop all',exact:true}).all())assert.equal(await a.getAttribute('href'),'/collections/all');
 await page.screenshot({path:path.join(out,`${name}-${width}-top.png`)});
 await page.screenshot({path:path.join(out,`${name}-${width}-full.png`),fullPage:true});
 if(name==='colostrum'){
  await page.locator('.product-summary').evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-(document.querySelector('.store-header')?.getBoundingClientRect().height||130)-20,behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`colostrum-${width}-explanation.png`)});
  await page.locator('#ingredient-science').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`colostrum-${width}-research.png`)});
 }
 }finally{await context.close();}
});
for(const handle of supplements)test(`${handle}: distinct complete story and original assets`,async()=>{
 const {page,context}=await open(`/products/${handle}`);try{
 await inspect(page,`/products/${handle}`,390);
 assert.equal(await page.locator('h1').count(),1);
 assert.equal(await page.locator('.skin-application-steps li').count(),3);
 assert.ok(await page.locator('#product-formula').count());
 const order=await page.locator('#overview').evaluate(el=>[...el.children].map(e=>e.className));
 assert.match(order[0],/product-visual-gallery/);assert.match(order[2],/panel-info/);assert.match(order[3],/panel-buy/);
 const notes=await page.locator('.product-summary-description').boundingBox();const buy=await page.locator('.add-to-bag-row').boundingBox();assert.ok(notes.y<buy.y);
 assert.ok(Number.parseFloat((await page.locator('.product-summary-description').evaluate(e=>getComputedStyle(e).fontSize)))>=16);
 await page.getByRole('button',{name:'Read the complete directions & care'}).click();assert.equal(await page.getByRole('button',{name:'Read the complete directions & care'}).getAttribute('aria-expanded'),'true');
 await page.locator('#product-benefits').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`${handle}-390-story.png`)});
 }finally{await context.close();}
});
const skincare=JSON.parse(fs.readFileSync('lib/skincare-range.json','utf8'));
for(const product of skincare)test(`${product.id}: skincare preview stays complete and unavailable`,async()=>{
 const {page,context,errors}=await open(`/products/${product.id}`);try{
  await inspect(page,`/products/${product.id}`,390);assert.deepEqual(errors,[]);
  assert.equal(await page.getByRole('button',{name:'Not available to order yet'}).isDisabled(),true);
  assert.equal(await page.locator('.add-to-bag-row,.sticky-purchase').count(),0);
  assert.ok(await page.locator('#product-formula').count());
  await page.screenshot({path:path.join(out,`${product.id}-390-full.png`),fullPage:true});
 }finally{await context.close();}
});
for(const width of [320,760,761])test(`${width}: product and home containment`,async()=>{
 for(const route of ['/','/products/colostrum-powder','/collections/all','/help']){
 const {page,context}=await open(route,width);try{await inspect(page,route,width);await page.screenshot({path:path.join(out,`${route.replaceAll('/','_')||'home'}-${width}.png`)});}finally{await context.close();}
 }
});
for(const width of [390,1440])test(`skincare ${width}: frozen presentation, keyboard and pointer`,async()=>{
 const {page,context}=await open('/skincare',width);try{
 await page.locator('#skincare-results').scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 const slider=page.getByRole('slider');assert.equal(await slider.getAttribute('aria-valuenow'),'50');
 const capture=await page.locator('#skincare-results').screenshot({path:path.join(out,`final-slider-${width}.png`)});
 const baseline=fs.readFileSync(path.join(out,`baseline-slider-${width}.png`));
 const meta=await sharp(baseline).metadata();
 // Fractional section boundary blends with the following section in the last pixel row.
 // Compare every interior pixel; source/assets are separately byte-hash frozen.
 const frame={left:0,top:0,width:meta.width,height:meta.height-1};
 const actual=await sharp(capture).extract(frame).raw().toBuffer();
 const expected=await sharp(baseline).extract(frame).raw().toBuffer();
 assert.ok(actual.equals(expected),'every slider content pixel matches baseline');
 await slider.focus();await page.keyboard.press('ArrowRight');assert.equal(await slider.getAttribute('aria-valuenow'),'51');
 await page.keyboard.press('Home');assert.equal(await slider.getAttribute('aria-valuenow'),'0');await page.keyboard.press('End');assert.equal(await slider.getAttribute('aria-valuenow'),'100');
 const box=await page.locator('.skin-comparison').boundingBox();await page.mouse.click(box.x+box.width*.25,box.y+box.height*.4);assert.ok(Number(await slider.getAttribute('aria-valuenow'))<35);
 const choices=page.getByRole('group',{name:'Choose a skin detail'}).getByRole('button');await choices.nth(1).click();assert.equal(await slider.getAttribute('aria-valuenow'),'50');
 assert.equal(await page.locator('.skin-comparison-caption').innerText(),'Illustrative comparison. Not measured product results.');
 }finally{await context.close();}
});
test('mobile navigation, existing product search and gallery keyboard',async()=>{
 const {page,context}=await open('/');try{
 await page.getByRole('button',{name:'Open navigation'}).click();assert.ok(await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Search products'}).click();const input=page.getByRole('dialog').getByRole('textbox');await input.fill('colostrum');assert.ok(await page.getByRole('dialog').getByRole('link',{name:/colostrum/i}).count());await page.keyboard.press('Escape');
 await page.goto(base+'/products/colostrum-powder');const rail=page.getByRole('region',{name:/visual product guide/});await rail.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('button',{name:'View the product',exact:true}).getAttribute('aria-current'),'true');
 await page.getByRole('button',{name:/Enlarge formula focus/}).click();assert.ok(await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape');
 }finally{await context.close();}
});
test('200 percent text is actually enlarged and remains contained',async()=>{
 const {page,context}=await open('/products/colostrum-powder',390);try{
 const before=await page.locator('.product-summary-description').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 await page.evaluate(()=>{const es=[...document.querySelectorAll('main h1,main h2,main h3,main p,main li,main button,main a,main dt,main dd')];const sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=`${sizes[i]*2}px`);});
 const after=await page.locator('.product-summary-description').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.equal(after,before*2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.product-summary').evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-(document.querySelector('.store-header')?.getBoundingClientRect().height||130)-20,behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'colostrum-390-text-200.png')});
 }finally{await context.close();}
});
