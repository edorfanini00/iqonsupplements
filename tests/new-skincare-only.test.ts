import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {products,productPrice,validateCart} from '../lib/catalog';
import {productContent} from '../lib/product-content';
import {newSkincareProducts,newSkincareIds,newSkincareFor,localNewSkincareProduct,localNewSkincareDepartment,withLocalNewSkincareCards} from '../lib/new-skincare';
import {newSkincareStories,newSkincareVisualContent,newSkincarePresentation,newSkincareGalleryGuides} from '../lib/new-skincare-editorial';
import {isOrderable} from '../lib/commerce-policy';
import {productJsonLd} from '../lib/seo';
const BASE='a4c4b12d8d29608adecfea48609a00db298b7ff7';
const original=(file:string)=>execFileSync('git',['show',`${BASE}:${file}`],{maxBuffer:64*1024*1024});
const ids=['enzyme-gel-cleanser','hyaluronic-serum','peptide-anti-wrinkle-day-cream'];
const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
test('exactly three distinct additions; original seven skincare records and all original copy remain exact',()=>{
 assert.deepEqual([...newSkincareIds],ids);
 const range=JSON.parse(original('lib/skincare-range.json').toString());assert.equal(range.length,7);
 assert.deepEqual(json('lib/skincare-range.json'),range);
 assert.equal(products.filter(p=>p.category==='skincare').length,7);
 for(const [id,copy] of Object.entries(JSON.parse(original('lib/product-copy.json').toString())))assert.deepEqual(productContent[id],copy,id);
 for(const p of range)assert(products.find(x=>x.id===p.id),p.id);
 assert(!products.some(p=>newSkincareIds.has(p.id)),'global navigation/catalog remain original');
});
test('every pre-existing image/CSS, catalog/model, pricing, redirect, auth/account/privacy/payment/API file remains byte-identical',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE],{encoding:'utf8'}).trim().split('\n');
 const exact=files.filter(p=>p.startsWith('public/')||p.endsWith('.css')||p.startsWith('app/api/')||p.startsWith('app/account/')||p.startsWith('app/checkout/')||p.startsWith('lib/affiliates/')||p.startsWith('lib/accounting/')||/lib\/(catalog|skincare-range|product-copy|skincare-stories|skincare-visual-content|product-art|product-presentation|product-gallery-content|product-visuals|approved-prices|merchandise|commerce-policy|legacy-redirects|shopify|seo|google-attribution|meta-pixel)/.test(p)||['app/layout.tsx','app/collections/[slug]/page.tsx','next.config.ts','package.json','package-lock.json'].includes(p));
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 for(const file of exact)assert.equal(hash(readFileSync(file)),hash(original(file)),file);
 console.log(`Verified ${exact.length} protected pre-existing files byte-identical`);
});
test('the shell changes only exact new preview route classification, never existing navigation or cart/privacy logic',()=>{
 const before=original('app/store-shell.tsx').toString();
 const expected=before.replace('import { shopifySrcSet } from "@/lib/responsive-images";', 'import { shopifySrcSet } from "@/lib/responsive-images";\nimport { localNewSkincareDepartment } from "@/lib/new-skincare";').replace('products.find(p=>pathname===`/products/${p.id}`)?.category;', 'products.find(p=>pathname===`/products/${p.id}`)?.category||localNewSkincareDepartment(pathname,mode);');
 assert.equal(readFileSync('app/store-shell.tsx','utf8'),expected);
 for(const id of ids){assert.equal(localNewSkincareDepartment(`/products/${id}`,'preview'),'skincare');assert.equal(localNewSkincareDepartment(`/products/${id}`,'live'),undefined);assert.equal(localNewSkincareDepartment(`/products/${id}/extra`,'preview'),undefined)}
 for(const p of products)assert.equal(localNewSkincareDepartment(`/products/${p.id}`,'preview'),undefined);
 for(const path of ['/','/account','/checkout','/affiliates','/products/unknown'])assert.equal(localNewSkincareDepartment(path,'preview'),undefined);
});
test('new products cannot leak into live/unavailable catalogs or gain stock, prices, variants, offers or cart lines',()=>{
 for(const p of newSkincareProducts){
  assert.equal(newSkincareFor(p.id)!.retailPrice,null);assert.equal(p.pricePending,true);assert.equal(p.available,false);assert.deepEqual(p.variants,[]);
  assert.equal(productPrice(p),'Coming soon');assert.equal(isOrderable(p,'live'),false);assert.equal(productJsonLd(p,true),null);
  assert.deepEqual(validateCart([{id:p.id,quantity:1,purchase:'once',frequency:'once'}]),[]);
  assert.equal(localNewSkincareProduct({mode:'live',products:[]},p.id),undefined);
  assert.equal(localNewSkincareProduct({mode:'unavailable',products:[]},p.id),undefined);
  assert.equal(localNewSkincareProduct({mode:'preview',products},p.id),p);
 }
 assert.equal(localNewSkincareProduct({mode:'preview',products},'invented-product'),undefined);
 assert.equal(withLocalNewSkincareCards(products,'live'),products);assert.equal(withLocalNewSkincareCards(products,'unavailable'),products);
 const added=withLocalNewSkincareCards(products,'preview');assert.deepEqual(added.slice(0,products.length),products);assert.equal(added.length,products.length+3);
 assert.deepEqual(withLocalNewSkincareCards(added,'preview'),added);
});
test('each new page has complete product-specific story, ingredients, routine, FAQs and four gallery panels without borrowed photography',()=>{
 for(const p of newSkincareProducts){
  const c=productContent[p.id],s=newSkincareStories[p.id],v=newSkincareVisualContent[p.id];
  assert(c&&s&&v&&newSkincarePresentation[p.id]&&newSkincareGalleryGuides[p.id]);assert.equal(c.ingredients!.length,3);assert.equal(v.ingredients.length,3);assert.equal(v.steps.length,3);assert(c.faqs.length>=4);assert.equal(v.benefits.length,4);
  for(const role of ['packshot','texture','editorial']){
   const file=`public/images/skincare/new-products-only/${p.id}/${role}.svg`;assert(existsSync(file));assert.match(readFileSync(file,'utf8'),/Image pending approval/);
  }
  for(const art of v.ingredients)if(art.kind==='molecule')assert(existsSync(`public/images/skincare-ingredients/${art.art}.svg`));
 }
});
test('full INCI and directions are byte-exact approved-label transcriptions, independently pinned from the research manifest',()=>{
 const expected=[
 ['9b92e46d27307d5a83665ca6204fd66cc71a48a98e280c2b1d73cac9a865354c','6864bc07c9cb02a5e480f23a2223068bebc49cb3c3484b1e044dc076dc8a0410'],
 ['84ffd534e7f922415627452558313268ac645c50ee48acd81a2791860e14757f','00d8b14c2cf50ef4c49e1ee6559486115e84a4f1bc87defbeeaf2f56b24f10c5'],
 ['415ab05dca1946437c952465b44b695667ea97ad144029e7fd545643f4669c1a','b420a2bc5743ccc5fbe1f8f75a2710be4e1dc8108de43ac7be09fae3da7beac1'],
 ];
 ids.forEach((id,i)=>{const p=newSkincareFor(id)!;assert.deepEqual([p.inci,p.directions].map(text=>createHash('sha256').update(text).digest('hex')),expected[i],id)});
});
test('approved label distinctions survive: no replacement claim, no invented peptides, no mixed HA list or stale day-cream directions',()=>{
 const cleaner=newSkincareFor(ids[0])!,ha=newSkincareFor(ids[1])!,cream=newSkincareFor(ids[2])!;
 assert.match(cleaner.inci,/Carica Papaya/);assert.doesNotMatch(cleaner.inci,/Panthenol|Palmitoyl|peptide/i);
 assert.doesNotMatch(JSON.stringify(productContent[ids[0]]),/replaces that cleanser|discontinued|retired/i);
 assert.match(ha.inci,/Equisetum Hiemale Extract/);assert.doesNotMatch(ha.inci,/Arvense|Leaf Juice/);assert(ha.inci.indexOf('Sodium Hyaluronate')>ha.inci.indexOf('Methylisothiazolinone'));
 assert.equal(cream.directions,'Warm a small amount between your fingertips and massage into face, neck and décolleté. Follow with sun protection (SPF) in the morning.');
 assert.doesNotMatch(cream.directions,/spatula|steam|night|procedure/);assert.doesNotMatch(JSON.stringify(productContent[ids[2]]),/Matrixyl|GHK-Cu|signal peptide|SPF \d/);
 assert.match(cream.inci,/Retinyl Palmitate/);assert.match(cream.inci,/Hydrolyzed Wheat Protein/);assert.match(ha.inci,/Yellow 5, Blue 1/);
});
