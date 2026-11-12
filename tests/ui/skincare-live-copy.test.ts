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
it('held: Help keeps the previous answer and links supplements only',()=>{
 set('live',catalog([]));render(React.createElement(HelpQuestions));
 const a=storeAnswer();
 expect(a.textContent).toBe('IQON’s online store is www.iqondaily.com. Browse current products in the supplements collection. IQON skincare is coming soon and is not available to order yet.');
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
it('partial: a held product keeps an honest note; held: previous copy is unchanged',()=>{
 set('live',catalog(activeSkincareIds.filter(id=>id!=='retinol-rx')));
 expect(subtitle(render(React.createElement(CollectionPage,{category:'skincare'})).container)).toBe('Shop skincare now. A few products are still coming soon.');
 cleanup();
 set('live',catalog([]));
 expect(subtitle(render(React.createElement(CollectionPage,{category:'skincare'})).container)).toBe('Coming soon. Explore the collection ahead of launch.');
 cleanup();
 const all=render(React.createElement(CollectionPage,{category:'all'})).container;
 expect(subtitle(all)).toBe('Supplements are available to order now. Skincare is shown as a preview and can’t be ordered yet.');
 expect([...all.querySelectorAll('.catalog-departments a')].map(a=>a.textContent)).toEqual(['Supplements','Skincare preview']);
 cleanup();
 set('preview',catalog(activeSkincareIds));
 expect(subtitle(render(React.createElement(CollectionPage,{category:'skincare'})).container)).toBe('Coming soon. Explore the collection ahead of launch.');
});
it('/skincare hero eyebrow drops "Coming soon" only when skincare is orderable',()=>{
 const eyebrow=(products:Product[],mode:string)=>{const c=render(React.createElement(CampaignHero,{skincare:true,skincareState:skincareAvailability(products,mode)})).container.querySelector('.eyebrow')!.textContent;cleanup();return c;};
 expect(eyebrow(catalog(activeSkincareIds),'live')).toBe('IQON / SKINCARE');
 expect(eyebrow(catalog([]),'live')).toBe('IQON / SKINCARE / COMING SOON');
 expect(eyebrow(catalog(activeSkincareIds),'preview')).toBe('IQON / SKINCARE / COMING SOON');
 expect(render(React.createElement(CampaignHero)).container.querySelector('.eyebrow')!.textContent).toBe('IQON / DAILY ESSENTIALS');
});
