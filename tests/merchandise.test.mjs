import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../lib/merchandise.ts",import.meta.url),"utf8");
const js=ts.transpile(source,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
const {mergeCatalogMerchandise}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const upcoming={id:"skin",category:"skincare",price:68,currency:"USD",available:true,variants:[{id:"stale",available:true}],descriptor:"Editorial",ritual:"Hydrate"};

test("unpublished supplements and skincare are visible but cannot acquire inventory from editorial data",()=>{
  const result=mergeCatalogMerchandise([], [upcoming,{id:"supplement",category:"supplements"}]);
  assert.equal(result.length,2);
  assert.equal(result[1].id,"supplement");
  assert.equal(result[1].available,false);
  assert.deepEqual(result[1].variants,[]);
  assert.equal(result[0].price,68);
  assert.equal(result[0].available,false);
  assert.deepEqual(result[0].variants,[]);
});

test("a live Shopify record owns price, currency, stock and variants without duplication",()=>{
  const live={...upcoming,price:72,currency:"EUR",available:false,variants:[{id:"actual",available:false}],image:"merchant-image"};
  const result=mergeCatalogMerchandise([live],[upcoming]);
  assert.equal(result.length,1);
  assert.equal(result[0].price,72);
  assert.equal(result[0].currency,"EUR");
  assert.equal(result[0].available,false);
  assert.equal(result[0].image,"merchant-image");
  assert.deepEqual(result[0].variants,live.variants);
});

test("all seven approved skincare prices match the recorded Shopify variants",()=>{
  const read=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url),"utf8"));
  const range=read("../lib/skincare-range.json");
  const prices=read("../lib/approved-prices.json");
  const shopify=read("../docs/shopify-skincare-range-2026-09-11.json");
  assert.equal(range.length,7);
  assert.equal(new Set(range.map(p=>p.id)).size,7);
  for(const p of range){
    assert.equal(Number(shopify.find(s=>s.handle===p.id).variants[0].price),p.price);
    assert.equal(prices[p.id],p.price);
  }
});

test("approved skincare photography replaces only its primary image and preserves live commerce and other galleries",()=>{
  const approved="/images/skincare/products/hydra-c-ferulic-serum.webp";
  const skin={...upcoming,id:"hydra-c-ferulic-serum",name:"Hydra C + Ferulic Serum",price:72,
    currency:"EUR",available:false,variants:[{id:"live-variant",available:false}],
    image:"https://merchant/skin.webp",campaign:"https://merchant/skin.webp",
    images:[{src:"https://merchant/skin.webp",alt:"Original"},{src:"https://merchant/back.webp",alt:"Back label"}]};
  const supplement={...skin,id:"nmn",category:"supplements",image:"https://merchant/nmn.webp"};
  const approvedCopy={...upcoming,id:skin.id,name:skin.name,image:approved,images:[{src:approved,alt:"Approved IQON serum"}]};
  const result=mergeCatalogMerchandise([skin,supplement],[approvedCopy,{...approvedCopy,id:"nmn",category:"supplements"}]);
  assert.equal(result[0].image,approved);
  assert.equal(result[0].campaign,approved);
  assert.deepEqual(result[0].images,[approvedCopy.images[0],skin.images[1]]);
  for(const key of ["price","currency","available","variants"]) assert.deepEqual(result[0][key],skin[key]);
  assert.equal(result[1].image,supplement.image);
  assert.deepEqual(result[1].images,supplement.images);
});
