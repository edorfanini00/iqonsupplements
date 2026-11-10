// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StoreShell, useStore } from "../../app/store-shell";
import { products, type CartItem, type Product } from "../../lib/catalog";

vi.mock("next/navigation",()=>({usePathname:()=>"/",useRouter:()=>({push:vi.fn()}),useSearchParams:()=>new URLSearchParams()}));
vi.mock("../../app/meta-pixel",()=>({StorefrontMetaPixel:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

const product=(id:string):Product=>({...products.find(p=>p.id===id)!,available:true,
  variants:[{id:`variant-${id}`,title:"Default Title",available:true,price:30,currency:"USD"}]});
// Gut Health is approved for bundles and is the first eligible catalog recommendation.
const gut=product("gut-health"),creatine=product("creatine-monohydrate"),liver=product("liver-support");
const unapproved:Product={...gut,id:"unapproved-test-supplement",name:"Unapproved Test Supplement",
  variants:[{...gut.variants![0],id:"variant-unapproved-test-supplement"}]};
const item=(id:string,quantity=1):CartItem=>({id,lineId:`line-${id}`,quantity,purchase:"once",frequency:"once"});
function OpenBag(){const store=useStore();return React.createElement("button",{disabled:!store.ready,onClick:store.openBag},"Open test bag");}
async function setup(items=[item(creatine.id)],discountCodes:{code:string;applicable:boolean}[]=[],catalog=[gut,creatine,liver]){
  const calls:Record<string,unknown>[]=[];
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{
    if(init?.body){
      const input=JSON.parse(init.body);calls.push(input);
      if(input.action==="add")items=[...items,item(input.id,input.quantity)];
      if(input.action==="update")items=items.map(i=>i.lineId===input.lineId?{...i,quantity:input.quantity}:i).filter(i=>i.quantity>0);
    }
    return Response.json({items,discountCodes,currency:"USD",subtotal:30*items.reduce((n,i)=>n+i.quantity,0)});
  }));
  render(React.createElement(StoreShell,{catalog:{products:catalog,mode:"live",currency:"USD"}},React.createElement(OpenBag)));
  const open=screen.getByRole("button",{name:"Open test bag"});
  await waitFor(()=>expect(open.hasAttribute("disabled")).toBe(false));
  fireEvent.click(open);
  await screen.findByRole("dialog");
  return calls;
}
const recommendation=()=>document.querySelector(".bag-recommend")!;
const nudge=()=>document.querySelector(".bag-sheet .bundle-nudge");

it("recommends eligible Gut Health to advance the active bundle tier and preserves quantity controls",async()=>{
  const calls=await setup();
  expect(nudge()?.textContent).toContain("save 10%");
  expect(recommendation().textContent).toContain("Gut Health");
  fireEvent.click(screen.getByRole("button",{name:"Add Gut Health to bag"}));
  await waitFor(()=>expect(nudge()?.textContent).toContain("save 25%"));
  expect(calls[0]).toEqual({action:"add",id:gut.id,quantity:1,variantId:`variant-${gut.id}`,purchase:"once"});
  const increase=screen.getByRole("button",{name:"Increase Creatine Monohydrate quantity"});
  await waitFor(()=>expect(increase.hasAttribute("disabled")).toBe(false));
  fireEvent.click(increase);
  await waitFor(()=>expect(nudge()).toBeNull());
  expect(recommendation().textContent).toContain("Liver Support");
  const decrease=screen.getByRole("button",{name:"Decrease Creatine Monohydrate quantity"});
  await waitFor(()=>expect(decrease.hasAttribute("disabled")).toBe(false));
  fireEvent.click(decrease);
  await waitFor(()=>expect(nudge()?.textContent).toContain("save 25%"));
  expect(calls.slice(1)).toEqual([2,1].map(quantity=>({action:"update",lineId:`line-${creatine.id}`,quantity})));
});

it.each([
  ["applied code",[item(creatine.id)],[{code:"CREATOR10",applicable:true}]],
  ["top tier",[item(creatine.id,3)],[]],
  ["no eligible units",[item("daily-travel-kit")],[]],
  ["legacy subscription",[{...item(creatine.id),purchase:"subscription"}],[]],
] as const)("preserves normal recommendations with no nudge: %s",async(_label,items,codes)=>{
  await setup([...items],[...codes]);
  expect(nudge()).toBeNull();
  expect(recommendation().textContent).toContain("Gut Health");
});

it("never recommends unapproved, unavailable or subscription-only products for an active nudge",async()=>{
  await setup([item(creatine.id)],[],[unapproved,creatine,{...product("nmn"),available:false},{...product("colostrum-powder"),requiresSellingPlan:true},liver]);
  expect(recommendation().textContent).toContain("Liver Support");
});

it("does not offer an unapproved substitute when no eligible recommendation is available",async()=>{
  await setup([item(creatine.id)],[],[unapproved,creatine]);
  expect(nudge()?.textContent).toContain("save 10%");
  expect(recommendation().querySelector("button")).toBeNull();
});

// Owner decision 10 Nov 2026: skincare has its own bundle, counted separately from supplements.
const qualifiedSkincare=(id:string,price:number):Product=>({...products.find(p=>p.id===id)!,available:true,pricePending:false,launchQualified:true,requiresSellingPlan:false,
  price,currency:"USD",variants:[{id:`variant-${id}`,title:"Default Title",available:true,price,currency:"USD"}]});
const retinol=qualifiedSkincare("retinol-rx",99),eye=qualifiedSkincare("firming-peptide-eye-gel",77);
const nudges=()=>[...document.querySelectorAll(".bag-sheet .bundle-nudge")].map(n=>n.textContent);

it("a skincare-only bag nudges toward the skincare tiers and recommends only qualified skincare",async()=>{
  const heldSkincare=products.find(p=>p.id==="hyaluronic-serum")!;
  await setup([item(retinol.id)],[],[gut,creatine,heldSkincare,retinol,eye]);
  expect(nudges()).toEqual(["Add 1 more skincare product to save 10%."]);
  expect(recommendation().textContent).toContain("Firming Peptide Eye Gel");
  fireEvent.click(screen.getByRole("button",{name:"Add Firming Peptide Eye Gel to bag"}));
  await waitFor(()=>expect(nudges()).toEqual(["Add 1 more skincare product to save 15%."]));
  const increase=screen.getByRole("button",{name:"Increase Retinol Rx quantity"});
  await waitFor(()=>expect(increase.hasAttribute("disabled")).toBe(false));
  fireEvent.click(increase);
  await waitFor(()=>expect(nudges()).toEqual([]));
});

it("a mixed bag counts each family separately: one of each reaches neither tier",async()=>{
  await setup([item(retinol.id),item(creatine.id)],[],[gut,creatine,liver,retinol,eye]);
  expect(nudges()).toEqual(["Add 1 more eligible supplement to save 10%.","Add 1 more skincare product to save 10%."]);
  // Two skincare units and one supplement: three units in the bag, but no family reaches Buy 3.
  const increase=screen.getByRole("button",{name:"Increase Retinol Rx quantity"});
  await waitFor(()=>expect(increase.hasAttribute("disabled")).toBe(false));
  fireEvent.click(increase);
  await waitFor(()=>expect(nudges()).toEqual(["Add 1 more eligible supplement to save 10%.","Add 1 more skincare product to save 15%."]));
});

it("skincare subscriptions, legacy and unknown handles never count toward the skincare bundle; a code hides every nudge",async()=>{
  await setup([{...item(retinol.id,2),purchase:"subscription"},item("hydrating-tonic"),item("unapproved-test-skincare",3)],[],[gut,creatine,retinol,eye]);
  expect(nudges()).toEqual([]);
  cleanup();
  await setup([item(retinol.id),item(creatine.id)],[{code:"IQON10",applicable:true}],[gut,creatine,retinol,eye]);
  expect(nudges()).toEqual([]);
});
