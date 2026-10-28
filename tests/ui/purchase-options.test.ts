// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductPage } from "../../app/shop-pages";
import { products, productPrice } from "../../lib/catalog";
import { dailyProductPrice } from "../../app/product-essentials";

const store=vi.hoisted(()=>({add:vi.fn(),products:[] as unknown[],mode:"live",busy:false,ready:true}));
const quantity=vi.hoisted(()=>({set:undefined as undefined|((n:number)=>void)}));
vi.mock("../../app/store-shell",()=>({useStore:()=>store,CartConnectionNotice:()=>null,
  Quantity:({value,setValue}:{value:number;setValue:(n:number)=>void})=>{quantity.set=setValue;return React.createElement("output",{"aria-label":"Quantity"},value);}}));
vi.mock("../../app/product-gallery",()=>({ProductGallery:()=>null}));
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
  expect(two.closest("label")?.textContent).toContain("$44.07");
  expect(three.closest("label")?.textContent).toContain("$36.73");
  expect(container.querySelector(".product-title-row")?.textContent).toContain("$48.97");
  expect(container.querySelector(".bundle-terms")?.textContent).toMatch(/Mix and match any eligible IQON supplements/);
  expect(container.querySelector(".bundle-terms")?.textContent).toContain("Colon Gentle Cleanse is not part of the bundle offer.");
  fireEvent.click(three);
  await waitFor(()=>expect(three.getAttribute("aria-checked")).toBe("true"));
  expect(screen.getByLabelText("Quantity").textContent).toBe("3");
  expect(addButtons()[0].textContent).toContain("$110.18");
  expect(addButtons()[0].querySelector("s")?.textContent).toBe("$146.91");
  fireEvent.click(addButtons()[0]);
  expect(store.add).toHaveBeenLastCalledWith(creatine.id,3,variant.id);
  fireEvent.click(two);
  await waitFor(()=>expect(addButtons()[0].textContent).toContain("$88.15"));
  expect(container.querySelector(".product-title-row")?.textContent).toContain("$48.97");
});

it("keeps the 3+ tier selected when the stepper goes past three and returns to one",async()=>{
  render(React.createElement(ProductPage,{product:creatine}));
  React.act(()=>quantity.set!(5));
  await waitFor(()=>expect(screen.getByRole("radio",{name:/^Buy 3\+/}).getAttribute("aria-checked")).toBe("true"));
  expect(addButtons()[0].textContent).toContain("$183.64");
  React.act(()=>quantity.set!(1));
  await waitFor(()=>expect(screen.getByRole("radio",{name:/^Buy 1/}).getAttribute("aria-checked")).toBe("true"));
  expect(addButtons()[0].textContent).toContain("$48.97");
  expect(addButtons()[0].querySelector("s")).toBeNull();
});

it("shows no bundle tiers or savings on a product outside the offer",()=>{
  const cleanse={...products.find(p=>p.id==="colon-gentle-cleanse")!,available:true,price:66.84,currency:"USD",variants:[{...variant,price:66.84}]};
  const {container}=render(React.createElement(ProductPage,{product:cleanse}));
  expect(screen.queryByRole("radiogroup",{name:"Bundle quantity"})).toBeNull();
  expect(container.textContent).not.toMatch(/save 10%|save 25%|Bundle/);
  React.act(()=>quantity.set!(3));
  expect(addButtons()[0].textContent).toContain("$200.52");
  expect(addButtons()[0].querySelector("s")).toBeNull();
});

it("a subscription only product cannot be added",()=>{
  render(React.createElement(ProductPage,{product:{...creatine,requiresSellingPlan:true}}));
  expect(screen.getAllByRole("button",{name:/Currently unavailable/})[0].hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("radiogroup",{name:"Bundle quantity"})).toBeNull();
});

it("keeps all seven skincare pages browseable with no purchase controls, even if live availability is stale",()=>{
  const skincare=products.filter(p=>p.category==="skincare");expect(skincare).toHaveLength(7);
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
