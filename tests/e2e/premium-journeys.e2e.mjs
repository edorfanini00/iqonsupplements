// Isolated Shopify fixture, actual local assets. No orders, emails or tracking requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const base=process.env.QA_BASE||'http://localhost:3990';
const out=process.env.E2E_SCREENSHOTS||'docs/qa/premium-site/real-assets-commerce';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();test.after(()=>browser.close());
async function open(route,width=390){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
 await context.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const page=await context.newPage();await page.goto(base+route);await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);return {page,context};
}
test('collection formats, search, empty state, clearing and sort remain functional',async()=>{
 const {page,context}=await open('/collections/supplements');try{
 const all=await page.locator('.product-card').count();assert.ok(all>=11);
 assert.match(await page.locator('.product-card').filter({has:page.getByRole('heading',{name:'Creatine Monohydrate',exact:true})}).locator('.product-card-info').innerText(),/281 g/);
 await page.getByRole('searchbox',{name:'Find a product'}).fill('colostrum');assert.equal(await page.locator('.product-card').count(),1);
 await page.getByRole('searchbox',{name:'Find a product'}).fill('no-such-formula');assert.equal(await page.locator('.product-card').count(),0);
 await page.getByRole('button',{name:'Show all products',exact:true}).click();assert.equal(await page.locator('.product-card').count(),all);
 const formats=page.getByRole('navigation',{name:'Shop by format'});await formats.getByRole('link',{name:'Powders',exact:true}).click();await page.waitForURL(/format=powder/);
 assert.ok((await page.locator('.product-card-info').allTextContents()).every(t=>/Powder/.test(t)));
 await page.getByRole('link',{name:/Show all products/}).click();await page.waitForURL(/supplements$/);
 await page.getByRole('combobox',{name:'Sort products'}).click();await page.getByRole('option',{name:'Name: A to Z',exact:true}).click();await page.waitForURL(/sort=name/);
 const names=await page.locator('.product-card h3').allTextContents();assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b)));
 await page.screenshot({path:`${out}/collection-filter-sort-390.png`,fullPage:true});
 }finally{await context.close();}
});
test('live Help prioritizes order tasks and links existing account and policies',async()=>{
 const {page,context}=await open('/help');try{
 const buttons=page.locator('[data-slot=accordion-trigger]');assert.equal(await buttons.first().innerText(),'Where can I track my order?');
 assert.equal(await page.getByRole('link',{name:'Open your account'}).getAttribute('href'),'/account');
 await page.getByRole('button',{name:'My order is damaged or incorrect. What should I do?'}).click();assert.equal(await page.getByRole('link',{name:'refund policy',exact:true}).first().getAttribute('href'),'/policies/refund-policy');
 await page.screenshot({path:`${out}/help-live-390.png`,fullPage:true});
 }finally{await context.close();}
});
for(const width of [390,1440])test(`live product ${width}: purpose, serving price, sticky behavior and actual images`,async()=>{
 const {page,context}=await open('/products/creatine-monohydrate',width);try{
 await page.locator('.add-to-bag-row .button:enabled').waitFor();
 assert.match(await page.locator('.visual-pack img').getAttribute('src'),/localhost:3991\/images\/supplements\/00_pack_creatine\.webp$/);
 await page.waitForFunction(()=>{const i=document.querySelector('.visual-pack img');return i.complete&&i.naturalWidth>0;});
 const info=await page.locator('.purchase-panel-info').innerText();assert.match(info,/1 scoop \(5\.6 g\)/);assert.match(info,/50 servings/);assert.match(info,/\/ serving/);assert.doesNotMatch(info,/50.day/);
 assert.equal(await page.locator('.sticky-purchase').getAttribute('class'),'sticky-purchase inline-cta-in-view');
 const purpose=await page.locator('.product-summary-description').boundingBox();const price=await page.locator('.product-current-price').boundingBox();const buy=await page.locator('.bundle-choices').boundingBox();assert.ok(purpose.y<price.y&&price.y<buy.y);
 await page.locator('.product-summary-description').evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-(document.querySelector('.store-header')?.getBoundingClientRect().height||130)-20,behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:`${out}/creatine-value-${width}.png`});
 await page.locator('#ingredient-science').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForFunction(()=>!document.querySelector('.sticky-purchase').classList.contains('inline-cta-in-view'));assert.equal(await page.locator('.sticky-purchase.inline-cta-in-view').count(),0);
 const cta=await page.locator('.sticky-purchase button').boundingBox();assert.ok(cta.y>=0&&cta.y+cta.height<=900);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
 }finally{await context.close();}
});
test('200 percent product text also contains live bundle controls',async()=>{
 const {page,context}=await open('/products/colostrum-powder');try{
 await page.locator('.add-to-bag-row .button:enabled').waitFor();
 await page.evaluate(()=>{const es=[...document.querySelectorAll('main h1,main h2,main h3,main p,main li,main button,main a,main dt,main dd')];const sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=`${sizes[i]*2}px`);});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.bundle-choices').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`${out}/colostrum-bundle-text-200.png`});
 }finally{await context.close();}
});
