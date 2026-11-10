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
