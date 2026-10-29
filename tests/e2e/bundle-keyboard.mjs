import assert from 'node:assert/strict';
import fs from 'node:fs';

// Every key is released after a fixed duration, independently of React/focus state.
export async function checkBundleKeyboard(page,{evidence,loaded=false,delays=[30,50]}={}) {
 const results=[];
 const price=Number((await page.locator('.product-title-row>span').innerText()).replace(/[^\d.]/g,''));
 await page.evaluate(loaded=>{
  window.bundleKeyEvents=[];
  for(const type of ['keydown','keyup','focusin'])document.addEventListener(type,e=>{
   window.bundleKeyEvents.push({type,key:e.key,value:e.target.value,time:performance.now()});
  },true);
  if(loaded)window.addEventListener('keydown',()=>{
   // Queue real main-thread work before the widget's deferred focus task.
   setTimeout(()=>{const until=performance.now()+120;while(performance.now()<until){}},0);
  },true);
 },loaded);
 try {
  for(const delay of delays) {
   await page.getByRole('radio',{name:/^Buy 1/}).click();
   for(const [key,quantity] of [['ArrowDown',2],['ArrowRight',3],['ArrowDown',1],['ArrowUp',3],['ArrowLeft',2],['Home',1],['End',3],['Home',1]]) {
    await page.evaluate(()=>window.bundleKeyEvents=[]);
    await page.keyboard.press(key,{delay});
    // Settle AFTER release; never wait for selection while holding the key.
    await page.waitForTimeout(200);
    const state=await page.evaluate(()=>({focused:document.activeElement.value,checked:[...document.querySelectorAll('.bundle-choices [role=radio][aria-checked=true]')].map(e=>e.value),quantity:document.querySelector('.add-to-bag-row .quantity span').textContent,labels:[...document.querySelectorAll('.add-to-bag-row .button,.sticky-purchase .button')].map(e=>e.textContent),events:window.bundleKeyEvents}));
    results.push({key,delay,loaded,expectedQuantity:quantity,...state});
    assert.equal(state.focused,String(quantity),JSON.stringify(results.at(-1)));
    assert.deepEqual(state.checked,[String(quantity)],JSON.stringify(results.at(-1)));
    assert.equal(state.quantity,String(quantity));
    const percent=quantity===3?25:quantity===2?10:0;
    const total=(Math.round(price*100)-Math.floor(Math.round(price*100)*percent/100))*quantity/100;
    assert.equal(state.labels[0],state.labels[1]);
    assert.ok(state.labels[0].endsWith(total%1?`$${total.toFixed(2)}`:`$${total}`),JSON.stringify(results.at(-1)));
    assert.ok(state.events.some(e=>e.type==='keyup'&&e.key===key),'keyup occurred before assertions');
   }
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.bundle-choices'))),false,'Tab exits the group');
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.value),'1','Shift+Tab returns to the selected radio');
  }
 } finally {if(evidence)fs.writeFileSync(evidence,JSON.stringify(results,null,2));}
}
