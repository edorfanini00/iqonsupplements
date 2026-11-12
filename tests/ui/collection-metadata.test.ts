// Review B N1: /collections/[category] generateMetadata derives skincare wording from the request catalog.
import {beforeEach,expect,it,vi} from 'vitest';
import {launchedSkincareProduct,withComingSoonSkincareCards} from '../../lib/new-skincare';
import {activeSkincareIds} from '../../lib/skincare-identity';
import type {Product,StoreCatalog} from '../../lib/catalog';

const state=vi.hoisted(()=>({catalog:null as unknown as StoreCatalog}));
vi.mock('../../lib/shopify.server',()=>({getStoreCatalog:async()=>state.catalog}));
vi.mock('../../lib/seo.server',()=>({publicPageMetadata:async(page:{description:string})=>({description:page.description})}));
vi.mock('../../app/shop-pages',()=>({CollectionPage:()=>null}));
const {generateMetadata}=await import('../../app/collections/[category]/page');

const supplement={id:'creatine-monohydrate',number:'01',name:'Creatine Monohydrate',category:'supplements',type:'Powder',descriptor:'x',description:'x',size:'281 g',price:48.97,currency:'USD',image:'/x.webp',tone:'silver',campaign:'/x.webp',available:true,variants:[{id:'gid://shopify/ProductVariant/1',title:'Default Title',price:48.97,currency:'USD',available:true}]} as unknown as Product;
const launched=(id:string,i:number)=>launchedSkincareProduct({handle:id,productId:`gid://shopify/Product/99${i}`,variantId:`gid://shopify/ProductVariant/99${i}`,title:'Default Title',price:55,currency:'USD',quantityAvailable:28})!;
const catalog=(mode:StoreCatalog['mode'],ids:readonly string[]):StoreCatalog=>({mode,currency:'USD',products:withComingSoonSkincareCards([supplement,...ids.map((id,i)=>launched(id,i))])});
const describe=async(category:string)=>(await generateMetadata({params:Promise.resolve({category})}) as {description?:string}).description;
beforeEach(()=>{state.catalog=catalog('live',[]);});

const cases:[string,StoreCatalog,string,string][]=[
 ['live: all eight qualified',catalog('live',activeSkincareIds),'Shop the IQON skincare collection. Cleanse, treat and moisturize.','Shop every IQON supplement and skincare product in one place.'],
 ['partial: retinol held',catalog('live',activeSkincareIds.filter(id=>id!=='retinol-rx')),'Shop the IQON skincare collection. Cleanse, treat and moisturize.','Shop IQON supplements and skincare in one place.'],
 ['held: nothing qualified',catalog('live',[]),'Explore the IQON skincare collection. Skincare isn’t available to order right now.','Shop IQON supplements. Skincare isn’t available to order right now.'],
 ['catalog outage (unavailable)',{mode:'unavailable',currency:'USD',products:withComingSoonSkincareCards([])},'Explore the IQON skincare collection ahead of launch.','Shop IQON supplements and preview the skincare collection, coming soon.'],
 ['preview store',catalog('preview',[]),'Explore the IQON skincare collection ahead of launch.','Shop IQON supplements and preview the skincare collection, coming soon.'],
];
for(const [name,cat,skincare,all] of cases)it(`${name}: skincare and all descriptions follow the catalog`,async()=>{
 state.catalog=cat;
 expect(await describe('skincare')).toBe(skincare);
 expect(await describe('all')).toBe(all);
 expect(await describe('supplements')).toBe('Shop IQON supplements, each with its format, contents and current price.');
});
it('unknown category has no metadata',async()=>{expect(await generateMetadata({params:Promise.resolve({category:'nope'})})).toEqual({});});
