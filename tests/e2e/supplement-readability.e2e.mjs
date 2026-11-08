// Run against a completed local production build: node --import tsx --test ...
// Actual table text ranges, not just page containment. External requests blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from 'playwright-core';
import {supplementDetails} from '../../lib/supplement-details.ts';
import {SupplementFormula} from '../../app/supplement-information.tsx';
// tsx uses the repository's preserve JSX setting for these server-rendered fixtures.
globalThis.React=React;
const base=process.env.QA_BASE||'http://localhost:3987';
const out=process.env.E2E_SCREENSHOTS||'/tmp/iqon-supplement-readability';
const labels=JSON.parse(fs.readFileSync('lib/verified-label-data.json','utf8'));
const handles=process.env.QA_HANDLES?.split(',')||Object.keys(labels);
const widths=(process.env.QA_WIDTHS||'320,390,1440').split(',').map(Number);
const results=[];
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
test.after(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();});
async function open(handle,width){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const page=await context.newPage();
 assert.equal((await page.goto(`${base}/products/${handle}`)).status(),200);
 await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
 return {page,context};
}
async function inspect(table,scale){
 // Snapshot all computed sizes first so nested notes are exactly 2x, not 4x.
 const sizes=await table.evaluate(t=>[...t.querySelectorAll('caption,th,td,small')].map(e=>parseFloat(getComputedStyle(e).fontSize)));
 if(scale===2)await table.evaluate(t=>{const es=[...t.querySelectorAll('caption,th,td,small')];const sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=`${sizes[i]*2}px`);});
 const after=await table.evaluate(t=>[...t.querySelectorAll('caption,th,td,small')].map(e=>parseFloat(getComputedStyle(e).fontSize)));
 assert.deepEqual(after,sizes.map(n=>n*scale),'actual computed font scale including notes');
 await table.scrollIntoViewIfNeeded();
 return table.evaluate(t=>{
  const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
  const bounds=box(t),texts=[],cells=[],brokenWords=[];
  for(const [rowIndex,row]of [...t.rows].entries())for(const [colIndex,cell]of [...row.cells].entries()){
   const bounds=box(cell),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
   cells.push({row:rowIndex,col:colIndex,text:cell.textContent,bounds,font:getComputedStyle(cell).fontSize});
   while(walker.nextNode()){
    if(!walker.currentNode.textContent.trim())continue;
    const range=document.createRange();range.selectNodeContents(walker.currentNode);
    if(colIndex>0)for(const word of walker.currentNode.textContent.matchAll(/\S+/g)){
     const part=document.createRange();part.setStart(walker.currentNode,word.index);part.setEnd(walker.currentNode,word.index+word[0].length);
     if([...part.getClientRects()].filter(r=>r.width>0).length>1)brokenWords.push({row:rowIndex,col:colIndex,word:word[0]});
    }
    for(const rect of range.getClientRects())if(rect.width>0)texts.push({row:rowIndex,col:colIndex,text:walker.currentNode.textContent,bounds,...box({getBoundingClientRect:()=>rect})});
   }
  }
  const overlaps=[],clipped=[];
  for(let i=0;i<texts.length;i++){
   const x=texts[i];
   if(x.left<x.bounds.left-1||x.right>x.bounds.right+1||x.top<x.bounds.top-1||x.bottom>x.bounds.bottom+1||x.left<bounds.left-1||x.right>bounds.right+1)clipped.push(x);
   for(let j=i+1;j<texts.length;j++){
    const y=texts[j];if(x.row===y.row&&x.col===y.col)continue;
    if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlaps.push({x,y});
   }
  }
  return {bounds,cells,overlaps,clipped,brokenWords,pageOverflow:document.documentElement.scrollWidth-innerWidth};
 });
}
for(const width of widths)for(const handle of handles)test(`${handle} ${width}: both label locations, normal and 200% text`,async t=>{
 const {page,context}=await open(handle,width);
 try{
  for(const location of ['opening','story']){
   await page.getByRole('button',{name:location==='opening'?'Ingredients & listed amounts':'Ingredients, listed amounts & allergen details',exact:true}).click();
   const formula=page.locator((location==='opening'?'.product-accordion':'.skin-formulation-accordion')+' .supplement-formula');
   for(const mode of ['verified','fallback']){
    // Fallback is a real component render inserted into the same built CSS/context;
    // it is a synthetic no-recovered-label fixture, not a production route claim.
    if(mode==='fallback'){
     const html=renderToStaticMarkup(React.createElement(SupplementFormula,{details:supplementDetails[handle]}));
     await formula.evaluate((el,html)=>el.outerHTML=html,html);
     if(!supplementDetails[handle].amounts){assert.equal(await formula.locator('table').count(),0);continue;}
    }
    const table=formula.locator('table');
    const records=mode==='verified'?labels[handle].nutrition:supplementDetails[handle].amounts;
    assert.equal(await table.getByRole('row').count(),records.length+1);
    assert.equal(await table.getByRole('columnheader').count(),mode==='verified'?3:2);
    if(mode==='verified')assert.match(await table.ariaSnapshot(),/table "Label amounts per serving"/);
    for(const scale of [1,2])await t.test(`${location} ${mode} ${scale}x`,async()=>{
     const measure=await inspect(table,scale);
     results.push({handle,width,location,mode,scale,...measure});
     for(const [i,record]of records.entries()){
      const row=measure.cells.filter(c=>c.row===i+1);
      assert.equal(row[0].text,mode==='verified'?record.name+(record.note||''):record.ingredient+(record.detail||''));
      assert.equal(row[1].text,record.amount);
      if(mode==='verified')assert.equal(row[2].text,record.dailyValue||'Not listed');
     }
     // Hide only sticky chrome for table close-ups; geometry is measured unmodified above.
     await table.screenshot({path:path.join(out,`${handle}-${width}-${location}-${mode}-${scale}x.png`),style:'.store-header,.pdp-section-nav,.skip-link{visibility:hidden!important}'});
     assert.deepEqual(measure.overlaps,[],'no cell text overlaps, including adjacent rows');
     assert.deepEqual(measure.clipped,[],'all text remains inside its cell and table');
     if(mode==='verified')assert.deepEqual(measure.brokenWords,[],'amounts and Daily Values wrap at word boundaries');
     assert.ok(measure.pageOverflow<=1,'no page overflow');
    });
   }
  }
 }finally{await context.close();}
});
for(const width of widths)for(const handle of ['colostrum-powder','creatine-monohydrate','hair-skin-nails-gummies'])test(`${handle} ${width}: opening gap, type and gallery order`,async()=>{
 const {page,context}=await open(handle,width);
 try{
  const m=await page.evaluate(()=>{
   const size=document.querySelector('.product-size'),desc=document.querySelector('.product-summary-description');
   return {gap:desc.getBoundingClientRect().top-size.getBoundingClientRect().bottom,font:parseFloat(getComputedStyle(desc).fontSize),order:[...document.querySelector('#overview').children].map(e=>e.className)};
  });
  results.push({handle,width,opening:m});
  await page.locator('.product-summary').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,`${handle}-${width}-opening.png`)});
  if(width<761){assert.ok(m.gap>=12&&m.gap<=20,`actual size/description gap ${m.gap}`);assert.equal(m.font,16);}else assert.equal(m.font,17);
  assert.match(m.order[0],/product-visual-gallery/);assert.match(m.order[2],/panel-info/);assert.match(m.order[3],/panel-buy/);
 }finally{await context.close();}
});
for(const width of widths)test(`GLP-1 ${width}: selected caption and expanded detail agree`,async()=>{
 const {page,context}=await open('glp-1-support',width);
 try{
  const button=page.getByRole('button',{name:/Explore LactoSpore/});await button.click();
  for(const el of [button,page.getByRole('region',{name:'Ingredient spotlight'})]){
   const copy=await el.textContent();assert.match(copy,/166 mg/);assert.match(copy,/6 billion CFU/);assert.doesNotMatch(copy,/does not provide a CFU|not a viable count/);
  }
  assert.match(await button.textContent(),/does not specify whether the count applies at manufacture or through expiry/);
  if(width===1440)assert.ok(await button.locator('.skin-ingredient-summary').isVisible());
  assert.ok(await page.getByRole('region',{name:'Ingredient spotlight'}).isVisible());
  await page.locator('.supplement-explorer').screenshot({path:path.join(out,`glp-1-${width}-selected.png`)});
 }finally{await context.close();}
});
