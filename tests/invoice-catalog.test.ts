import {test} from 'node:test';
import assert from 'node:assert/strict';
import {products} from '../lib/catalog';
import {withComingSoonSkincareCards,comingSoonSkincareProduct,comingSoonSkincareDepartment} from '../lib/new-skincare';
import {isComingSoon,isOrderable} from '../lib/commerce-policy';
import {mapProduct} from '../lib/shopify';
import {readFileSync} from 'node:fs';
const ids=Object.keys(JSON.parse(readFileSync('tests/fixtures/approved-skincare-labels.json','utf8')));
const legacy=['anti-aging-cleanser-with-peptides','hydrating-tonic'];
test('all active surfaces share the exact ordered invoice eight, supplements preserved',()=>{
 assert.deepEqual(products.filter(p=>p.category==='skincare').map(p=>p.id),ids);
 assert.equal(products.filter(p=>p.category==='supplements').length,11);
 assert.deepEqual(withComingSoonSkincareCards(products),products);
 for(const mode of ['live','preview','unavailable'] as const)for(const id of ids){
  const p=comingSoonSkincareProduct({mode,products:[]},id)!;
  assert(p,id);assert.equal(isOrderable(p,'live'),false);assert.equal(p.pricePending,true);assert.deepEqual(p.variants,[]);
 }
});
test('known skincare and legacy handles stay held even if Shopify tags change',()=>{
 for(const id of [...ids,...legacy])for(const tags of [[],['iqon-supplements'],['iqon-skincare'],['iqon-supplements','iqon-skincare']]){
  assert.equal(isComingSoon({id,category:'supplements'}),true,id);
  assert.equal(mapProduct({handle:id,title:id,tags,productType:'Capsules',description:'',availableForSale:true,requiresSellingPlan:false,images:{nodes:[]},variants:{pageInfo:{hasNextPage:false},nodes:[{id:'fixture',title:'Default Title',availableForSale:true,price:{amount:'50',currencyCode:'USD'}}]}},0),null,id);
 }
});

test('all held direct routes retain skincare department without leaking into active navigation',()=>{
 for(const id of [...ids,...legacy]){assert.equal(comingSoonSkincareDepartment('/products/'+id),'skincare');assert.equal(comingSoonSkincareDepartment('/products/'+id+'/extra'),undefined);}
});
