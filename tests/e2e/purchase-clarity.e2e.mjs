// Uses the production build with a synthetic server by default. QA_BASE selects an existing server.
// QA_REAL=1 adds ordinary image-delivery checks; it never substitutes images.
// Synthetic: FAKE_CATALOG=purchase-clarity and fake-shopify-hook.mjs. Real: authorized Storefront credentials.
// No tracking requests, contact data, payment, or hosted checkout navigation in this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {checkBundleKeyboard} from './bundle-keyboard.mjs';
const real=process.env.QA_REAL==='1';
const port=Number(process.env.E2E_PORT||3981);
const base=process.env.QA_BASE||(real?'http://localhost:3980':`http://localhost:${port}`);
const shots=process.env.E2E_SCREENSHOTS||'/tmp/iqon-purchase-clarity';
fs.mkdirSync(shots,{recursive:true});
let server;
if(!process.env.QA_BASE&&!real){
 const root=fileURLToPath(new URL('../..',import.meta.url));
 try{await fetch(base);throw new Error(`Port ${port} already in use`);}catch(error){if(error.message.includes('already in use'))throw error;}
 const log=fs.openSync(path.join(shots,'server.log'),'w');
 server=spawn(path.join(root,'node_modules/.bin/next'),['start','-H','127.0.0.1','-p',String(port)],{cwd:root,stdio:['ignore',log,log],env:{...process.env,NODE_ENV:'production',VERCEL_ENV:'production',FAKE_SHOPIFY:'live',FAKE_CATALOG:'purchase-clarity',SHOPIFY_STORE_DOMAIN:'iqon-test.myshopify.com',SHOPIFY_STOREFRONT_PRIVATE_TOKEN:'test-token',NODE_OPTIONS:`--import ${pathToFileURL(path.join(root,'tests/seo/fake-shopify-hook.mjs')).href}`}});
 process.on('exit',()=>server.kill('SIGTERM'));
 for(let i=0;;i++){try{if((await fetch(base)).status)break;}catch{}if(i===60)throw new Error('Synthetic preview did not start; see screenshot directory/server.log');await new Promise(r=>setTimeout(r,500));}
}
console.log(`Data source: ${real?'real Shopify catalog/cart':'synthetic catalog/cart'}; external tracking blocked.`);
const browser=await chromium.launch();
test.after(async()=>{await browser.close();server?.kill('SIGTERM');});
const handles=process.env.QA_CATALOG ? JSON.parse(fs.readFileSync(process.env.QA_CATALOG)).products.filter(p=>p.category==='supplements'&&p.available&&!p.requiresSellingPlan).map(p=>p.handle) : ['creatine-monohydrate','hydrolyzed-collagen-peptides','colostrum-powder','colon-gentle-cleanse'];
const widths=[320,390,430,1440];
async function open(width,handle){
 const context=await browser.newContext({viewport:{width,height:width===320?740:width===1440?900:844},reducedMotion:'reduce'});
 await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===base||(real&&u.hostname==='cdn.shopify.com')?r.continue():r.abort()});
 context.setDefaultTimeout(15000);
 const page=await context.newPage();
 await page.goto(`${base}/products/${handle}`);
 await page.locator('.add-to-bag-row .button:enabled').waitFor();
 return {page,context};
}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page must not overflow');}
async function rowFits(page,selector='.bag-sheet .cart-line'){
 const geometry=await page.locator(selector).evaluate(el=>{
  const row=el.getBoundingClientRect();
  return [...el.querySelectorAll('.quantity,strong,strong s,.remove-item')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,left:r.left,right:r.right,rowLeft:row.left,rowRight:row.right,width:r.width,scroll:e.scrollWidth,client:e.clientWidth}});
 });
 for(const r of geometry)assert.ok(r.left>=r.rowLeft-1&&r.right<=r.rowRight+1&&r.scroll<=r.client+1,JSON.stringify(r));
 const alignment=await page.locator(selector).evaluate(el=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}};
  return {row:rect(el),quantity:rect(el.querySelector('.quantity')),price:rect(el.querySelector('.bag-price')),current:rect(el.querySelector('.bag-price>span')),old:el.querySelector('.bag-price s')?rect(el.querySelector('.bag-price s')):null};
 });
 assert.ok(Math.abs(alignment.price.right-alignment.row.right)<1,'line price aligns to the row edge');
 assert.ok(alignment.quantity.right+7<=alignment.price.left,'quantity has its own column');
 assert.ok(Math.abs(alignment.quantity.bottom-alignment.current.bottom)<2,'quantity and current amount share a baseline');
 if(alignment.old)assert.ok(Math.abs(alignment.old.right-alignment.current.right)<1,'old and current amounts share the right edge');

}
for(const width of widths){
 for(const handle of handles){
  test(`${width} ${handle}: purchase precedes gallery, keyboard order, policy links, images and totals`,async()=>{
   const {page,context}=await open(width,handle);
   try{
    const structure=await page.locator('#overview').evaluate(el=>[...el.children].map(e=>e.className));
    assert.match(structure[0],/purchase-panel/);assert.match(structure[1],/product-visual-gallery/);assert.match(structure[2],/purchase-panel-details/);
    const gallery=await page.locator('.product-visual-gallery').boundingBox();
    const cta=await page.locator('.add-to-bag-row').boundingBox();
    if(width<761)assert.ok(cta.y+cta.height<=gallery.y,'phone purchase action must precede gallery');
    else assert.ok(gallery.x<cta.x,'desktop keeps gallery on left');
    assert.deepEqual(await page.locator('.purchase-assurance a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))),['/policies/shipping-policy','/policies/refund-policy']);
    assert.doesNotMatch(await page.locator('#overview').innerText(),/subscription|per month|renews/i);
    assert.equal(await page.locator('#reviews .review-stars').count(),0);
    assert.doesNotMatch(await page.locator('#reviews').innerText(),/after the collection launches/);
    await page.screenshot({path:path.join(shots,`${width}_${handle}_opening.png`)});
    if(real){
     await page.locator('.visual-pack img').first().scrollIntoViewIfNeeded();
     await page.waitForFunction(()=>{const i=document.querySelector('.visual-pack img');return i?.complete&&i.naturalWidth>0});
    }
    const price=Number((await page.locator('.product-title-row>span').innerText()).replace(/[^\d.]/g,''));
    for(const qty of [1,2,3,4,3,2,1]){
     const current=Number(await page.locator('.add-to-bag-row .quantity span').innerText());
     if(current!==qty)await page.locator(`.add-to-bag-row button[aria-label^="${qty>current?'Increase':'Decrease'}"]`).click();
     const percent=qty>=3?25:qty>=2?10:0;
     const total=(Math.round(price*100)-Math.floor(Math.round(price*100)*percent/100))*qty/100;
     const labels=await page.locator('.add-to-bag-row .button,.sticky-purchase .button').allTextContents();
     assert.equal(labels[0],labels[1]);assert.ok(labels[0].endsWith(total%1?`$${total.toFixed(2)}`:`$${total}`),`${qty}: ${labels[0]}`);
     assert.equal(await page.getByRole('radio',{name:new RegExp(`^Buy ${Math.min(qty,3)}`)}).getAttribute('aria-checked'),'true');
     await noOverflow(page);
     const priceBounds=await page.locator('.add-to-bag-row .button,.sticky-purchase .button').evaluateAll(buttons=>buttons.flatMap(button=>{
      const box=button.getBoundingClientRect();const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);const rows=[];
      while(walker.nextNode()){const range=document.createRange();range.selectNodeContents(walker.currentNode);for(const r of range.getClientRects())if(r.width>1)rows.push({text:walker.currentNode.textContent,left:r.left,right:r.right,buttonLeft:box.left,buttonRight:box.right});}return rows;
     }));
     for(const r of priceBounds)assert.ok(r.left>=r.buttonLeft&&r.right<=r.buttonRight,`complete CTA price: ${JSON.stringify(r)}`);
    }
    // Begin before the overview and let the browser choose every successive focus target.
    await page.locator('.product-switcher button').first().focus();
    const trace=[];let foundDetails=false;
    for(let i=0;i<60;i++){
     await page.keyboard.press('Tab');
     await page.waitForTimeout(50);
     const item=await page.evaluate(()=>{
      const e=document.activeElement;const r=e.getBoundingClientRect();const bar=document.querySelector('.sticky-purchase');const b=bar?.getBoundingClientRect();const style=getComputedStyle(e);
      return {zone:e.closest('.purchase-panel-details')?'details':e.closest('.purchase-panel')?'purchase':e.closest('.product-visual-gallery')?'gallery':'other',label:e.getAttribute('aria-label')||e.textContent?.slice(0,70),top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,barTop:bar&&getComputedStyle(bar).visibility!=='hidden'?b.top:innerHeight,ring:e.matches(':focus-visible')&&(style.outlineStyle!=='none'||style.boxShadow!=='none')};
     });
     if(item.zone==='other'){if(foundDetails)break;continue;}
     trace.push(item);
     assert.ok(item.ring,`focus ring: ${JSON.stringify(item)}`);
     assert.ok(item.top<item.barTop&&item.bottom>0,`focus visible: ${JSON.stringify(item)}`);
     if(item.height<200)assert.ok(item.bottom<=item.barTop+2,`sticky clearance: ${JSON.stringify(item)}`);
     if(item.zone==='details')foundDetails=true;
    }
    assert.ok(foundDetails,'keyboard reaches details');
    const zones=trace.map(t=>t.zone).filter((z,i,a)=>i===0||z!==a[i-1]);
    assert.deepEqual(zones,['purchase','gallery','details']);
    fs.writeFileSync(path.join(shots,`${width}_${handle}_focus.json`),JSON.stringify(trace,null,2));
    await page.screenshot({path:path.join(shots,`${width}_${handle}_focus.png`)});
    await checkBundleKeyboard(page,{loaded:width===390,evidence:path.join(shots,`${width}_${handle}_keyboard.json`)});
   }finally{await context.close()}
  });
 }
 test(`${width}: additional eligible product uses purchase-first DOM`,async()=>{
  const {page,context}=await open(width,'collagen-peptides-chocolate');try{
   assert.equal(await page.locator('.purchase-first').count(),1);
   assert.equal(await page.getByRole('radio').count(),3);
   assert.match(await page.locator('#overview> :first-child').getAttribute('class'),/purchase-panel/);
   await page.screenshot({path:path.join(shots,`${width}_control.png`)});
  }finally{await context.close()}
 });
 test(`${width}: mixed lines align on the review page`,async()=>{
  const {page,context}=await open(width,'collagen-peptides-chocolate');
  try{
   await page.getByRole('radio',{name:/^Buy 2/}).click();
   await page.locator('.add-to-bag-row .button').click();
   await page.locator('.bag-sheet .cart-line').waitFor();
   await page.locator('.bag-sheet .quantity button:enabled').first().waitFor();
   await page.keyboard.press('Escape');
   await page.goto(`${base}/products/${real?'colon-gentle-cleanse':'daily-travel-kit'}`);
   await page.locator('.add-to-bag-row .button:enabled').click();
   await page.locator('.bag-sheet .cart-line').nth(1).waitFor();
   await page.locator('.bag-sheet .quantity button:enabled').first().waitFor();
   await page.keyboard.press('Escape');await page.goto(`${base}/checkout`);
   await page.locator('.checkout-lines .cart-line').nth(1).waitFor();
   for(let i=1;i<=2;i++)await rowFits(page,`.checkout-lines .cart-line:nth-child(${i})`);
   assert.equal(await page.locator('.checkout-lines .bag-price s').count(),real?2:1);
   await noOverflow(page);
   await page.screenshot({path:path.join(shots,`${width}_mixed_review.png`),fullPage:true});
  }finally{
   const cart=await(await context.request.get(`${base}/api/cart`)).json();
   for(const item of [...(cart.items||[])].reverse()){
    const response=await context.request.post(`${base}/api/cart`,{headers:{Origin:base,'Content-Type':'application/json'},data:{action:'update',lineId:item.lineId,quantity:0}});
    assert.equal(response.status(),200,'clean up owned mixed cart');
   }
   await context.close();
  }
 });
 test(`${width}: both add buttons, bag 1/2/3/4/3/2/1, full cents, removal and no selling plans`,async()=>{
  const {page,context}=await open(width,'creatine-monohydrate');try{
   for(const selector of ['.add-to-bag-row .button','.sticky-purchase .button']){
    if(selector.startsWith('.sticky')){await page.locator('#reviews').scrollIntoViewIfNeeded();await page.locator(selector).waitFor({state:'visible'});}
    const response=page.waitForResponse(r=>r.url().endsWith('/api/cart')&&r.request().method()==='POST');
    await page.locator(selector).click();assert.equal((await response).status(),200);
    await page.locator('.bag-sheet .cart-line').waitFor();
    for(const qty of [1,2,3,4,3,2,1]){
     const current=Number(await page.locator('.bag-sheet .quantity span').innerText());
     if(current!==qty){const changed=page.waitForResponse(r=>r.url().endsWith('/api/cart')&&r.request().method()==='POST');await page.locator(`.bag-sheet button[aria-label^="${qty>current?'Increase':'Decrease'}"]`).click();assert.equal((await changed).status(),200);}
     await page.waitForFunction(n=>document.querySelector('.bag-sheet .quantity span')?.textContent===String(n)&&!document.querySelector('.bag-sheet .quantity button')?.disabled,qty);
     await rowFits(page);await noOverflow(page);
     const cart=await page.evaluate(async()=>await(await fetch('/api/cart')).json());
     assert.equal(cart.items[0].quantity,qty);assert.ok(cart.items.every(i=>i.purchase==='once'&&!i.sellingPlanId));
     const amount=await page.locator('.bag-sheet .cart-line-bottom strong').innerText();
     assert.ok(amount.replaceAll('\n','').endsWith(cart.subtotal%1?`$${cart.subtotal.toFixed(2)}`:`$${cart.subtotal}`));
     if(qty===3)await page.screenshot({path:path.join(shots,`${width}_${selector.includes('sticky')?'sticky':'inline'}_bag_three.png`)});
    }
    if(real)await page.waitForFunction(()=>[...document.querySelectorAll('.bag-sheet .cart-line img')].every(i=>i.complete&&i.naturalWidth>0));
    await page.locator('.bag-sheet .remove-item').focus();await page.keyboard.press('Enter');await page.locator('.empty-bag').waitFor();await page.keyboard.press('Escape');
   }
  }finally{await context.close()}
 });
}
