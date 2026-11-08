// Read-only initial-load measurement with actual assets and tracking blocked.
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch();const results=[];
for(const width of [390,761,1440])for(const route of ['/','/collections/supplements','/products/colostrum-powder','/approach','/help']){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.route(/facebook/,r=>r.abort());await context.addInitScript(()=>{Object.defineProperty(navigator,'globalPrivacyControl',{value:true});window.shifts=[];new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)window.shifts.push({value:e.value,time:e.startTime,sources:e.sources.map(s=>({tag:s.node?.tagName,class:s.node?.className,before:s.previousRect,after:s.currentRect}))});})).observe({type:'layout-shift',buffered:true});});const page=await context.newPage();await page.goto('http://localhost:3987'+route);await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');await page.waitForTimeout(300);results.push({route,width,...await page.evaluate(()=>({cls:window.shifts.reduce((s,e)=>s+e.value,0),shifts:window.shifts,fonts:document.fonts.check('16px Inter'),paints:performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime}))}))});await context.close();
}
fs.writeFileSync('docs/qa/premium-site/first-paint.json',JSON.stringify(results,null,2));console.log(results.map(({route,width,cls})=>({route,width,cls})));await browser.close();
