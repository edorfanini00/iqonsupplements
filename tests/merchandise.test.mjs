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
