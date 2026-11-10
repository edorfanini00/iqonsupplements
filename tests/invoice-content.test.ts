import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import oldRange from '../lib/skincare-range.json';
import newRange from '../lib/new-skincare-range.json';
const expected=JSON.parse(readFileSync('tests/fixtures/approved-skincare-labels.json','utf8'));
test('every approved label has exact ordered INCI and complete directions',()=>{
 for(const [id,label] of Object.entries(expected) as [string,any][]){
  const actual=[...oldRange,...newRange].find(p=>p.id===id) as any;
  assert.equal(actual?.inci,label.ingredients,id+' INCI');
  assert.equal(actual.directions,[label.directions,label.warnings].filter(Boolean).join(' '),id+' directions and warnings');
 }
});

import {productContent} from '../lib/product-content';
import {skincareVisualContent} from '../lib/skincare-visual-content';
test('FAQ complete directions and brief routine remain coherent',()=>{
 for(const [id,label] of Object.entries(expected) as [string,any][]){
  const faq=productContent[id].faqs.find(q=>q.question==='How do I use it?');
  assert(faq?.answer.includes(label.directions),id);
 }
 assert.match(JSON.stringify(skincareVisualContent['retinol-rx'].steps),/3-4 times per week/);
 assert.match(JSON.stringify(skincareVisualContent['hydra-c-ferulic-serum'].steps),/Once absorbed/);
 assert.match(JSON.stringify(skincareVisualContent['copper-peptide-restore-cream'].steps),/twice daily/);
});


import {productPresentation} from '../lib/product-presentation';
import {productVisuals} from '../lib/product-visuals';
const attribution='Retinol strength as stated by the formulating laboratory.';
test('Retinol Rx discloses supplier strength in summary, key fact and ingredient copy',()=>{
 const retinol=oldRange.find(p=>p.id==='retinol-rx')!;
 assert.match(retinol.description,/0\.75% encapsulated retinol/);
 assert.match(retinol.ingredients,/0\.75% encapsulated retinol/);
 assert.match(productVisuals['retinol-rx'].lead,/0\.75% encapsulated retinol/);
 assert.equal(productVisuals['retinol-rx'].lead.split(attribution).length-1,1);
 assert.equal(productPresentation['retinol-rx'].fact,'0.75%');
 assert.equal(productPresentation['retinol-rx'].factLabel,'encapsulated retinol');
 assert.match(skincareVisualContent['retinol-rx'].ingredients[0].summary,/0\.75% encapsulated retinol/);
 assert.doesNotMatch(retinol.inci,/0\.75%/);
});
test('strength and attribution are confined to Retinol Rx content',()=>{
 for(const p of [...oldRange,...newRange])if(p.id!=='retinol-rx')assert.doesNotMatch(JSON.stringify(p),/0\.75%|Retinol strength as stated/);
 for(const contentMap of [productVisuals,productPresentation,skincareVisualContent,productContent]){
  for(const [id,content] of Object.entries(contentMap))if(id!=='retinol-rx')assert.doesNotMatch(JSON.stringify(content),/0\.75%|Retinol strength as stated/,id);
 }
});

import {execFileSync} from 'node:child_process';
import {comingSoonSkincareProduct} from '../lib/new-skincare';
test('resolved PDP descriptions include Retinol strength and preserve Hyaluronic Serum against PR base',()=>{
 const catalog={mode:'unavailable' as const,products:[]};
 const retinol=comingSoonSkincareProduct(catalog,'retinol-rx')!;
 assert.equal(retinol.description,'A 0.75% encapsulated retinol serum with niacinamide and squalane. An evening treatment for the appearance of fine lines and uneven texture.');
 assert.match(retinol.description!,/0\.75% encapsulated retinol/);
 const base=JSON.parse(execFileSync('git',['show','df9757495ce39135dee0a6fc15bb2a7ae557da0c:lib/new-skincare-range.json'],{encoding:'utf8'}));
 assert.equal(comingSoonSkincareProduct(catalog,'hyaluronic-serum')!.description,base.find((p:any)=>p.id==='hyaluronic-serum').description);
});
