// Skincare availability copy follows per-product orderability and never widens the purchase guards.
//   node --import tsx --test tests/skincare-copy.test.ts
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {activeSkincareProducts,launchedSkincareProduct,legacySkincareProduct,withComingSoonSkincareCards} from '../lib/new-skincare';
import {SKINCARE_COMING_SOON,isComingSoon,isOrderable} from '../lib/commerce-policy';
import {activeSkincareIds,legacySkincareIds} from '../lib/skincare-identity';
import {allProductsSubtitle,collectionDescription,isSkincareOrderable,skincareAvailability,skincareCollectionSubtitle,skincareDepartmentLabel,skincareHeroEyebrow,HELD_ALL_SUBTITLE,HELP_SKINCARE_HELD,SKINCARE_HELD_SUBTITLE,SKINCARE_PREVIEW_SUBTITLE} from '../lib/skincare-copy';
import {productPrice,type Product} from '../lib/catalog';

const supplement:Product={id:'creatine-monohydrate',number:'01',name:'Creatine Monohydrate',category:'supplements',type:'Powder',descriptor:'Synthetic',description:'Synthetic',size:'281 g',price:48.97,currency:'USD',image:'/x.webp',tone:'silver',campaign:'/x.webp',available:true,variants:[{id:'gid://shopify/ProductVariant/1',title:'Default Title',price:48.97,currency:'USD',available:true}]} as unknown as Product;
const launched=(id:string)=>launchedSkincareProduct({handle:id,productId:'gid://shopify/Product/99',variantId:`gid://shopify/ProductVariant/9${activeSkincareIds.indexOf(id as never)}`,title:'Default Title',price:55,currency:'USD',quantityAvailable:28})!;
/** The catalog exactly as lib/shopify.server.ts builds it: launched records replace informational cards in place. */
const catalog=(qualified:readonly string[])=>withComingSoonSkincareCards([supplement,...qualified.map(launched)]);
const STALE=/coming soon|ahead of launch|preview|can.t be ordered|not available to order/i;
const DASH=/[–—]| - /;

test('all eight qualified: every skincare surface reads as available to shop',()=>{
 const products=catalog(activeSkincareIds);
 assert.equal(skincareAvailability(products,'live'),'live');
 const skinPreview=products.some(p=>p.category==='skincare'&&isComingSoon(p));
 assert.equal(skinPreview,false);
 for(const copy of [skincareCollectionSubtitle('live'),allProductsSubtitle('live',true,skinPreview),skincareDepartmentLabel('live',skinPreview),skincareHeroEyebrow('live'),collectionDescription('skincare','live'),collectionDescription('all','live')]){
  assert.doesNotMatch(copy,STALE,copy);assert.doesNotMatch(copy,DASH,copy);assert.doesNotMatch(copy,/IQON\s+Daily/i,copy);
 }
 assert.match(allProductsSubtitle('live',true,false),/skincare/i);
 assert.equal(skincareDepartmentLabel('live',false),'Skincare');
});

test('one product held (e.g. price drift or zero stock): partial copy, still honest about the held item',()=>{
 const products=catalog(activeSkincareIds.filter(id=>id!=='retinol-rx'));
 assert.equal(skincareAvailability(products,'live'),'partial');
 assert.equal(products.find(p=>p.id==='retinol-rx')!.launchQualified,undefined,'held card stays informational');
 assert.ok(!isOrderable(products.find(p=>p.id==='retinol-rx')!,'live'));
 // Review B N2/N3: exact partial strings, neutral and true for a single hold.
 assert.equal(skincareCollectionSubtitle('partial'),'Some skincare products aren’t available to order right now.');
 assert.equal(allProductsSubtitle('partial',true,true),'Supplements and skincare are available to order now. Some skincare products aren’t available right now.');
 assert.ok(isSkincareOrderable('partial'));
 assert.equal(skincareDepartmentLabel('partial',true),'Skincare');
 assert.doesNotMatch(collectionDescription('skincare','partial'),/ahead of launch/);
 // Review A N1: a held product means the all-products meta must not claim "every" product.
 assert.equal(collectionDescription('all','partial'),'Shop IQON supplements and skincare in one place.');
 assert.doesNotMatch(collectionDescription('all','partial'),/\bevery\b/i);
 assert.equal(collectionDescription('all','live'),'Shop every IQON supplement and skincare product in one place.');
 for(const copy of [skincareCollectionSubtitle('partial'),allProductsSubtitle('partial',true,true),skincareDepartmentLabel('partial',true),skincareHeroEyebrow('partial'),collectionDescription('skincare','partial'),collectionDescription('all','partial')]){assert.doesNotMatch(copy,DASH,copy);assert.doesNotMatch(copy,/coming soon|ahead of launch|preview|\byet\b/i,copy);}
});

test('live store with nothing orderable (sold out or qualification outage): neutral wording, no launch claims',()=>{
 assert.equal(skincareAvailability(catalog([]),'live'),'held');
 assert.equal(skincareCollectionSubtitle('held'),'Skincare isn’t available to order right now.');
 assert.equal(SKINCARE_HELD_SUBTITLE,'Skincare isn’t available to order right now.');
 assert.equal(allProductsSubtitle('held',true,true),HELD_ALL_SUBTITLE);
 assert.equal(HELD_ALL_SUBTITLE,'Supplements are available to order now. Skincare isn’t available to order right now.');
 assert.equal(allProductsSubtitle('held',true,false),'Find your everyday essentials.');
 assert.equal(allProductsSubtitle('live',false,false),'Find your everyday essentials.','no supplement orderable: no availability claim');
 assert.equal(skincareDepartmentLabel('held',true),'Skincare');
 assert.equal(skincareHeroEyebrow('held'),'IQON / SKINCARE');
 assert.equal(HELP_SKINCARE_HELD,'IQON skincare isn’t available to order right now.');
 assert.equal(collectionDescription('skincare','held'),'Explore the IQON skincare collection. Skincare isn’t available to order right now.');
 assert.equal(collectionDescription('all','held'),'Shop IQON supplements. Skincare isn’t available to order right now.');
 assert.ok(!isSkincareOrderable('held'));
 for(const copy of [SKINCARE_HELD_SUBTITLE,HELD_ALL_SUBTITLE,HELP_SKINCARE_HELD,skincareDepartmentLabel('held',true),skincareHeroEyebrow('held'),collectionDescription('skincare','held'),collectionDescription('all','held')]){
  assert.doesNotMatch(copy,/coming soon|ahead of launch|preview|\byet\b/i,copy);assert.doesNotMatch(copy,DASH,copy);
 }
});

test('preview store (mode !== "live", incl. catalog outage): copy is byte-identical to main',()=>{
 for(const [products,mode] of [[withComingSoonSkincareCards([]),'unavailable'],[catalog(activeSkincareIds),'preview'],[catalog([]),'preview']] as const){
  assert.equal(skincareAvailability(products,mode),'preview',mode);
 }
 assert.equal(skincareCollectionSubtitle('preview'),'Coming soon. Explore the collection ahead of launch.');
 assert.equal(SKINCARE_PREVIEW_SUBTITLE,'Coming soon. Explore the collection ahead of launch.');
 assert.equal(allProductsSubtitle('preview',false,true),'Find your everyday essentials.');
 assert.equal(allProductsSubtitle('preview',true,true),'Find your everyday essentials.');
 assert.equal(skincareDepartmentLabel('preview',true),'Skincare preview');
 assert.equal(skincareHeroEyebrow('preview'),'IQON / SKINCARE / COMING SOON');
 assert.equal(collectionDescription('skincare','preview'),'Explore the IQON skincare collection ahead of launch.');
 assert.equal(collectionDescription('all','preview'),'Shop IQON supplements and preview the skincare collection, coming soon.');
 assert.ok(!isSkincareOrderable('preview'));
});

test('per-product label: "Unavailable right now" only for a live, active, non-orderable skincare handle',()=>{
 const held=activeSkincareProducts.find(p=>p.id==='retinol-rx')!;
 assert.equal(productPrice(held,'live'),'Unavailable right now');
 assert.equal(productPrice(held),'Coming soon','no mode: unchanged');
 for(const mode of ['preview','unavailable']) assert.equal(productPrice(held,mode),'Coming soon',mode);
 assert.equal(productPrice(launched('retinol-rx'),'live'),'$55');
 for(const id of legacySkincareIds) assert.equal(productPrice(legacySkincareProduct(id)!,'live'),'Coming soon',`${id}: legacy label path unchanged`);
 assert.equal(productPrice({...supplement,pricePending:true} as Product,'live'),'Coming soon','unpriced supplement unchanged');
 assert.equal(productPrice(supplement,'live'),'$48.97');
});

test('forged or legacy records never count as orderable skincare',()=>{
 // A client-forged launchQualified flag on an informational card has no variant: not orderable.
 const forged=activeSkincareProducts.map(p=>({...p,launchQualified:true}));
 assert.equal(skincareAvailability(forged,'live'),'held');
 // Legacy handles stay held even with every commerce field set.
 for(const id of legacySkincareIds){
  const legacy={...legacySkincareProduct(id)!,launchQualified:true,available:true,pricePending:false,price:40,variants:[{id:'gid://shopify/ProductVariant/7',title:'x',price:40,currency:'USD',available:true}]};
  assert.ok(isComingSoon(legacy),id);assert.ok(!isOrderable(legacy,'live'),id);
  assert.equal(skincareAvailability([legacy],'live'),'held',id);
 }
 // A non-active handle cannot be launched by the flag either.
 const stray={...launched('retinol-rx'),id:'barrier-cream'};
 assert.ok(isComingSoon(stray));assert.equal(skincareAvailability([stray],'live'),'held');
});

test('purchase guards are untouched: the category-wide hold stays on and only qualified active handles leave it',()=>{
 assert.equal(SKINCARE_COMING_SOON,true);
 for(const id of activeSkincareIds){
  assert.ok(isComingSoon(activeSkincareProducts.find(p=>p.id===id)!),`${id} informational card is held`);
  assert.ok(!isComingSoon(launched(id)),`${id} qualified record is orderable`);
 }
 // The copy module only reads policy; it exports no flag or setter.
 const source=readFileSync('lib/skincare-copy.ts','utf8');
 assert.doesNotMatch(source,/launchQualified\s*=|SKINCARE_COMING_SOON/);
});

test('cart and checkout errors stay accurate for genuinely held products and drop launch wording',()=>{
 const server=readFileSync('lib/shopify.server.ts','utf8'),client=readFileSync('lib/shopify.ts','utf8');
 assert.doesNotMatch(server+client,/Skincare is coming soon/);
 assert.equal((server.match(/This product isn’t available to order right now\./g)||[]).length,2);
 assert.match(server,/These skincare items are not available to order right now and have been removed from your bag\./);
 assert.match(server,/This earlier formula is not available to order\./);
 assert.match(server,/"This earlier formula is not available to order\. It has been removed from your bag\."/);
});

test('Help skincare bundle line: derived from SKINCARE_BUNDLE_TIERS, shown only when skincare is orderable',async()=>{
 const {skincareBundleHelp}=await import('../lib/skincare-copy');
 const {SKINCARE_BUNDLE_TIERS,BUNDLE_OFFERS}=await import('../lib/bundle-offer');
 const [low,high]=[...SKINCARE_BUNDLE_TIERS].sort((a,b)=>a.minQuantity-b.minQuantity);
 const expected=`Skincare has its own bundle: buy ${low.minQuantity} IQON skincare products and save ${low.percent}%, or buy ${high.minQuantity} or more and save ${high.percent}%. Mix and match any IQON skincare. Supplements and skincare are counted separately. Savings apply automatically in your bag and at checkout.`;
 for(const state of ['live','partial'] as const) assert.equal(skincareBundleHelp(state),expected,state);
 assert.equal(skincareBundleHelp('live'),'Skincare has its own bundle: buy 2 IQON skincare products and save 10%, or buy 3 or more and save 15%. Mix and match any IQON skincare. Supplements and skincare are counted separately. Savings apply automatically in your bag and at checkout.','matches the live Shopify discounts read back 11 Nov 2026');
 assert.equal(skincareBundleHelp('held'),null);
 // A tier change flows straight into the copy (no hardcoded numbers).
 assert.match(skincareBundleHelp('live',[{minQuantity:4,percent:20,title:'x'},{minQuantity:2,percent:5,title:'y'}])!,/buy 2 IQON skincare products and save 5%, or buy 4 or more and save 20%\./);
 const line=skincareBundleHelp('live')!;
 assert.doesNotMatch(line,/[–—]| - /);assert.doesNotMatch(line,/IQON\s+Daily/i);
 // No discount code claim unless the skincare terms make one.
 assert.ok(!/discount code/i.test(BUNDLE_OFFERS.skincare.terms));assert.doesNotMatch(line,/discount code|can.t be combined/i);
});
