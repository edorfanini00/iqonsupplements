import test from "node:test";
import assert from "node:assert/strict";
import {products,money} from "../lib/catalog";
import {servingPrice,verifiedPackLabel,verifiedLabels} from "../lib/verified-labels";
const creatine=products.find(p=>p.id==="creatine-monohydrate")!;
const colostrum=products.find(p=>p.id==="colostrum-powder")!;
test("recovered panel distinguishes scoop mass, active mass and servings from duration",()=>{
 assert.equal(verifiedPackLabel(creatine)?.serving,"1 scoop (5.6 g)");
 assert.equal(verifiedPackLabel(creatine)?.active,"5 g creatine monohydrate");
 assert.equal(verifiedPackLabel(creatine)?.servings,50);
 assert.match(verifiedPackLabel(creatine)?.durationNote||"",/loading/);
 assert.equal(verifiedPackLabel(colostrum)?.servings,30);
 assert.equal(verifiedPackLabel(colostrum)?.serving,"1 scoop (2.3 g)");
});
test("per serving value follows the canonical current price and currency",()=>{
 for(const [product,count] of [[creatine,50],[colostrum,30]] as const){
  assert.equal(servingPrice(product),money(product.price/count));
  assert.equal(servingPrice(product,63.27,"EUR"),money(63.27/count,"EUR"));
 }
});
test("alternate packs, variants and unknown prices never inherit a serving cost",()=>{
 assert.equal(servingPrice({...creatine,size:"500 g"}),null);
 assert.equal(servingPrice({...creatine,size:""}),servingPrice(creatine));
 assert.equal(servingPrice({...creatine,pricePending:true}),null);
 assert.equal(servingPrice(creatine,NaN),null);
 assert.equal(servingPrice(creatine,0),null);
 const variant={id:"test",title:"Large",available:true,price:50,currency:"USD"};
 assert.equal(servingPrice({...creatine,variants:[variant]}),null);
 assert.equal(servingPrice({...creatine,variants:[variant,variant]}),null);
 assert.equal(verifiedPackLabel({...creatine,id:"unknown"}),null);
});

test("all eleven current supplement packs have recovered counts; servings never become assumed days",()=>{
 const counts=[50,14,14,30,30,60,30,30,30,60,30];
 const supplements=products.filter(p=>p.category==="supplements");
 assert.equal(Object.keys(verifiedLabels).length,11);
 supplements.forEach((p,i)=>assert.equal(verifiedPackLabel(p)?.servings,counts[i],p.id));
 for(const p of products.filter(p=>p.category==="skincare"))assert.equal(verifiedPackLabel(p),null);
 assert.match(verifiedLabels.resveratrol.durationNote!,/30 days/);
 assert.match(verifiedLabels["keto-5"].durationNote!,/twice daily/);
});
