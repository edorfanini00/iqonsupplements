// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,afterEach,vi} from 'vitest';
afterEach(cleanup);
import {render,fireEvent,cleanup} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {products} from '../../lib/catalog';
import {newSkincareProducts,legacySkincareProduct} from '../../lib/new-skincare';
import {ProductPage} from '../../app/shop-pages';
vi.mock('../../app/store-shell',()=>({useStore:()=>({products:[],mode:'live',add:vi.fn(),ready:true}),ProductCard:({product}:any)=>React.createElement('a',{href:'/products/'+product.id},product.name),CartConnectionNotice:()=>null,Quantity:()=>null}));
vi.mock('../../app/customer-reviews',()=>({CustomerReviews:()=>null,ProductReviewLink:()=>null}));
import {SkincareProductStory} from '../../app/skincare-product-story';
const expected=JSON.parse(readFileSync('tests/fixtures/approved-skincare-labels.json','utf8'));
describe('approved label rendering',()=>{
 for(const [id,label] of Object.entries(expected) as [string,any][]){
  it(id+' complete lower panels and FAQ truth',()=>{
   const product=[...products,...newSkincareProducts].find(p=>p.id===id)!;
   const {getByRole,container}=render(React.createElement(SkincareProductStory,{product,comparison:[product]}));
   fireEvent.click(getByRole('button',{name:'Ingredients & formulation details'}));
   expect(container.textContent).toContain(label.ingredients);
   expect(container.textContent).not.toContain('Key ingredients are highlighted here. Refer to your product packaging');
   fireEvent.click(getByRole('button',{name:'Read the complete directions'}));
   expect(container.textContent).toContain(label.directions);
   if(label.warnings)expect(container.textContent).toContain(label.warnings);
   cleanup();
  });
 }
});

for(const id of ['anti-aging-cleanser-with-peptides','hydrating-tonic'])it(id+' legacy page is clearly unavailable with unchanged body',()=>{
 const {container}=render(React.createElement(ProductPage,{product:legacySkincareProduct(id)!}));
 expect(container.querySelector('.product-launch-note')?.textContent).toContain('Not part of the current range');
 expect(container.querySelector('.product-launch-note')?.textContent).not.toContain('on its way');
 expect(container.querySelector('.add-to-bag-row')).toBeNull();
});
for(const [id,label] of Object.entries(expected) as [string,any][])it(id+' top formula, use and current8 selector',()=>{
 const product=products.find(p=>p.id===id)!;
 const {getByRole,container}=render(React.createElement(ProductPage,{product}));
 fireEvent.click(getByRole('button',{name:'Ingredients & formulation',exact:true}));
 expect(container.querySelector('.product-accordion')?.textContent).toContain(label.ingredients);
 fireEvent.click(getByRole('button',{name:'How to use',exact:true}));
 expect(container.querySelector('.product-accordion')?.textContent).toContain(label.directions);
 if(label.warnings)expect(container.querySelector('.product-accordion')?.textContent).toContain(label.warnings);
 expect(getByRole('button',{name:'All skincare8'})).toBeTruthy();
 expect(container.querySelectorAll('a[href="/products/hydrating-tonic"],a[href="/products/anti-aging-cleanser-with-peptides"]').length).toBe(0);
});
