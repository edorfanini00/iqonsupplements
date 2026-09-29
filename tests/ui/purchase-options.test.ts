// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductPurchaseOptions } from "../../app/product-purchase-options";
import { ProductPage } from "../../app/shop-pages";
import { products, productPrice, type ProductSellingPlan } from "../../lib/catalog";
import { dailyProductPrice } from "../../app/product-essentials";

const store=vi.hoisted(()=>({add:vi.fn(),products:[] as unknown[],mode:"live",busy:false,ready:true}));
vi.mock("../../app/store-shell",()=>({useStore:()=>store,CartConnectionNotice:()=>null,Quantity:()=>null}));
vi.mock("../../app/product-gallery",()=>({ProductGallery:()=>null}));
vi.mock("../../app/product-story",()=>({ProductStory:()=>null}));
vi.mock("../../app/product-navigation",()=>({ProductSwitcher:()=>null}));
vi.mock("../../app/product-rail",()=>({ProductRail:()=>null}));
vi.mock("../../app/customer-reviews",()=>({CustomerReviews:()=>null,ProductReviewLink:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const plans:ProductSellingPlan[]=[{id:"gid://shopify/SellingPlan/10",name:"Every month",options:[{name:"Deliver",value:"Every month"}],price:26.1,compareAtPrice:29,perDeliveryPrice:26.1,currency:"USD"},{id:"gid://shopify/SellingPlan/20",name:"Every 2 months",options:[{name:"Deliver",value:"Every 2 months"}],price:27.55,compareAtPrice:29,perDeliveryPrice:27.55,currency:"USD"}];
const supplement={...products.find(p=>p.id==="creatine-monohydrate")!,available:true,price:29,currency:"USD",variants:[{id:"gid://shopify/ProductVariant/1",title:"Default Title",price:29,currency:"USD",available:true,sellingPlans:plans}]};

it("selects the real delivery plan and passes its ID to the bag",()=>{
  const {container}=render(React.createElement(ProductPage,{product:supplement}));
  fireEvent.click(screen.getByRole("radio",{name:/Subscribe & save/}));
  expect(container.querySelector(".product-title-row")?.textContent).toContain("$26.10");
  expect(screen.getByRole("radio",{name:/One-time purchase/}).closest("label")?.textContent).toContain("$29");
  fireEvent.change(screen.getByRole("combobox",{name:"Delivery plan"}),{target:{value:plans[1].id}});
  expect(screen.getByText(/\$27.55 per billing cycle/)).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button",{name:/Add subscription/})[0]);
  expect(store.add).toHaveBeenCalledWith(supplement.id,1,"subscription","Every 2 months",supplement.variants[0].id,plans[1].id);
  fireEvent.click(screen.getByRole("radio",{name:/One-time purchase/}));
  fireEvent.click(screen.getAllByRole("button",{name:/Add to bag/})[0]);
  expect(store.add).toHaveBeenLastCalledWith(supplement.id,1,"once","once",supplement.variants[0].id,undefined);
});

it("never invents subscription plans or savings when Shopify has none",()=>{
  render(React.createElement(ProductPage,{product:{...supplement,variants:[{...supplement.variants[0],sellingPlans:[]}]}}));
  expect(screen.queryByRole("radio",{name:/Subscribe/})).toBeNull();
  expect(screen.queryByText(/15%/)).toBeNull();
});

it("shows initial and recurring charges for a phased plan",()=>{
  const plan={...plans[0],recurringPrice:28,initialOrderCount:2};
  render(React.createElement(ProductPurchaseOptions,{purchase:"subscription",setPurchase:vi.fn(),plan,plans:[plan],setPlanId:vi.fn(),oneTimePrice:29,currency:"USD"}));
  expect(screen.getByText(/\$26.10 for the first 2 orders, then \$28 per billing cycle/)).toBeTruthy();
  expect(screen.getByText("Save 10% initially")).toBeTruthy();
});

it("keeps all seven skincare pages browseable with no purchase controls, even if live availability is stale",()=>{
  const skincare=products.filter(p=>p.category==="skincare");expect(skincare).toHaveLength(7);
  for(const p of skincare){
    const product={...p,available:true,pricePending:false,variants:supplement.variants};
    const {container}=render(React.createElement(ProductPage,{product}));
    expect(screen.getByRole("button",{name:"Not available to order yet"}).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button",{name:/Add to bag|Add subscription/})).toBeNull();
    expect(screen.queryByRole("radiogroup",{name:"Purchase option"})).toBeNull();
    expect(container.querySelector(".sticky-purchase")).toBeNull();
    expect(productPrice(product)).toBe("Coming soon");
    expect(dailyProductPrice(product)).toBeNull();
    cleanup();
  }
});
