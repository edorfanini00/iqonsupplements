#!/usr/bin/env node
// Read-only by default. --cart also creates and empties a test cart; never places an order.
import fs from "node:fs";
import ts from "typescript";

async function loadTypeScript(path) {
  const source=fs.readFileSync(new URL(path,import.meta.url),"utf8");
  const js=ts.transpile(source,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
const {shopifyConfig,shopifyRequest,mapProduct}=await loadTypeScript("../lib/shopify.ts");
const {CATALOG_QUERY,CART_CREATE,CART_QUERY,CART_REMOVE}=await loadTypeScript("../lib/shopify-operations.ts");
const launch=JSON.parse(fs.readFileSync(new URL("../docs/shopify-launch-catalog.json",import.meta.url),"utf8"));

async function check() {
  const config=shopifyConfig(process.env);
  if(!config) throw new Error("Set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_PRIVATE_TOKEN in the runtime environment first.");
  if(config.domain!==launch.storeDomain) throw new Error("The configured store does not match the IQON launch catalog.");
  const nodes=[];
  const cursors=new Set();
  let after=null;
  do {
    const {products}=await shopifyRequest(config,CATALOG_QUERY,{after});
    nodes.push(...products.nodes);
    if(!products.pageInfo.hasNextPage) break;
    after=products.pageInfo.endCursor;
    if(!after||cursors.has(after)) throw new Error("Shopify returned an invalid catalog cursor.");
    cursors.add(after);
  } while(after);

  const problems=[];
  for(const expected of launch.products) {
    const node=nodes.find(p=>p.handle===expected.handle);
    if(!node) {problems.push(`${expected.handle}: not visible to this Headless storefront (check draft status and publication).`);continue;}
    const mapped=mapProduct(node,0);
    if(!mapped) {problems.push(`${expected.handle}: no usable variant.`);continue;}
    if(!mapped.available) problems.push(`${expected.handle}: unavailable; confirm inventory, market, and selling-plan settings.`);
    if(node.images.nodes.length<expected.media.length) problems.push(`${expected.handle}: expected ${expected.media.length} product images.`);
    if(mapped.variants.length!==1) problems.push(`${expected.handle}: the launch manifest expects one format variant.`);
    for(const variant of mapped.variants) {
      if(variant.currency!==launch.currency) problems.push(`${expected.handle}: expected ${launch.currency}, received ${variant.currency}.`);
      if(variant.price!==Number(expected.proposedPrice)) problems.push(`${expected.handle}: Shopify price differs from the proposal; update the manifest after approving a new price.`);
      if(variant.title!==expected.size) problems.push(`${expected.handle}: pack format differs from the launch manifest.`);
    }
  }
  console.log(`Visible IQON products: ${nodes.length}; expected launch products: ${launch.products.length}.`);
  if(problems.length) {
    for(const problem of problems) console.error(`CHECK: ${problem}`);
    throw new Error("Launch checks need attention. No order or payment was created.");
  }
  console.log("Catalog, USD prices, images, formats and availability match the launch manifest.");

  if(process.argv.includes("--cart")) {
    const variant=nodes.flatMap(p=>p.variants.nodes).find(v=>v.availableForSale);
    if(!variant) throw new Error("No available variant for the cart check.");
    let cart;
    try {
      const {cartCreate}=await shopifyRequest(config,CART_CREATE,{input:{lines:[{merchandiseId:variant.id,quantity:1}]}});
      cart=cartCreate.cart;
      if(cartCreate.userErrors.length||cartCreate.warnings?.length||!cart) throw new Error("Shopify could not create the test cart cleanly.");
      const read=await shopifyRequest(config,CART_QUERY,{id:cart.id});
      if(!read.cart||read.cart.totalQuantity!==1||read.cart.lines.nodes[0]?.merchandise.id!==variant.id) throw new Error("Test cart did not retain its item.");
      const checkout=new URL(read.cart.checkoutUrl);
      if(checkout.protocol!=="https:") throw new Error("Shopify did not return an HTTPS checkout URL.");
      console.log("Cart creation, persistence and secure checkout URL passed. Payment completion still requires a checkout test in Shopify test mode.");
    } finally {
      if(cart?.lines.nodes.length) {
        const {cartLinesRemove}=await shopifyRequest(config,CART_REMOVE,{cartId:cart.id,lineIds:cart.lines.nodes.map(line=>line.id)});
        if(cartLinesRemove.userErrors.length||cartLinesRemove.cart?.totalQuantity!==0) throw new Error("The test cart could not be emptied; no order was placed.");
        console.log("Test cart emptied. No order or charge was created.");
      }
    }
  }
}
try {await check();}
catch(error) {
  // No config objects, cart secrets, checkout URLs or provider response bodies in logs.
  console.error(error instanceof Error?error.message:"Shopify launch check failed.");
  process.exitCode=1;
}
