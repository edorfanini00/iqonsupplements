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
// Match the real catalog failure: the excluded, orderable supplement comes first.
const colon=product("colon-gentle-cleanse"),creatine=product("creatine-monohydrate"),liver=product("liver-support");
const item=(id:string,quantity=1):CartItem=>({id,lineId:`line-${id}`,quantity,purchase:"once",frequency:"once"});
function OpenBag(){const store=useStore();return React.createElement("button",{disabled:!store.ready,onClick:store.openBag},"Open test bag");}
async function setup(items=[item(creatine.id)],discountCodes:{code:string;applicable:boolean}[]=[],catalog=[colon,creatine,liver]){
  const calls:Record<string,unknown>[]=[];
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{
    if(init?.body){
      const input=JSON.parse(init.body);calls.push(input);
      if(input.action==="add")items=[...items,item(input.id,input.quantity)];
      if(input.action==="update")items=items.map(i=>i.lineId===input.lineId?{...i,quantity:input.quantity}:i).filter(i=>i.quantity>0);
    }
    return Response.json({items,discountCodes,currency:"USD",subtotal:30*items.reduce((n,i)=>n+i.quantity,0)});
  }));
  render(React.createElement(StoreShell,{catalog:{products:catalog,mode:"live",currency:"USD"},children:React.createElement(OpenBag)}));
  const open=screen.getByRole("button",{name:"Open test bag"});
  await waitFor(()=>expect(open.hasAttribute("disabled")).toBe(false));
  fireEvent.click(open);
  await screen.findByRole("dialog");
  return calls;
}
const recommendation=()=>document.querySelector(".bag-recommend")!;
const nudge=()=>document.querySelector(".bag-sheet .bundle-nudge");

it("with excluded Colon first, the active nudge recommends an eligible add that advances the tier and quantity controls still work",async()=>{
  const calls=await setup();
  expect(nudge()?.textContent).toContain("save 10%");
  expect(recommendation().textContent).toContain("Liver Support");
  expect(recommendation().textContent).not.toContain("Colon Gentle Cleanse");
  fireEvent.click(screen.getByRole("button",{name:"Add Liver Support to bag"}));
  await waitFor(()=>expect(nudge()?.textContent).toContain("save 25%"));
  expect(calls[0]).toEqual({action:"add",id:liver.id,quantity:1,variantId:`variant-${liver.id}`,purchase:"once"});
  const increase=screen.getByRole("button",{name:"Increase Creatine Monohydrate quantity"});
  await waitFor(()=>expect(increase.hasAttribute("disabled")).toBe(false));
  fireEvent.click(increase);
  await waitFor(()=>expect(nudge()).toBeNull());
  expect(recommendation().textContent).toContain("Colon Gentle Cleanse");
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
  expect(recommendation().textContent).toContain("Colon Gentle Cleanse");
});

it("never recommends unavailable or subscription-only eligible products for an active nudge",async()=>{
  await setup([item(creatine.id)],[],[colon,creatine,{...product("nmn"),available:false},{...product("colostrum-powder"),requiresSellingPlan:true},liver]);
  expect(recommendation().textContent).toContain("Liver Support");
});

it("does not offer an excluded substitute when no eligible recommendation is available",async()=>{
  await setup([item(creatine.id)],[],[colon,creatine]);
  expect(nudge()?.textContent).toContain("save 10%");
  expect(recommendation().querySelector("button")).toBeNull();
});
