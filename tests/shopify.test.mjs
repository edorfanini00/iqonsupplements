import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../lib/shopify.ts",import.meta.url),"utf8");
const js=ts.transpile(source,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
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
