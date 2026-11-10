// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductPage } from "../../app/shop-pages";
import { products, productPrice } from "../../lib/catalog";
import { BUNDLE_ELIGIBLE_HANDLES } from "../../lib/bundle-offer";
import { dailyProductPrice } from "../../app/product-essentials";

const store=vi.hoisted(()=>({add:vi.fn(),products:[] as unknown[],mode:"live",busy:false,ready:true}));
const quantity=vi.hoisted(()=>({set:undefined as undefined|((n:number)=>void)}));
vi.mock("../../app/store-shell",()=>({useStore:()=>store,CartConnectionNotice:()=>null,
  Quantity:({value,setValue}:{value:number;setValue:(n:number)=>void})=>{quantity.set=setValue;return React.createElement("output",{"aria-label":"Quantity"},value);}}));
vi.mock("../../app/product-gallery",()=>({ProductGallery:()=>React.createElement("div",{className:"product-visual-gallery"})}));
vi.mock("../../app/product-story",()=>({ProductStory:()=>null}));
vi.mock("../../app/product-navigation",()=>({ProductSwitcher:()=>null}));
vi.mock("../../app/product-rail",()=>({ProductRail:()=>null}));
vi.mock("../../app/customer-reviews",()=>({CustomerReviews:()=>null,ProductReviewLink:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const variant={id:"gid://shopify/ProductVariant/1",title:"Default Title",price:48.97,currency:"USD",available:true};
const creatine={...products.find(p=>p.id==="creatine-monohydrate")!,available:true,price:48.97,currency:"USD",variants:[variant]};
const addButtons=()=>screen.getAllByRole("button",{name:/Add to bag/});

it("offers no subscription: one time is the only purchase, and the bag never receives a selling plan",()=>{
  const {container}=render(React.createElement(ProductPage,{product:creatine}));
  expect(container.textContent).not.toMatch(/subscri|Subscribe|skip or cancel|every month|renews/i);
  expect(container.querySelector(".subscription-details,.subscription-option")).toBeNull();
  expect(screen.queryByRole("button",{name:/Add subscription/})).toBeNull();
  fireEvent.click(addButtons()[0]);
  expect(store.add).toHaveBeenCalledWith(creatine.id,1,variant.id);
  expect(store.add.mock.calls[0]).toHaveLength(3);
});

it("shows both tiers with real per unit prices; choosing a tier sets the quantity that is added",async()=>{
  const {container}=render(React.createElement(ProductPage,{product:creatine}));
  expect(container.querySelector(".bundle-heading")?.textContent).toContain("Buy 2, save 10% · Buy 3+, save 25%");
  const group=screen.getByRole("radiogroup",{name:"Bundle quantity"});
  const [one,two,three]=["Buy 1","Buy 2","Buy 3+"].map(name=>screen.getByRole("radio",{name:new RegExp(`^${name.replace("+","\\+")}`)}));
  expect(group.contains(one)&&group.contains(three)).toBe(true);
  expect(one.getAttribute("aria-checked")).toBe("true");
  expect(one.closest("label")?.textContent).toContain("$48.97");
  expect(two.closest("label")?.textContent).toContain("$44.08");
  expect(three.closest("label")?.textContent).toContain("$36.73");
  expect(container.querySelector(".product-title-row")?.textContent).toContain("$48.97");
  expect(container.querySelector(".bundle-terms")?.textContent).toMatch(/Mix and match any eligible IQON supplements/);
  expect(container.querySelector(".bundle-terms")?.textContent).not.toContain("Gut Health is not");
  fireEvent.click(three);
  await waitFor(()=>expect(three.getAttribute("aria-checked")).toBe("true"));
  expect(screen.getByLabelText("Quantity").textContent).toBe("3");
  expect(addButtons()[0].textContent).toContain("$110.19");
  expect(addButtons()[0].querySelector("s")?.textContent).toBe("$146.91");
  fireEvent.click(addButtons()[0]);
  expect(store.add).toHaveBeenLastCalledWith(creatine.id,3,variant.id);
  fireEvent.click(two);
  await waitFor(()=>expect(addButtons()[0].textContent).toContain("$88.16"));
  expect(container.querySelector(".product-title-row")?.textContent).toContain("$48.97");
});

it("keeps the 3+ tier selected when the stepper goes past three and returns to one",async()=>{
  render(React.createElement(ProductPage,{product:creatine}));
  React.act(()=>quantity.set!(5));
  await waitFor(()=>expect(screen.getByRole("radio",{name:/^Buy 3\+/}).getAttribute("aria-checked")).toBe("true"));
  expect(addButtons()[0].textContent).toContain("$183.65");
  React.act(()=>quantity.set!(1));
  await waitFor(()=>expect(screen.getByRole("radio",{name:/^Buy 1/}).getAttribute("aria-checked")).toBe("true"));
  expect(addButtons()[0].textContent).toContain("$48.97");
  expect(addButtons()[0].querySelector("s")).toBeNull();
});

it("includes Gut Health in the approved bundle tiers",()=>{
  const gut={...products.find(p=>p.id==="gut-health")!,available:true,price:29.99,currency:"USD",variants:[{...variant,price:29.99}]};
  const {container}=render(React.createElement(ProductPage,{product:gut}));
  expect(screen.getByRole("radiogroup",{name:"Bundle quantity"})).toBeTruthy();
  fireEvent.click(screen.getByRole("radio",{name:/^Buy 3/}));
  expect(addButtons()[0].textContent).toContain("$67.50");
  expect(addButtons()[0].querySelector("s")?.textContent).toBe("$89.97");
  expect(container.textContent).not.toContain("not part of the bundle offer");
});

it("a subscription only product cannot be added",()=>{
  render(React.createElement(ProductPage,{product:{...creatine,requiresSellingPlan:true}}));
  expect(screen.getAllByRole("button",{name:/Currently unavailable/})[0].hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("radiogroup",{name:"Bundle quantity"})).toBeNull();
});

it("keeps all eight skincare pages browseable with no purchase controls, even if live availability is stale",()=>{
  const skincare=products.filter(p=>p.category==="skincare");expect(skincare).toHaveLength(8);
  for(const p of skincare){
    const product={...p,available:true,pricePending:false,variants:creatine.variants};
    const {container}=render(React.createElement(ProductPage,{product}));
    expect(screen.getByRole("button",{name:"Not available to order yet"}).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button",{name:/Add to bag/})).toBeNull();
    expect(screen.queryByRole("radiogroup",{name:"Bundle quantity"})).toBeNull();
    expect(container.querySelector(".sticky-purchase")).toBeNull();
    expect(productPrice(product)).toBe("Coming soon");
    expect(dailyProductPrice(product)).toBeNull();
    cleanup();
  }
});

it("variants: switching options keeps one time pricing from the selected variant",()=>{
  const product={...creatine,variants:[{...variant,title:"Small"},{...variant,id:"gid://shopify/ProductVariant/2",title:"Large",price:60}]};
  render(React.createElement(ProductPage,{product}));
  fireEvent.change(screen.getByRole("combobox",{name:"Select option"}),{target:{value:product.variants[1].id}});
  expect(screen.getByRole("radio",{name:/^Buy 2/}).closest("label")?.textContent).toContain("$54");
  fireEvent.click(addButtons()[0]);
  expect(store.add).toHaveBeenLastCalledWith(product.id,1,product.variants[1].id);
});

for(const handle of BUNDLE_ELIGIBLE_HANDLES)it(`${handle}: gallery-first layout and all approved bundle choices`,()=>{
 const product={...products.find(p=>p.id===handle)!,available:true,variants:[variant]};
 const {container}=render(React.createElement(ProductPage,{product}));
 const overview=container.querySelector(".purchase-first #overview")!;
 expect([...overview.children].map(el=>el.className)).toEqual([
  "product-visual-gallery",
  "purchase-panel purchase-panel-summary",
  "purchase-panel purchase-panel-buy",
  "purchase-panel purchase-panel-info",
  "purchase-panel purchase-panel-details",
 ]);
 // The gallery precedes every purchase control in the rendered DOM, so keyboard order matches.
 const gallery=overview.querySelector(".product-visual-gallery")!;
 const controls=overview.querySelectorAll(".bundle-choices [role=radio],.add-to-bag-row button,.product-variant-picker select");
 expect(controls.length).toBeGreaterThan(0);
 for(const control of controls)expect(gallery.compareDocumentPosition(control)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getAllByRole("radio")).toHaveLength(3);
 fireEvent.click(screen.getByRole("radio",{name:/^Buy 2/}));
 fireEvent.click(addButtons()[0]);
 expect(store.add).toHaveBeenLastCalledWith(handle,2,variant.id);
});
it("orders the phone page gallery, name and price, purchase controls, product notes, then details",()=>{
 const {container}=render(React.createElement(ProductPage,{product:creatine}));
 const overview=container.querySelector(".purchase-first #overview")!;
 const gallery=overview.querySelector(".product-visual-gallery")!;
 const summary=overview.querySelector(".purchase-panel-summary")!;
 const buy=overview.querySelector(".purchase-panel-buy")!;
 const info=overview.querySelector(".purchase-panel-info")!;
 const details=overview.querySelector(".purchase-panel-details")!;
 expect(summary.textContent).toContain("Creatine Monohydrate");
 expect(summary.textContent).toContain("$48.97");
 expect(buy.querySelector(".bundle-choices")).toBeTruthy();
 expect(buy.querySelector(".add-to-bag-row")).toBeTruthy();
 expect(buy.querySelector(".purchase-assurance")).toBeTruthy();
 expect(info.querySelector(".product-summary-description")).toBeTruthy();
 expect(info.querySelector(".product-highlights")).toBeTruthy();
 expect(info.querySelector(".product-essentials")).toBeTruthy();
 expect(details.querySelector(".product-accordion")).toBeTruthy();
 const sequence=[gallery,summary,buy,info,details];
 for(let i=1;i<sequence.length;i++)expect(sequence[i-1].compareDocumentPosition(sequence[i])&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 // Product notes follow the purchase controls, not the title.
 expect(buy.compareDocumentPosition(info.querySelector(".product-summary-description")!)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it("does not offer quantity choices for sold-out products or variants",()=>{
 for(const product of [{...creatine,available:false},{...creatine,variants:[{...variant,available:false}]}]){
  render(React.createElement(ProductPage,{product}));
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getAllByRole("button",{name:/Currently unavailable/})[0].hasAttribute("disabled")).toBe(true);
  cleanup();
 }
});
it("keeps unapproved future products at full price while providing quantity choices",()=>{
 const product={...creatine,id:"daily-travel-kit",name:"Daily Travel Kit"};
 const {container}=render(React.createElement(ProductPage,{product}));
 expect(screen.getByRole("radiogroup",{name:"Purchase quantity"})).toBeTruthy();
 expect(container.querySelector(".bundle-heading")?.textContent).toBe("Choose quantity");
 fireEvent.click(screen.getByRole("radio",{name:/^Buy 3/}));
 expect(addButtons()[0].textContent).toContain("$146.91");
 expect(addButtons()[0].querySelector("s")).toBeNull();
 expect(container.textContent).toContain("Each quantity is charged at the regular price.");
});

// Owner decision 10 Nov 2026: qualified skincare shows its own bundle (Buy 2 save 10%, Buy 3+ save 15%).
const skincareVariant={id:"gid://shopify/ProductVariant/52052015710503",title:"Default Title",price:99,currency:"USD",available:true};
const retinol={...products.find(p=>p.id==="retinol-rx")!,available:true,pricePending:false,launchQualified:true,price:99,currency:"USD",variants:[skincareVariant],requiresSellingPlan:false};
it("a qualified skincare product shows the independent skincare bundle at the approved whole-dollar price",async()=>{
 const {container}=render(React.createElement(ProductPage,{product:retinol}));
 expect(container.querySelector(".product-title-row")?.textContent).toMatch(/\$99$/);
 expect(container.querySelector(".bundle-heading strong")?.textContent).toBe("Bundle and save");
 expect(container.querySelector(".bundle-heading span")?.textContent).toBe("Buy 2, save 10% · Buy 3+, save 15%");
 expect(screen.getByRole("radiogroup",{name:"Bundle quantity"})).toBeTruthy();
 const [one,two,three]=["Buy 1","Buy 2","Buy 3+"].map(name=>screen.getByRole("radio",{name:new RegExp(`^${name.replace("+","\\+")}`)}));
 expect(one.closest("label")?.textContent).toContain("One time purchase");
 expect(two.closest("label")?.textContent).toContain("Save 10% on each");
 expect(two.closest("label")?.textContent).toContain("$89.10");
 expect(three.closest("label")?.textContent).toContain("Save 15% on each");
 expect(three.closest("label")?.textContent).toContain("$84.15");
 const terms=container.querySelector(".bundle-terms")?.textContent||"";
 expect(terms).toMatch(/^Mix and match any IQON skincare: every skincare item in your bag counts toward the bundle\./);
 expect(terms).not.toMatch(/supplements:|25%|not part of the bundle offer/);
 expect(container.textContent).not.toMatch(/save 25%|98\.34/);
 fireEvent.click(three);
 await waitFor(()=>expect(three.getAttribute("aria-checked")).toBe("true"));
 expect(addButtons()[0].textContent).toContain("$252.45");
 expect(addButtons()[0].querySelector("s")?.textContent).toBe("$297");
 fireEvent.click(addButtons()[0]);
 expect(store.add).toHaveBeenLastCalledWith("retinol-rx",3,skincareVariant.id);
 fireEvent.click(two);
 await waitFor(()=>expect(addButtons()[0].textContent).toContain("$178.20"));
 React.act(()=>quantity.set!(6));
 await waitFor(()=>expect(three.getAttribute("aria-checked")).toBe("true"));
 expect(addButtons()[0].textContent).toContain("$504.90");
});
it("the eye gel uses its approved $77 price in the skincare tiers",()=>{
 const eye={...products.find(p=>p.id==="firming-peptide-eye-gel")!,available:true,pricePending:false,launchQualified:true,price:77,currency:"USD",variants:[{...skincareVariant,id:"gid://shopify/ProductVariant/52052016955687",price:77}],requiresSellingPlan:false};
 const {container}=render(React.createElement(ProductPage,{product:eye}));
 expect(container.querySelector(".product-title-row")?.textContent).toMatch(/\$77$/);
 expect(screen.getByRole("radio",{name:/^Buy 2/}).closest("label")?.textContent).toContain("$69.30");
 expect(screen.getByRole("radio",{name:/^Buy 3\+/}).closest("label")?.textContent).toContain("$65.45");
});
it("unapproved skincare, legacy skincare and a coming-soon skincare page never show bundle savings",()=>{
 // An unapproved skincare handle, a supplement handle presented as skincare and a skincare handle
 // presented as a supplement never receive bundle savings (held skincare has no purchase controls at all).
 for(const product of [{...retinol,id:"unapproved-test-skincare",name:"Unapproved Test Skincare"},{...retinol,id:"creatine-monohydrate"},{...creatine,id:"retinol-rx",category:"supplements" as const,price:99,variants:[skincareVariant]}]){
  const r=render(React.createElement(ProductPage,{product}));
  expect(r.container.textContent).not.toMatch(/Bundle and save|save 10%|save 15%|save 25%/);
  const heading=r.container.querySelector(".bundle-heading");
  if(heading){
   expect(heading.textContent).toBe("Choose quantity");
   fireEvent.click(screen.getByRole("radio",{name:/^Buy 3/}));
   expect(addButtons()[0].textContent).toContain("$297");
   expect(addButtons()[0].querySelector("s")).toBeNull();
  }
  cleanup();
 }
 const held=products.find(p=>p.id==="retinol-rx")!;
 const r=render(React.createElement(ProductPage,{product:held}));
 expect(r.container.querySelector(".bundle-choices")).toBeNull();
 expect(r.container.textContent).not.toMatch(/Bundle and save|save 15%/);
});
