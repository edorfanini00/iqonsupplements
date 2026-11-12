// @vitest-environment jsdom
// Help, the collection headers and the /skincare hero render skincare wording from the catalog they are given.
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {launchedSkincareProduct,withComingSoonSkincareCards} from '../../lib/new-skincare';
import {activeSkincareIds} from '../../lib/skincare-identity';
import type {Product} from '../../lib/catalog';

const store=vi.hoisted(()=>({value:{mode:'live',products:[] as unknown[]}}));
vi.mock('../../app/store-shell',()=>({useStore:()=>store.value,ProductCard:({product}:{product:{id:string}})=>React.createElement('article',{'data-id':product.id})}));
vi.mock('../../app/editorial',()=>({HumanStory:()=>null}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:()=>{}})}));
const {HelpQuestions}=await import('../../app/help/help-questions');
const {CollectionPage}=await import('../../app/collection-page');
const {CampaignHero}=await import('../../app/campaign-hero');
const {skincareAvailability}=await import('../../lib/skincare-copy');
afterEach(cleanup);

const supplement={id:'creatine-monohydrate',number:'01',name:'Creatine Monohydrate',category:'supplements',type:'Powder',descriptor:'Synthetic',description:'Synthetic',size:'281 g',price:48.97,currency:'USD',image:'/x.webp',tone:'silver',campaign:'/x.webp',available:true,variants:[{id:'gid://shopify/ProductVariant/1',title:'Default Title',price:48.97,currency:'USD',available:true}]} as unknown as Product;
const launched=(id:string,i:number)=>launchedSkincareProduct({handle:id,productId:`gid://shopify/Product/99${i}`,variantId:`gid://shopify/ProductVariant/99${i}`,title:'Default Title',price:55,currency:'USD',quantityAvailable:28})!;
const catalog=(ids:readonly string[])=>withComingSoonSkincareCards([supplement,...ids.map((id,i)=>launched(id,i))]);
const set=(mode:string,products:Product[])=>{store.value={mode,products};};
const storeAnswer=()=>{fireEvent.click(screen.getByText('Where can I buy IQON products?'));return screen.getByText(/online store is/).closest('[data-slot=accordion-content]')!;};
const links=(el:Element)=>[...el.querySelectorAll('a')].map(a=>[a.textContent,a.getAttribute('href')]);
const subtitle=(c:HTMLElement)=>c.querySelector('.catalog-heading p:last-child')!.textContent;

it('live: Help links both collections without coming soon wording',()=>{
 set('live',catalog(activeSkincareIds));render(React.createElement(HelpQuestions));
 const a=storeAnswer();
 expect(a.textContent).toBe('IQON’s online store is www.iqondaily.com. Browse current products in the supplements collection and the skincare collection.');
 expect(links(a)).toEqual([['www.iqondaily.com','https://www.iqondaily.com/'],['supplements collection','/collections/supplements'],['skincare collection','/collections/skincare']]);
 expect(a.textContent).not.toMatch(/coming soon|not available/i);
});
it('partial (Review B N2): Help still links both collections when one product is held',()=>{
 set('live',catalog(activeSkincareIds.filter(id=>id!=='retinol-rx')));render(React.createElement(HelpQuestions));
 const a=storeAnswer();
 expect(a.textContent).toBe('IQON’s online store is www.iqondaily.com. Browse current products in the supplements collection and the skincare collection.');
 expect(links(a)).toEqual([['www.iqondaily.com','https://www.iqondaily.com/'],['supplements collection','/collections/supplements'],['skincare collection','/collections/skincare']]);
});
it('held: Help says skincare is unavailable right now and links supplements only',()=>{
 set('live',catalog([]));render(React.createElement(HelpQuestions));
 const a=storeAnswer();
 expect(a.textContent).toBe('IQON’s online store is www.iqondaily.com. Browse current products in the supplements collection. IQON skincare isn’t available to order right now.');
 expect(a.textContent).not.toMatch(/coming soon|\byet\b/i);
 expect(links(a).map(l=>l[1])).toEqual(['https://www.iqondaily.com/','/collections/supplements']);
});
it('preview mode: Help copy is the unchanged design preview set',()=>{
 set('preview',catalog(activeSkincareIds));render(React.createElement(HelpQuestions));
 expect(screen.queryByText('Where can I buy IQON products?')).toBeNull();
 expect(screen.getByText('Can I place an order?')).toBeTruthy();
});

it('live: skincare and all-products headers and the department link describe skincare as shoppable',()=>{
 set('live',catalog(activeSkincareIds));
 const skin=render(React.createElement(CollectionPage,{category:'skincare'})).container;
 expect(subtitle(skin)).toBe('Cleanse. Treat. Moisturize. Ready to order now.');
 expect(skin.querySelectorAll('article')).toHaveLength(8);
 cleanup();
 const all=render(React.createElement(CollectionPage,{category:'all'})).container;
 expect(subtitle(all)).toBe('Shop IQON supplements and skincare, ready to order now.');
 expect([...all.querySelectorAll('.catalog-departments a')].map(a=>a.textContent)).toEqual(['Supplements','Skincare']);
 expect(all.querySelector('.catalog-heading')!.textContent).not.toMatch(/coming soon|ahead of launch|preview/i);
});
it('partial (Review B N2): exact skincare and all-products subtitles and department links',()=>{
 set('live',catalog(activeSkincareIds.filter(id=>id!=='retinol-rx')));
 expect(subtitle(render(React.createElement(CollectionPage,{category:'skincare'})).container)).toBe('Some skincare products aren’t available to order right now.');
 cleanup();
 const all=render(React.createElement(CollectionPage,{category:'all'})).container;
 expect(subtitle(all)).toBe('Supplements and skincare are available to order now. Some skincare products aren’t available right now.');
 expect([...all.querySelectorAll('.catalog-departments a')].map(a=>a.textContent)).toEqual(['Supplements','Skincare']);
});
it('held live store: neutral wording, no coming soon or preview',()=>{
 set('live',catalog([]));
 expect(subtitle(render(React.createElement(CollectionPage,{category:'skincare'})).container)).toBe('Skincare isn’t available to order right now.');
 cleanup();
 const all=render(React.createElement(CollectionPage,{category:'all'})).container;
 expect(subtitle(all)).toBe('Supplements are available to order now. Skincare isn’t available to order right now.');
 expect([...all.querySelectorAll('.catalog-departments a')].map(a=>a.textContent)).toEqual(['Supplements','Skincare']);
 expect(all.querySelector('.catalog-heading')!.textContent).not.toMatch(/coming soon|ahead of launch|preview|\byet\b/i);
});
it('preview store: collection copy is byte-identical to main',()=>{
 // A real preview catalog carries only informational skincare cards (no launched records).
 for(const products of [catalog([]),withComingSoonSkincareCards([])]){
  set('preview',products);
  expect(subtitle(render(React.createElement(CollectionPage,{category:'skincare'})).container)).toBe('Coming soon. Explore the collection ahead of launch.');
  cleanup();
  const all=render(React.createElement(CollectionPage,{category:'all'})).container;
  expect(subtitle(all)).toBe('Find your everyday essentials.');
  expect([...all.querySelectorAll('.catalog-departments a')].map(a=>a.textContent)).toEqual(['Supplements','Skincare preview']);
  cleanup();
 }
});
it('/skincare hero eyebrow keeps "Coming soon" only in the preview store',()=>{
 const eyebrow=(products:Product[],mode:string)=>{const c=render(React.createElement(CampaignHero,{skincare:true,skincareState:skincareAvailability(products,mode)})).container.querySelector('.eyebrow')!.textContent;cleanup();return c;};
 expect(eyebrow(catalog(activeSkincareIds),'live')).toBe('IQON / SKINCARE');
 expect(eyebrow(catalog(activeSkincareIds.filter(id=>id!=='retinol-rx')),'live')).toBe('IQON / SKINCARE');
 expect(eyebrow(catalog([]),'live')).toBe('IQON / SKINCARE');
 expect(eyebrow(catalog(activeSkincareIds),'preview')).toBe('IQON / SKINCARE / COMING SOON');
 expect(render(React.createElement(CampaignHero)).container.querySelector('.eyebrow')!.textContent).toBe('IQON / DAILY ESSENTIALS');
});

const SUPPLEMENT_BUNDLE='Yes. Buy 2 eligible IQON supplements and save 10%, or buy 3 or more and save 25%. You can mix and match: every eligible supplement in your bag counts. Savings apply automatically in your bag and at checkout and can’t be combined with discount codes.';
const bundleAnswer=()=>{fireEvent.click(screen.getByText('Do you offer bundle savings?'));return screen.getByText(/^Yes\. Buy 2 eligible IQON supplements/).textContent;};
it('live: Help bundle answer keeps the supplement sentence and adds the skincare bundle',()=>{
 set('live',catalog(activeSkincareIds));render(React.createElement(HelpQuestions));
 expect(bundleAnswer()).toBe(`${SUPPLEMENT_BUNDLE} Skincare has its own bundle: buy 2 IQON skincare products and save 10%, or buy 3 or more and save 15%. Mix and match any IQON skincare. Supplements and skincare are counted separately. Savings apply automatically in your bag and at checkout.`);
});
it('partial: one held product still shows the skincare bundle',()=>{
 set('live',catalog(activeSkincareIds.filter(id=>id!=='retinol-rx')));render(React.createElement(HelpQuestions));
 expect(bundleAnswer()).toContain('Skincare has its own bundle');
});
it('held: Help bundle answer is the supplement sentence only',()=>{
 set('live',catalog([]));render(React.createElement(HelpQuestions));
 expect(bundleAnswer()).toBe(SUPPLEMENT_BUNDLE);
});
