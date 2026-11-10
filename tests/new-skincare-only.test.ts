import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {products,productPrice,validateCart} from '../lib/catalog';
import {productContent} from '../lib/product-content';
import {newSkincareProducts,newSkincareIds,newSkincareFor,newSkincareImage,comingSoonSkincareProduct,comingSoonSkincareDepartment,withComingSoonSkincareCards} from '../lib/new-skincare';
import {newSkincareStories,newSkincareVisualContent,newSkincarePresentation,newSkincareGalleryGuides} from '../lib/new-skincare-editorial';
import {isOrderable} from '../lib/commerce-policy';
import {productJsonLd} from '../lib/seo';
const BASE='a4c4b12d8d29608adecfea48609a00db298b7ff7';
const original=(file:string)=>execFileSync('git',['show',`${BASE}:${file}`],{maxBuffer:64*1024*1024});
const ids=['enzyme-gel-cleanser','hyaluronic-serum','peptide-anti-wrinkle-day-cream'];
const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
// Reverse only the exact owner-authorized strength disclosure before historical preservation checks.
const strengthCopy=json('tests/fixtures/retinol-strength-copy.json') as Record<string,[string,string][]>;
const beforeStrengthDisclosure=(file:string)=>{
 let text=readFileSync(file,'utf8');
 for(const [before,after] of strengthCopy[file]||[]){
  assert.equal(text.split(after).length-1,1,`${file}: exact authorized Retinol Rx copy`);
  text=text.replace(after,before);
 }
 return Buffer.from(text);
};
test('three additions join the approved eight; legacy records and unrelated copy are preserved',()=>{
 assert.deepEqual([...newSkincareIds],ids);
 const range=JSON.parse(original('lib/skincare-range.json').toString());assert.equal(range.length,7);
 const current=JSON.parse(beforeStrengthDisclosure('lib/skincare-range.json').toString());
 const retained=['exfoliating-pads','retinol-rx','hydra-c-ferulic-serum','copper-peptide-restore-cream','firming-peptide-eye-gel'];
 for(const p of range){const actual=current.find((q:any)=>q.id===p.id);if(retained.includes(p.id)){const {inci,directions,...rest}=actual;const {directions:prior,...originalRest}=p;assert.deepEqual(rest,originalRest);}else assert.deepEqual(actual,p);}
 assert.equal(products.filter(p=>p.category==='skincare').length,8);
 for(const [id,copy] of Object.entries(JSON.parse(original('lib/product-copy.json').toString())))if(!retained.includes(id))assert.deepEqual(productContent[id],copy,id);
 for(const id of ['anti-aging-cleanser-with-peptides','hydrating-tonic'])assert(!products.find(p=>p.id===id));
});
test('protected files remain byte-identical except exact hash-pinned approved invoice content/catalog/commerce corrections',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE],{encoding:'utf8'}).trim().split('\n');
 const exact=files.filter(p=>p.startsWith('public/')||p.endsWith('.css')||p.startsWith('app/api/')||p.startsWith('app/account/')||p.startsWith('app/checkout/')||p.startsWith('lib/affiliates/')||p.startsWith('lib/accounting/')||/lib\/(catalog|skincare-range|product-copy|skincare-stories|skincare-visual-content|product-art|product-presentation|product-gallery-content|product-visuals|approved-prices|merchandise|commerce-policy|legacy-redirects|shopify|seo|google-attribution|meta-pixel)/.test(p)||['app/layout.tsx','app/collections/[slug]/page.tsx','next.config.ts','package.json','package-lock.json'].includes(p));
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const exceptions=json('docs/new-skincare/commerce-preservation-exceptions.json');
 assert.equal(exceptions.base,BASE);
 assert.deepEqual(Object.keys(exceptions.files).sort(),["lib/catalog.ts", "lib/commerce-policy.ts", "lib/product-copy.json", "lib/seo.ts", "lib/shopify.server.ts", "lib/shopify.ts", "lib/skincare-range.json", "lib/skincare-visual-content.ts"]);
 assert.equal(exceptions.regressionTest,'tests/reserved-skincare-commerce.test.mjs');
 assert(existsSync(exceptions.regressionTest));
 for(const file of exact){
   const exception=exceptions.files[file];
   if(exception){
     assert.equal(hash(original(file)),exception.baselineSha256,`${file}: original input`);
     assert.equal(hash(strengthCopy[file]?beforeStrengthDisclosure(file):readFileSync(file)),exception.candidateSha256,`${file}: exact necessary correction, not a blanket exemption`);
     assert(exception.reason.length>30);
   }else assert.equal(hash(strengthCopy[file]?beforeStrengthDisclosure(file):readFileSync(file)),hash(original(file)),file);
 }
 console.log(`Verified ${exact.length-Object.keys(exceptions.files).length} protected pre-existing files byte-identical and ${Object.keys(exceptions.files).length} exact hash-pinned corrections`);
});
test('the shell changes only exact new preview route classification, never existing navigation or cart/privacy logic',()=>{
 const before=original('app/store-shell.tsx').toString();
 const expected=before.replace('import { shopifySrcSet } from "@/lib/responsive-images";', 'import { shopifySrcSet } from "@/lib/responsive-images";\nimport { comingSoonSkincareDepartment } from "@/lib/new-skincare";').replace('products.find(p=>pathname===`/products/${p.id}`)?.category;', 'products.find(p=>pathname===`/products/${p.id}`)?.category||comingSoonSkincareDepartment(pathname);');
 assert.equal(readFileSync('app/store-shell.tsx','utf8'),expected);
 for(const id of ids){assert.equal(comingSoonSkincareDepartment(`/products/${id}`),'skincare');assert.equal(comingSoonSkincareDepartment(`/products/${id}/extra`),undefined)}
 for(const p of products)assert.equal(comingSoonSkincareDepartment(`/products/${p.id}`),p.category==='skincare'?'skincare':undefined);
 for(const path of ['/','/account','/checkout','/affiliates','/products/unknown'])assert.equal(comingSoonSkincareDepartment(path),undefined);
});
test('only the three approved informational records are public in every mode; never gain stock, prices, variants, offers or cart lines',()=>{
 for(const p of newSkincareProducts){
  assert.equal(newSkincareFor(p.id)!.retailPrice,null);assert.equal(p.pricePending,true);assert.equal(p.available,false);assert.deepEqual(p.variants,[]);
  assert.equal(productPrice(p),'Coming soon');assert.equal(isOrderable(p,'live'),false);assert.equal(productJsonLd(p,true),null);
  assert.deepEqual(validateCart([{id:p.id,quantity:1,purchase:'once',frequency:'once'}]),[]);
  for(const mode of ['live','unavailable','preview'] as const)assert.equal(comingSoonSkincareProduct({mode,products},p.id),p);
 }
 assert.equal(comingSoonSkincareProduct({mode:'preview',products},'invented-product'),undefined);
 {
  const added=withComingSoonSkincareCards(products);assert.deepEqual(added,products);assert.equal(added.filter(p=>p.category==='skincare').length,8);
  assert.deepEqual(withComingSoonSkincareCards(added),added);
  const collision={...newSkincareProducts[0],available:true,price:999,pricePending:false,variants:[{id:'unverified',title:'Default',price:999,currency:'USD',available:true}]};
  assert.deepEqual(withComingSoonSkincareCards([collision]).find(p=>p.id===collision.id),newSkincareProducts[0],'unverified external record cannot bypass the informational hold');
 }
});
test('each new page has complete product-specific story, ingredients, routine, FAQs and four gallery panels',()=>{
 for(const p of newSkincareProducts){
  const c=productContent[p.id],s=newSkincareStories[p.id],v=newSkincareVisualContent[p.id];
  assert(c&&s&&v&&newSkincarePresentation[p.id]&&newSkincareGalleryGuides[p.id]);assert.equal(c.ingredients!.length,3);assert.equal(v.ingredients.length,3);assert.equal(v.steps.length,3);assert(c.faqs.length>=4);assert.equal(v.benefits.length,4);
  const editorial=newSkincareImage(p.id,'editorial')!;
  assert.equal(editorial,`/images/skincare/new-products-only/${p.id}/editorial.webp`);
  const editorialHashes:Record<string,string>={
   'enzyme-gel-cleanser':'d3e6895806280c5b9baaf5d4a1c8b9f506b613d57ac615abbab9db09549d1af0',
   'hyaluronic-serum':'294bc41e361fb57eb38d6f2fdc65c54c63623b3096a06c1e9fcd149e21b67bdc',
   'peptide-anti-wrinkle-day-cream':'f3e849a752a0e99d4fc2d8a5aa2bd2ecc8b60da488486b610c53cab64a107cd4',
  };
  assert.equal(createHash('sha256').update(readFileSync(`public${editorial}`)).digest('hex'),editorialHashes[p.id]);
  for(const art of v.ingredients)if(art.kind==='molecule')assert(existsSync(`public/images/skincare-ingredients/${art.art}.svg`));
 }
});
test('accepted local packshots match pinned hashes and texture references stay byte-identical with explicit visible disclosure',()=>{
 const packHashes=['fef97cc06ef8db86e90276cef24121f48157d5847f80416f18b2d83e4eaafd50','fb8bfa0a29124c2c2974e705ea98b6422070d4e5803adc2be7ddcb8ed6634d22','72dc9506a48141653ddd9ff53883626008751097f46c034e3ed5a650b88adbc1'];
 const textures=['/images/product-details/anti-aging-cleanser-with-peptides.webp','/images/pdp-materials-v6/hydra-c-ferulic-serum.webp','/images/pdp-materials-v6/copper-peptide-restore-cream.webp'];
 ids.forEach((id,i)=>{
  const p=newSkincareProducts.find(p=>p.id===id)!;
  assert.equal(p.image,`/images/skincare/new-products-only/${id}/packshot.webp`);
  assert.equal(newSkincareImage(id,'packshot'),p.image);
  assert.match(p.images![0].alt,/AI-generated packaging visualization/);
  assert.equal(createHash('sha256').update(readFileSync(`public${p.image}`)).digest('hex'),packHashes[i]);
  assert.equal(newSkincareImage(id,'texture'),textures[i]);
  assert.deepEqual(readFileSync(`public${textures[i]}`),original(`public${textures[i]}`));
  assert.match(newSkincareStories[id].imageAlt,/Illustrative texture study, not the finished formula/);
  assert.equal(newSkincareVisualContent[id].texture,'Illustrative texture study, not the finished formula');
  assert.equal(newSkincareVisualContent[id].photoLabel,'TEXTURE STUDY');
 });
 for(const p of products.filter(p=>!newSkincareIds.has(p.id)))for(const role of ['packshot','texture','editorial'] as const)assert.equal(newSkincareImage(p.id,role),undefined);
 assert.equal(newSkincareImage('invented-product','texture'),undefined);
 const comparison=readFileSync('app/skincare-product-story.tsx','utf8');
 assert(comparison.includes('skincareRange.find(s=>s.id===q.id)?.size||newSkincareFor(q.id)?.size'));
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
