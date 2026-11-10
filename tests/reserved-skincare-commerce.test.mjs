import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Exercise the real route handlers, Shopify transport and mapping against a
// deterministic Shopify fixture. No credentials, orders or stock writes are used.
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = file => ts.transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
});
const bindingsUrl = dataUrl(`
  export const jar = new Map();
  export const cookieOptions = new Map();
  export const cookies = async () => ({
    get: key => jar.has(key) ? {value: jar.get(key)} : undefined,
    set: (key, value, options) => {jar.set(key, value); cookieOptions.set(key, options);}
  });
  export const headers = async () => new Headers();
`);
const { jar, cookieOptions } = await import(bindingsUrl);
const policyUrl = dataUrl(compile("../lib/commerce-policy.ts"));
const redirectsUrl = dataUrl(compile("../lib/legacy-redirects.ts"));
const withPolicy = file => dataUrl(compile(file).replace('"./commerce-policy"', JSON.stringify(policyUrl)).replace('"./legacy-redirects"', JSON.stringify(redirectsUrl)));
const imports = {
  "./shopify-consent": dataUrl(compile("../lib/shopify-consent.ts")),
  "./commerce-policy": policyUrl,
  react: dataUrl("export const cache = fn => fn;"),
  "next/headers": bindingsUrl,
  "./catalog": dataUrl("export const products = [];"),
  "./merchandise": withPolicy("../lib/merchandise.ts"),
  "./shopify-operations": dataUrl(compile("../lib/shopify-operations.ts")),
  "./shopify": withPolicy("../lib/shopify.ts"),
  "./legacy-redirects": redirectsUrl,
};
const serverSource = compile("../lib/shopify.server.ts").replace(/from "([^"]+)"/g,
  (match, name) => imports[name] ? `from "${imports[name]}"` : match);
const routes = await import(dataUrl(serverSource));
const origin = "https://iqon.example";
const request = (body, path = "cart") => new Request(`${origin}/api/${path}`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const {mapProduct} = await import(imports['./shopify']);
const {isComingSoon,isOrderable} = await import(policyUrl);
const held = ['enzyme-gel-cleanser','hyaluronic-serum','peptide-anti-wrinkle-day-cream'];
const makeProduct = (handle,tags,id='101') => ({handle,title:handle,description:'Synthetic only',productType:'',tags,availableForSale:true,requiresSellingPlan:false,images:{nodes:[]},variants:{pageInfo:{hasNextPage:false},nodes:[{id:`gid://shopify/ProductVariant/${id}`,title:'Default Title',availableForSale:true,price:{amount:'99.00',currencyCode:'USD'}}]}});
test('reserved handles never enter the purchase catalog, regardless of merchandising tags', () => {
  for(const handle of held) for(const tags of [['iqon-supplements'],['iqon-skincare'],['iqon-supplements','iqon-skincare'],[],undefined]) {
    assert.equal(mapProduct(makeProduct(handle,tags),0),null,`${handle}: ${tags}`);
  }
  const ordinary=mapProduct(makeProduct('ordinary-supplement',['iqon-supplements']),0);
  assert.equal(ordinary.available,true); assert.equal(ordinary.price,99);
  assert.equal(mapProduct(makeProduct('unrelated',[]),0),null);
});

const tagCases=[['iqon-supplements'],['iqon-skincare'],['iqon-supplements','iqon-skincare'],[],undefined];
const ordinary=makeProduct('ordinary-supplement',['iqon-supplements'],'1');
const consent={analytics:false,marketing:false,preferences:false,saleOfData:false};
const money=amount=>({amount:String(amount),currencyCode:'USD'});
const line=p=>({id:`line-${p.handle}`,quantity:1,cost:{subtotalAmount:money(99),totalAmount:money(99)},merchandise:{id:p.variants.nodes[0].id,title:'Default Title',product:{handle:p.handle,title:p.title,tags:p.tags}}});
function fixture(t,options={}) {
  const {mode='live',seed=[],remove='ok',inject=false}=options;
  const tags=Object.hasOwn(options,'tags')?options.tags:['iqon-supplements'];
  jar.clear();cookieOptions.clear();
  const keys=['SHOPIFY_STORE_DOMAIN','SHOPIFY_STOREFRONT_PRIVATE_TOKEN','SHOPIFY_API_VERSION'];
  const before=keys.map(k=>process.env[k]);
  process.env.SHOPIFY_STORE_DOMAIN=mode==='preview'?'':'iqon-test.myshopify.com';
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN=mode==='preview'?'':'fixture-only';
  process.env.SHOPIFY_API_VERSION='2026-07';
  t.after(()=>keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i]));
  const catalog=[ordinary,...held.map((id,i)=>makeProduct(id,tags,String(101+i)))];
  const state={cart:null,operations:[],writes:[],consent:undefined};
  const recalc=()=>{
    state.cart.totalQuantity=state.cart.lines.nodes.reduce((n,l)=>n+l.quantity,0);
    state.cart.cost={subtotalAmount:money(state.cart.totalQuantity*99),totalAmount:money(state.cart.totalQuantity*99)};
  };
  const create=nodes=>{state.cart={id:'gid://shopify/Cart/reserved-fixture',checkoutUrl:'https://iqon-test.myshopify.com/checkouts/never-fetch',discountCodes:[],lines:{pageInfo:{hasNextPage:false},nodes}};recalc();};
  if(seed.length){create(seed.map(id=>line(catalog.find(p=>p.handle===id))));jar.set('iqon_shopify_cart',state.cart.id);}
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(String(url),'https://iqon-test.myshopify.com/api/2026-07/graphql.json','no external fetch is permitted');
    const {query,variables}=JSON.parse(options.body),operation=query.match(/(?:query|mutation) (\w+)/)[1];
    state.operations.push(operation);
    if(mode==='unavailable')return new Response('synthetic outage',{status:503});
    if(operation==='IQONCatalog')return Response.json({data:{products:{nodes:mode==='empty'?[]:catalog,pageInfo:{hasNextPage:false,endCursor:null}}}});
    if(operation==='IQONCartRead'||operation==='IQONCheckoutConsent'){
      if(operation==='IQONCheckoutConsent')state.consent=variables.visitorConsent;
      return Response.json({data:{cart:state.cart}});
    }
    state.writes.push({operation,variables});
    const names={IQONCartCreate:'cartCreate',IQONCartAdd:'cartLinesAdd',IQONCartUpdate:'cartLinesUpdate',IQONCartRemove:'cartLinesRemove',IQONCartDiscounts:'cartDiscountCodesUpdate'};
    assert.ok(names[operation],operation);
    if(operation==='IQONCartRemove'){
      if(remove==='transport')throw Error('synthetic transport failure');
      if(remove==='null')return Response.json({data:{cartLinesRemove:{cart:null,userErrors:[]}}});
      if(remove==='ok'||remove==='truncated')state.cart.lines.nodes=state.cart.lines.nodes.filter(l=>!variables.lineIds.includes(l.id));
      if(remove==='truncated')state.cart.lines.pageInfo.hasNextPage=true;
      if(remove==='partial')state.cart.lines.nodes=state.cart.lines.nodes.slice(1);
    } else if(operation==='IQONCartCreate'||operation==='IQONCartAdd'){
      const nodes=(variables.input?.lines||variables.lines).map(v=>({...line(catalog.find(p=>p.variants.nodes[0].id===v.merchandiseId)),quantity:v.quantity}));
      if(!state.cart)create(nodes);else state.cart.lines.nodes.push(...nodes);
    } else if(operation==='IQONCartUpdate'){
      for(const v of variables.lines)state.cart.lines.nodes.find(l=>l.id===v.id).quantity=v.quantity;
    } else state.cart.discountCodes=variables.discountCodes.map(code=>({code,applicable:false}));
    if(inject&&operation!=='IQONCartRemove')state.cart.lines.nodes.push(line(catalog[1]));
    recalc();
    return Response.json({data:{[names[operation]]:{cart:state.cart,userErrors:remove==='errors'?[{message:'Synthetic rejection'}]:[],warnings:[]}}});
  });
  return state;
}
const add=(...args)=>routes.mutateCartResponse(request({action:'add',id:args.length?args[0]:ordinary.handle,variantId:args.length>1?args[1]:ordinary.variants.nodes[0].id,quantity:1}));
const checkout=()=>routes.checkoutResponse(request({visitorConsent:consent},'checkout'));
const safe=async response=>{const body=await response.json();assert.ok(!body.checkoutUrl);assert.ok(!JSON.stringify(body).includes('never-fetch'));assert.ok(!(body.cart?.items||body.items||[]).some(i=>held.includes(i.id)));return body;};

test('purchase policy reserves exact handles even when miscategorized and never broad-matches',()=>{
  for(const id of held)for(const category of ['supplements','skincare',undefined]){
    const p={id,category,available:true,variants:[{available:true}]};
    assert.equal(isComingSoon(p),true);
    for(const mode of ['live','preview','unavailable'])assert.equal(isOrderable(p,mode),false);
  }
  for(const id of [undefined,'ordinary-supplement',...held.map(id=>id+'-extra')])assert.equal(isOrderable({id,category:'supplements',available:true,variants:[{available:true}]},'live'),true);
});
for(const mode of ['live','empty','preview','unavailable'])test(`direct reserved IDs reject before commerce calls: ${mode}`,async t=>{
  const state=fixture(t,{mode});
  for(const [i,id] of held.entries())for(const variant of [`gid://shopify/ProductVariant/${101+i}`,ordinary.variants.nodes[0].id,undefined]){
    const r=await add(id,variant);assert.equal(r.status,422);await safe(r);
  }
  assert.deepEqual(state.operations,[]);assert.equal(jar.size,0);
});
for(const [i,tags] of tagCases.entries())test(`catalog/direct variant rejection with tag case ${i}`,async t=>{
  // An explicit undefined models absent tags, not the fixture default.
  const state=fixture(t,{tags});
  const c=await routes.getStoreCatalog();assert.equal(c.mode,'live');assert.deepEqual(c.products.map(p=>p.id),[ordinary.handle]);
  for(const [j,id] of held.entries()){
    for(const suppliedId of [id,ordinary.handle,undefined,'absent-product']){
      const r=await add(suppliedId,`gid://shopify/ProductVariant/${101+j}`);assert.equal(r.status,422);await safe(r);
    }
  }
  assert.deepEqual(state.writes,[]);assert.equal(jar.size,0);
});
for(const [i,tags] of tagCases.entries())for(const entry of ['read','checkout','update','discount','add'])test(`stale mixed cart sanitized on ${entry}; tag case ${i}`,async t=>{
  const state=fixture(t,{tags,seed:[ordinary.handle,...held]});
  let r;
  if(entry==='read')r=await routes.getCartResponse();
  if(entry==='checkout')r=await checkout();
  if(entry==='update')r=await routes.mutateCartResponse(request({action:'update',lineId:`line-${held[0]}`,quantity:2}));
  if(entry==='discount')r=await routes.mutateCartResponse(request({action:'discount',discountCodes:['INVALID']}));
  if(entry==='add')r=await add();
  assert.equal(r.status,['checkout','update'].includes(entry)?422:200);await safe(r);
  assert.ok(state.cart.lines.nodes.every(l=>l.merchandise.product.handle===ordinary.handle));
  assert.deepEqual(state.writes[0].variables.lineIds,held.map(id=>`line-${id}`));
  assert.ok(!state.writes.some(w=>w.operation==='IQONCartUpdate'));
  const next=await checkout();assert.equal(next.status,200);assert.equal((await next.json()).checkoutUrl,state.cart.checkoutUrl);assert.deepEqual(state.consent,consent);
});
test('held-only carts become empty and cannot check out on retry',async t=>{
  const state=fixture(t,{seed:held});
  for(let i=0;i<2;i++){const r=await checkout();assert.equal(r.status,422);const b=await safe(r);assert.deepEqual(b.cart.items,[]);}
  assert.equal(state.cart.totalQuantity,0);
});
for(const remove of ['retained','partial','errors','null','transport','truncated'])for(const entry of ['read','checkout','update','discount','add'])test(`sanitization ${remove} fails closed on ${entry}`,async t=>{
  const state=fixture(t,{seed:[ordinary.handle,...held],remove});
  const invoke=()=>entry==='read'?routes.getCartResponse():entry==='checkout'?checkout():entry==='add'?add():routes.mutateCartResponse(request(entry==='update'?{action:'update',lineId:`line-${ordinary.handle}`,quantity:2}:{action:'discount',discountCodes:[]}));
  const r=await invoke();assert.ok(r.status>=400);await safe(r);
  assert.ok(state.writes.every(w=>w.operation==='IQONCartRemove'),'no purchase mutation after failed cleanup');
  const retry=await checkout();assert.ok(retry.status>=400);await safe(retry);
});
test('a held line in a mutation response fails closed before setting a new cookie',async t=>{
  fixture(t,{inject:true});const r=await add();assert.ok(r.status>=400);await safe(r);assert.equal(jar.size,0);
});
test('ordinary and absent products preserve checkout and rejection behavior',async t=>{
  const state=fixture(t);
  assert.equal((await checkout()).status,422);
  assert.equal((await add('absent-product')).status,422);assert.deepEqual(state.writes,[]);
  assert.equal((await add()).status,200);assert.equal(jar.size,1);
  assert.equal((await routes.mutateCartResponse(request({action:'update',lineId:`line-${ordinary.handle}`,quantity:2}))).status,200);
  assert.equal((await routes.mutateCartResponse(request({action:'discount',discountCodes:['INVALID']}))).status,200);
  assert.equal((await checkout()).status,200);
  assert.ok(!state.writes.some(w=>w.operation==='IQONCartRemove'));
});
for(const mode of ['preview','unavailable'])test(`ordinary products fail closed in ${mode}`,async t=>{
  const state=fixture(t,{mode,seed:[ordinary.handle,...held]});
  for(const r of [await add(),await routes.getCartResponse(),await checkout()]){assert.ok(r.status>=400);await safe(r);}
  assert.deepEqual(state.writes,[]);
});
test('reserved handles stay held if the broader category launch flag is ever disabled',async()=>{
  const policy=await import(dataUrl(compile('../lib/commerce-policy.ts').replace('SKINCARE_COMING_SOON = true','SKINCARE_COMING_SOON = false')));
  assert.equal(policy.SKINCARE_COMING_SOON,false);
  for(const id of held)assert.equal(policy.isComingSoon({id,category:'supplements'}),true);
  assert.equal(policy.isComingSoon({id:'ordinary-skincare',category:'skincare'}),false);
});
