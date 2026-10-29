import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../lib/shopify.ts",import.meta.url),"utf8");
const policy=ts.transpile(fs.readFileSync(new URL("../lib/commerce-policy.ts",import.meta.url),"utf8"),{module:ts.ModuleKind.ESNext});
const policyUrl="data:text/javascript;base64,"+Buffer.from(policy).toString("base64");
const js=ts.transpile(source,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}).replace('"./commerce-policy"',JSON.stringify(policyUrl));
const {shopifyConfig,shopifyRequest,mapProduct,publicCart,sameOrigin,validQuantity}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const config={domain:"iqon-test.myshopify.com",token:"test-token",version:"2026-07"};
const product={handle:"actual-product",title:"Actual product",description:"Merchant supplied description",productType:"Capsules",tags:["iqon-supplements"],availableForSale:true,requiresSellingPlan:false,
  images:{nodes:[{url:"https://cdn.shopify.com/product.jpg",altText:"Actual packaging"}]},
  variants:{pageInfo:{hasNextPage:false},nodes:[{id:"gid://shopify/ProductVariant/1",title:"30 capsules",availableForSale:false,price:{amount:"29.50",currencyCode:"EUR"}},{id:"gid://shopify/ProductVariant/2",title:"60 capsules",availableForSale:true,price:{amount:"45.75",currencyCode:"EUR"}}]}};

test("configuration requires a complete Shopify domain and private token",()=>{
  assert.equal(shopifyConfig({}),null);
  assert.throws(()=>shopifyConfig({SHOPIFY_STORE_DOMAIN:config.domain}));
  for(const domain of ["evil.example","iqon.myshopify.com.evil.example","https://iqon.myshopify.com","iqon.myshopify.com/redirect"])
    assert.throws(()=>shopifyConfig({SHOPIFY_STORE_DOMAIN:domain,SHOPIFY_STOREFRONT_PRIVATE_TOKEN:"test"}));
  assert.equal(shopifyConfig({SHOPIFY_STORE_DOMAIN:config.domain,SHOPIFY_STOREFRONT_PRIVATE_TOKEN:"test"}).version,"2026-07");
});

test("Shopify transport uses the private header, buyer IP, variables, and no shared cache",async()=>{
  let calls=0;
  const data=await shopifyRequest(config,"query Test { shop { name } }",{id:"example"},"192.0.2.1",async(url,options)=>{
    calls++;
    assert.equal(url,"https://iqon-test.myshopify.com/api/2026-07/graphql.json");
    assert.equal(options.headers["Shopify-Storefront-Private-Token"],"test-token");
    assert.equal(options.headers["Shopify-Storefront-Buyer-IP"],"192.0.2.1");
    assert.equal(options.cache,"no-store");
    assert.deepEqual(JSON.parse(options.body).variables,{id:"example"});
    return Response.json({data:{shop:{name:"IQON"}}});
  });
  assert.equal(calls,1);assert.equal(data.shop.name,"IQON");
});

test("transport failures do not return provider details or credentials",async()=>{
  await assert.rejects(shopifyRequest(config,"query Test { shop { name } }",{},undefined,async()=>Response.json({errors:[{message:"private test-token"}]})),e=>!e.message.includes("test-token"));
  await assert.rejects(shopifyRequest(config,"query Test { shop { name } }",{},undefined,async()=>new Response("private test-token",{status:429})),e=>e.status===429&&!e.message.includes("test-token"));
});

test("product mapping preserves merchant images, variant prices, stock, and currency",()=>{
  const p=mapProduct(product,0);
  assert.equal(p.name,"Actual product");assert.equal(p.image,product.images.nodes[0].url);
  assert.equal(p.price,45.75);assert.equal(p.currency,"EUR");assert.equal(p.size,"60 capsules");
  assert.equal(p.variants[0].available,false);assert.equal(p.variants[1].id,"gid://shopify/ProductVariant/2");
  assert.equal(p.description,product.description);
});

test("untagged products are excluded and subscription-only products cannot enter one-time checkout",()=>{
  assert.equal(mapProduct({...product,tags:["research-use-only"]},0),null);
  assert.equal(mapProduct({...product,requiresSellingPlan:true},0).available,false);
  assert.equal(mapProduct({...product,availableForSale:false},0).available,false);
  assert.throws(()=>mapProduct({...product,variants:{...product.variants,pageInfo:{hasNextPage:true}}},0));
});

test("cart snapshots preserve Shopify totals while removing the cart secret and checkout link",()=>{
  const cart={id:"gid://shopify/Cart/example?key=private-cart-secret",checkoutUrl:"https://example.myshopify.com/checkouts/private",totalQuantity:2,
    cost:{subtotalAmount:{amount:"85.25",currencyCode:"EUR"},totalAmount:{amount:"88.50",currencyCode:"EUR"}},
    lines:{pageInfo:{hasNextPage:false},nodes:[{id:"line-1",quantity:2,cost:{totalAmount:{amount:"85.25",currencyCode:"EUR"}},merchandise:{id:"variant-2",title:"60 capsules",image:{url:product.images.nodes[0].url},product:{handle:product.handle,title:product.title}}}]}};
  const out=publicCart(cart);
  assert.equal(out.subtotal,85.25);assert.equal(out.items[0].amount,85.25);assert.equal(out.currency,"EUR");
  assert.equal(out.items[0].lineId,"line-1");assert.equal(out.count,2);
  assert.ok(!JSON.stringify(out).includes("private"));assert.ok(!("id" in out));assert.ok(!("checkoutUrl" in out));
  assert.deepEqual(publicCart(null).items,[]);
  assert.throws(()=>publicCart({...cart,lines:{...cart.lines,pageInfo:{hasNextPage:true}}}));
});

test("cart writes reject foreign origins, non-JSON bodies, and malformed quantities",()=>{
  const request=(origin,type="application/json")=>new Request("https://iqon.example/api/cart",{method:"POST",headers:{origin,"content-type":type}});
  assert.doesNotThrow(()=>sameOrigin(request("https://iqon.example")));
  assert.throws(()=>sameOrigin(request("https://evil.example")));
  assert.throws(()=>sameOrigin(request("https://iqon.example","text/plain")));
  assert.throws(()=>sameOrigin(new Request("https://iqon.example/api/cart")));
  for(const value of [0,-1,21,1.5,"2",null,NaN,Infinity])assert.throws(()=>validQuantity(value));
  assert.equal(validQuantity(20),20);assert.equal(validQuantity(0,true),0);
});

const subscriptionAllocation = {sellingPlan:{id:"gid://shopify/SellingPlan/1",name:"Every month",recurringDeliveries:true,options:[{name:"Delivery",value:"Monthly"}]},priceAdjustments:[{price:{amount:"40.00",currencyCode:"EUR"}}]};
const withPlans = (allocations, requiresSellingPlan=true) => ({...product,requiresSellingPlan,variants:{pageInfo:{hasNextPage:false},nodes:[{...product.variants.nodes[1],sellingPlanAllocations:{pageInfo:{hasNextPage:false},nodes:allocations}}]}});
test("subscriptions are retired: selling plans never reach the storefront and subscription only products cannot be bought",()=>{
  const required=mapProduct(withPlans([subscriptionAllocation]),0);
  assert.equal(required.available,false);assert.equal("sellingPlans" in required.variants[0],false);
  const optional=mapProduct(withPlans([subscriptionAllocation],false),0);
  assert.equal(optional.available,true);assert.equal(optional.price,45.75);assert.ok(!JSON.stringify(optional).includes("gid://shopify/SellingPlan"));
});
test("skincare stays unavailable even with a live Shopify listing",()=>{
  const p=mapProduct({...withPlans([subscriptionAllocation],false),tags:["iqon-skincare"]},0);
  assert.equal(p.available,false);
});
test("bundle discount allocations are summed per discount and keep Shopify's line amounts",()=>{
  const m=(amount)=>({amount,currencyCode:"USD"});
  const line=(id,qty,sub,total,allocations)=>({id,quantity:qty,cost:{subtotalAmount:m(sub),totalAmount:m(total)},discountAllocations:allocations,merchandise:{id:`v-${id}`,title:"Default Title",product:{handle:id,title:id}}});
  const cart={id:"gid://shopify/Cart/x?key=secret",checkoutUrl:"https://x.myshopify.com/c",totalQuantity:3,
    cost:{subtotalAmount:m("110.18"),totalAmount:m("110.18")},discountAllocations:[],
    lines:{pageInfo:{hasNextPage:false},nodes:[line("creatine-monohydrate",2,"97.94","73.45",[{discountedAmount:m("24.49"),title:"Bundle: Buy 3, save 25%"}]),
      line("colostrum-powder",1,"42.17","31.63",[{discountedAmount:m("10.54"),title:"Bundle: Buy 3, save 25%"}]),line("unapproved-test-supplement",1,"66.84","66.84",[])]}};
  const out=publicCart(cart);
  assert.equal(out.merchandise,206.95);assert.deepEqual(out.lineDiscounts,[{title:"Bundle: Buy 3, save 25%",amount:35.03}]);
  assert.equal(out.items[0].amount,73.45);assert.equal(out.items[0].compareAmount,97.94);assert.equal("compareAmount" in out.items[2],false);
  assert.deepEqual(out.orderDiscounts,[]);assert.equal(out.total,110.18);
  const coded=publicCart({...cart,discountAllocations:[{discountedAmount:m("5.00"),code:"CREATOR"}],cost:{...cart.cost,totalAmount:m("105.18")}});
  assert.deepEqual(coded.orderDiscounts,[{title:"CREATOR",amount:5}]);assert.equal(coded.total,105.18);
});
