// Real Next production build; synthetic Shopify fixtures only, no external mutations.
// Run after npm run build:vercel. Ports 3194-3198 are owned by this test only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
const root=fileURLToPath(new URL('../..',import.meta.url));
const range=JSON.parse(fs.readFileSync(path.join(root,'lib/new-skincare-range.json'),'utf8'));
const www='www.iqondaily.com';
const work=process.env.RELEASE_EVIDENCE||fs.mkdtempSync(path.join(os.tmpdir(),'iqon-release-'));
fs.mkdirSync(work,{recursive:true});
const records=[];
let nextPort=Number(process.env.RELEASE_MATRIX_PORT||3194);
const get=(port,url,host=www,body)=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'localhost',port,path:url,method:body?'POST':'GET',headers:{host,'user-agent':'Googlebot',...(body?{'content-type':'application/json',origin:`http://${host}`}:{})}},res=>{let text='';res.setEncoding('utf8');res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,body:text,headers:res.headers}));});
 req.on('error',reject);req.end(body&&JSON.stringify(body));
});
async function start(name,env){
 const port=nextPort++,log=fs.openSync(path.join(work,`matrix-${name}.log`),'w');
 const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','localhost'],{cwd:root,stdio:['ignore',log,log],env:{...process.env,NODE_ENV:'production',VERCEL_ENV:'production',SHOPIFY_STORE_DOMAIN:'iqon-test.myshopify.com',SHOPIFY_STOREFRONT_PRIVATE_TOKEN:'test-token',FAKE_SHOPIFY:'live',NEXT_PUBLIC_META_PIXEL_ID:'',NODE_OPTIONS:`--import ${pathToFileURL(path.join(root,'tests/seo/fake-shopify-hook.mjs')).href}`,...env}});
 fs.closeSync(log);
 for(let i=0;i<120;i++){try{await get(port,'/approach');return {port,stop:()=>child.kill('SIGTERM')};}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,250));}
 child.kill('SIGTERM');throw new Error(`Server ${name} did not start; ${work}`);
}
const doc=html=>new JSDOM(html).window.document;
const ld=d=>[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>[JSON.parse(s.textContent)].flat());
const sitemapUrls=body=>[...body.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
for(const [name,env] of Object.entries({live:{},empty:{FAKE_SHOPIFY:'empty'},unavailable:{FAKE_SHOPIFY:'down'},unconfigured:{SHOPIFY_STORE_DOMAIN:'',SHOPIFY_STOREFRONT_PRIVATE_TOKEN:''},preview:{VERCEL_ENV:'preview',SHOPIFY_STORE_DOMAIN:'',SHOPIFY_STOREFRONT_PRIVATE_TOKEN:''}})){
 test(`three informational pages: ${name}`,async t=>{
  const server=await start(name,env);t.after(server.stop);const {port}=server;
  const index=name!=='preview';
  for(const p of range){
   const url=`/products/${p.id}`,r=await get(port,url),d=doc(r.body);
   assert.equal(r.status,200,url);assert.equal(d.querySelector('h1')?.textContent,p.name);
   assert.equal(d.querySelector('link[rel="canonical"]')?.getAttribute('href'),`https://${www}${url}`);
   assert.equal(d.querySelector('meta[name="robots"]')?.getAttribute('content'),index?'index, follow':'noindex, follow');
   assert.equal(d.querySelector('meta[property="og:image"]')?.getAttribute('content'),`https://${www}${p.image}`);
   assert.match(d.querySelector('.product-summary')?.textContent||'',/Coming soon/);
   assert.equal(d.querySelector('.product-launch-note button')?.disabled,true);
   assert.equal(d.querySelectorAll('.add-to-bag-row,.sticky-purchase,.product-variant-picker').length,0);
   assert.doesNotMatch(d.querySelector('#main')?.textContent||'',/\$0(?:\.00)?\b|local preview only|sample review/i);
   assert(!ld(d).some(n=>['Product','Offer','AggregateRating','Review'].includes(n['@type'])));
   assert(ld(d).some(n=>n['@type']==='BreadcrumbList'));
   assert.equal(d.querySelectorAll('.visual-gallery-item').length,4);
   assert.equal(d.querySelector('.visual-pack img')?.getAttribute('src'),p.image);
   const alias=await get(port,url,'iqondaily.com'),a=doc(alias.body);
   assert.equal(alias.status,200);assert.equal(a.querySelector('meta[name="robots"]')?.getAttribute('content'),'noindex, follow');
   assert.equal(a.querySelector('link[rel="canonical"]')?.getAttribute('href'),`https://${www}${url}`);
   if(name==='live'){
    const cart=await get(port,'/api/cart',`localhost:${port}`,{action:'add',id:p.id,variantId:'gid://shopify/ProductVariant/3',quantity:1});
    assert.equal(cart.status,422);assert.equal(cart.headers['set-cookie'],undefined);
   }
   records.push({mode:name,id:p.id,status:r.status,indexable:index,offer:false,orderable:false});
  }
  const collection=doc((await get(port,'/collections/skincare')).body);
  for(const p of range)assert(collection.querySelector(`.product-grid a[href="/products/${p.id}"]`),`${name}: discoverable ${p.id}`);
  const sitemap=sitemapUrls((await get(port,'/sitemap.xml')).body);
  for(const p of range)assert.equal(sitemap.includes(`https://${www}/products/${p.id}`),index);
  assert.deepEqual(sitemapUrls((await get(port,'/sitemap.xml','iqondaily.com')).body),[]);
  if(name==='live'){
   assert.equal((await get(port,'/products/not-a-product')).status,404);
   const old=doc((await get(port,'/products/hydrating-tonic')).body);
   assert.equal(old.querySelector('h1')?.textContent,'Hydrating Tonic');
   for(const p of range)assert(!old.querySelector(`#main a[href="/products/${p.id}"]`),'old PDP switcher/related list unchanged');
   const supplement=doc((await get(port,'/products/creatine-monohydrate')).body);
   assert(supplement.querySelector('.add-to-bag-row'));assert(ld(supplement).some(n=>n['@type']==='Product'));
  }
  if(name==='unavailable')assert.match((await get(port,'/products/creatine-monohydrate')).body,/We’ll be back shortly/);
  fs.writeFileSync(path.join(work,'route-matrix.json'),JSON.stringify(records,null,2));
 });
}
