import { isActiveSkincareHandle, isHeldSkincareHandle, isLegacySkincareHandle } from "./skincare-identity";
import { isQualifiedLine, launchBindings, NO_QUALIFICATION, qualifySkincare, SKINCARE_QUALIFICATION_QUERY, UNAVAILABLE_QUALIFICATION, type SkincareQualification } from "./skincare-launch";
import { parseVisitorConsent, type VisitorConsent } from "./shopify-consent";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { products, type StoreCatalog } from "./catalog";
import { mergeCatalogMerchandise } from "./merchandise";
import { launchedSkincareProduct, withComingSoonSkincareCards } from "./new-skincare";
import { isComingSoon, SKINCARE_COMING_SOON } from "./commerce-policy";
import { CATALOG_QUERY, CART_QUERY, CHECKOUT_CONSENT_QUERY, CART_CREATE, CART_ADD, CART_UPDATE, CART_REMOVE, CART_DISCOUNTS } from "./shopify-operations";
import { CommerceError, shopifyConfig, shopifyRequest, mapProduct, publicCart, sameOrigin, validQuantity, validDiscountCodes, type LineAllowance, type ShopifyCart, type ShopifyConfig, type ShopifyProduct } from "./shopify";
import { isRetiredProductHandle } from "./legacy-redirects";

// Standard server environment variables work on Vercel and on the retained
// Worker target with nodejs_compat_populate_process_env enabled.
function config() { return shopifyConfig(process.env); }
async function buyerIP() {
  const requestHeaders=await headers();
  // Vercel overwrites x-forwarded-for at its edge; Cloudflare sets cf-connecting-ip.
  return process.env.VERCEL
    ? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined
    : requestHeaders.get("cf-connecting-ip") || undefined;
}
/** Fresh S8939 qualification for the committed identity; never cached across requests.
 * No complete binding = nothing qualifies (no request). Any transport/GraphQL error = unavailable. */
function startQualification(settings:ShopifyConfig):(foreignVariantIds?:ReadonlySet<string>)=>Promise<SkincareQualification> {
  const bindings=launchBindings(settings.domain);
  if(!bindings.length) return async()=>NO_QUALIFICATION;
  const nodes=buyerIP().then(ip=>shopifyRequest<{nodes:unknown[]}>(settings,SKINCARE_QUALIFICATION_QUERY,{ids:bindings.map(b=>b.variantId)},ip)).then(d=>d.nodes,()=>null);
  return async foreign=>{const n=await nodes;return n===null?UNAVAILABLE_QUALIFICATION:qualifySkincare(bindings,n,foreign);};
}
function readQualification(settings:ShopifyConfig):Promise<SkincareQualification> { return startQualification(settings)(); }
const skincareLine=(line:ShopifyCart["lines"]["nodes"][number])=>isHeldSkincareHandle(line.merchandise.product.handle)||!!line.merchandise.product.tags?.includes("iqon-skincare");
async function qualificationFor(cart:ShopifyCart|null, force=false):Promise<SkincareQualification> {
  const settings=config();
  if(!settings||(!force&&!cart?.lines.nodes.some(skincareLine))) return NO_QUALIFICATION;
  return readQualification(settings);
}
const allowance=(q:SkincareQualification):LineAllowance=>line=>isActiveSkincareHandle(line.merchandise.product.handle)&&isQualifiedLine(q,line);
async function readCatalog():Promise<StoreCatalog> {
  const settings=config();
  if(!settings) return {mode:"preview",products,currency:"USD"};
  // Fresh qualification runs alongside catalog pagination (one request, never cached across requests).
  const qualification=startQualification(settings);
  const list:StoreCatalog["products"]=[];
  let after:string|null=null;
  do {
    const data:{products:{nodes:ShopifyProduct[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}=await shopifyRequest(settings,CATALOG_QUERY,{after},await buyerIP());
    for(const node of data.products.nodes) {const product=mapProduct(node,list.length); if(product) list.push(product);}
    after=data.products.pageInfo.hasNextPage?data.products.pageInfo.endCursor:null;
    if(data.products.pageInfo.hasNextPage&&!after) throw new CommerceError("The collection is temporarily unavailable.");
  } while(after);
  // Exact-handle skincare never comes from the generic mapper; only a fresh, exact qualification
  // replaces an informational card with a purchasable record (approved content, live price/stock).
  const q=await qualification(new Set(list.flatMap(p=>p.variants?.map(v=>v.id)||[])));
  const launched=[...q.qualified.values()].map(launchedSkincareProduct).filter(p=>!!p);
  return {mode:"live",products:withComingSoonSkincareCards([...mergeCatalogMerchandise(list,products),...launched]),currency:list[0]?.currency||"USD"};
}
// Request-scoped memoization only; no buyer-specific data in global caches.
export const getStoreCatalog=cache(async():Promise<StoreCatalog>=>{
  try {return await readCatalog();}
  catch {return {mode:"unavailable",products:withComingSoonSkincareCards([]),currency:"USD"};}
});

const CART_COOKIE="iqon_shopify_cart";
async function cartId() {return (await cookies()).get(CART_COOKIE)?.value;}
async function setCartId(id:string,request:Request) {
  (await cookies()).set(CART_COOKIE,id,{httpOnly:true,secure:new URL(request.url).protocol==="https:",sameSite:"lax",path:"/",maxAge:60*60*24*10});
}
async function readCart(visitorConsent?:VisitorConsent):Promise<ShopifyCart|null> {
  const settings=config();
  if(!settings) throw new CommerceError("Orders are not open yet.",503);
  const id=await cartId();
  if(!id) return null;
  const result=await shopifyRequest<{cart:ShopifyCart|null}>(settings,visitorConsent?CHECKOUT_CONSENT_QUERY:CART_QUERY,
    visitorConsent?{id,visitorConsent}:{id},await buyerIP());
  return result.cart;
}
type CartPayload={cart:ShopifyCart|null;userErrors:{message:string}[];warnings?:{message:string}[]};
async function mutate(query:string,variables:Record<string,unknown>,allowed?:LineAllowance):Promise<CartPayload> {
  const settings=config();
  if(!settings) throw new CommerceError("Orders are not open yet.",503);
  const data=await shopifyRequest<Record<string,CartPayload>>(settings,query,variables,await buyerIP());
  const result=Object.values(data)[0];
  if(result.userErrors.length) throw new CommerceError(result.userErrors.map(e=>e.message).join(" "),422,result.cart?publicCart(result.cart,allowed):undefined);
  if(!result.cart) throw new CommerceError("We couldn’t update your bag. Please try again.");
  return result;
}
const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
function fail(error:unknown) {
  return Response.json({error:error instanceof CommerceError?error.message:"We couldn’t update your bag. Please try again.",
    ...(error instanceof CommerceError&&error.cart?{cart:error.cart}:{})},{status:error instanceof CommerceError?error.status:502,headers:responseHeaders});
}
function blockedSkincareLines(cart:ShopifyCart,q:SkincareQualification) {
  return cart.lines.nodes.filter(line=>!allowance(q)(line)&&(isHeldSkincareHandle(line.merchandise.product.handle)||(SKINCARE_COMING_SOON&&(line.merchandise.product.tags?.includes("iqon-skincare")||products.some(p=>p.id===line.merchandise.product.handle&&isComingSoon(p))))));
}
// Retired supplements (still published in Shopify) can linger in bags created before they were retired.
function retiredLines(cart:ShopifyCart) {
  return cart.lines.nodes.filter(line=>isRetiredProductHandle(line.merchandise.product.handle));
}
type Refreshed={cart:ShopifyCart|null;removed:boolean;removedLineIds:string[];notices:string[]};
async function removeUpcomingProducts(cart:ShopifyCart|null,q:SkincareQualification):Promise<Refreshed> {
  if(!cart)return {cart:null,removed:false,removedLineIds:[],notices:[]};
  // Never mutate a bag (or hand out checkout) on an unconfirmed qualification.
  if(q.status!=="ok"&&cart.lines.nodes.some(skincareLine)) throw new CommerceError("We couldn’t confirm skincare availability right now. Please try again.",503);
  const skincare=blockedSkincareLines(cart,q);
  const retired=retiredLines(cart).filter(line=>!skincare.includes(line));
  const blocked=[...skincare,...retired];
  if(!blocked.length)return {cart,removed:false,removedLineIds:[],notices:[]};
  const result=await mutate(CART_REMOVE,{cartId:cart.id,lineIds:blocked.map(line=>line.id)},allowance(q));
  // A successful mutation envelope is not proof that the reserved lines were removed.
  // Validate before any subsequent purchase mutation or checkout handoff.
  if((skincare.some(line=>isHeldSkincareHandle(line.merchandise.product.handle))&&result.cart!.lines.pageInfo.hasNextPage)||result.cart!.lines.nodes.some(line=>isHeldSkincareHandle(line.merchandise.product.handle)&&!allowance(q)(line)))
    throw new CommerceError("We couldn’t safely refresh your bag. Please try again.");
  // Notice wording only: legacy formulas are permanently retired, so they never get the "right now" notice.
  const legacy=skincare.filter(line=>isLegacySkincareHandle(line.merchandise.product.handle));
  const notices=[...(skincare.length>legacy.length?[skincareNotice]:[]),...(legacy.length?[legacyNotice(legacy.length)]:[]),...(retired.length?[retiredNotice]:[])];
  return {cart:result.cart,removed:true,removedLineIds:blocked.map(line=>line.id),notices};
}
const skincareNotice="These skincare items are not available to order right now and have been removed from your bag.";
const legacyNotice=(count:number)=>count===1?"This earlier formula is not available to order. It has been removed from your bag.":"These earlier formulas are not available to order. They have been removed from your bag.";
const retiredNotice="Colon Gentle Cleanse has been discontinued and was removed from your bag. Gut Health replaces it.";
export async function getCartResponse() {
  try {const raw=await readCart();const q=await qualificationFor(raw);const {cart,removed,notices}=await removeUpcomingProducts(raw,q);return Response.json({...publicCart(cart,allowance(q)),...(removed?{notice:notices.join(" ")}:{})},{headers:responseHeaders});}catch(error){return fail(error);}
}
export async function mutateCartResponse(request:Request) {
  try {
    sameOrigin(request);
    if(Number(request.headers.get("content-length")||0)>4096) throw new CommerceError("Invalid request.",413);
    const text=await request.text();
    if(text.length>4096) throw new CommerceError("Invalid request.",413);
    let input:Record<string,unknown>;
    try {input=JSON.parse(text);}catch {throw new CommerceError("Invalid request.",400);}
    if(!input||typeof input!=="object"||Array.isArray(input)) throw new CommerceError("Invalid request.",400);
    if(input.action==="add"&&isLegacySkincareHandle(input.id))
      throw new CommerceError("This earlier formula is not available to order.",422);
    const skincareAdd=input.action==="add"&&isActiveSkincareHandle(input.id);
    // Every mutation re-qualifies from fresh provider data; a previously shown price/stock is never trusted.
    // An unqualified skincare add is refused before the bag is read or changed.
    const addQualification=skincareAdd?await qualificationFor(null,true):null;
    const addEntry=addQualification?.qualified.get(input.id as string);
    if(addQualification&&(addQualification.status!=="ok"||!addEntry||typeof input.variantId!=="string"||addEntry.variantId!==input.variantId))
      throw new CommerceError("This product isn’t available to order right now.",422);
    const raw=await readCart();
    const q=addQualification??await qualificationFor(raw);
    const allowed=allowance(q);
    const refreshed=await removeUpcomingProducts(raw,q);
    let current=refreshed.cart;
    let result:CartPayload;
    if(input.action==="add") {
      const quantity=validQuantity(input.quantity);
      const qualified=skincareAdd?q.qualified.get(input.id as string):undefined;
      const product=qualified?launchedSkincareProduct(qualified):(await readCatalog()).products.find(p=>p.id===input.id);
      const variant=product?.variants?.find(v=>v.id===input.variantId);
      if(product&&isComingSoon(product)) throw new CommerceError("This product isn’t available to order right now.",422,publicCart(current,allowed));
      if(!product||!variant||!variant.available||!product.available) throw new CommerceError("This option is currently unavailable.",422);
      // Subscriptions are retired: a new line is always a one time purchase and never carries a selling plan.
      if(input.sellingPlanId!==undefined||(input.purchase!==undefined&&input.purchase!=="once")) throw new CommerceError("Subscriptions are no longer offered. Choose a one time purchase.",422,publicCart(current,allowed));
      const existing=current?.lines.nodes.find(l=>l.merchandise.id===variant.id&&!l.sellingPlanAllocation);
      if(existing && existing.quantity+quantity>20) throw new CommerceError("You can add up to 20 of this option.",422);
      // Overselling is denied against the fresh provider quantity, not a nominal count.
      if(qualified&&(existing?.quantity||0)+quantity>qualified.quantityAvailable) throw new CommerceError(`Only ${qualified.quantityAvailable} available right now.`,422,publicCart(current,allowed));
      if(!existing && current && current.lines.nodes.length>=99) throw new CommerceError("Your bag is full. Please complete this order first.",422);
      const lines=[{merchandiseId:variant.id,quantity}];
      result=current?await mutate(CART_ADD,{cartId:current.id,lines},allowed):await mutate(CART_CREATE,{input:{lines}},allowed);
    } else if(input.action==="update") {
      const quantity=validQuantity(input.quantity,true);
      if(typeof input.lineId==="string"&&refreshed.removedLineIds.includes(input.lineId)) throw new CommerceError(refreshed.notices.join(" "),422,publicCart(current,allowed));
      const line=current?.lines.nodes.find(l=>l.id===input.lineId);
      if(!current || !line) throw new CommerceError("Your bag has changed. Please review it and try again.",409,publicCart(current,allowed));
      const limit=isActiveSkincareHandle(line.merchandise.product.handle)?q.qualified.get(line.merchandise.product.handle)?.quantityAvailable:undefined;
      if(limit!==undefined&&quantity>limit) throw new CommerceError(`Only ${limit} available right now.`,422,publicCart(current,allowed));
      result=quantity?await mutate(CART_UPDATE,{cartId:current.id,lines:[{id:input.lineId,quantity}]},allowed):await mutate(CART_REMOVE,{cartId:current.id,lineIds:[input.lineId]},allowed);
    } else if(input.action==="discount") {
      const discountCodes=validDiscountCodes(input.discountCodes);
      if(!current?.totalQuantity) throw new CommerceError("Add an item to your bag before applying a code.",422,publicCart(current,allowed));
      result=await mutate(CART_DISCOUNTS,{cartId:current.id,discountCodes},allowed);
    } else throw new CommerceError("Invalid request.",400);
    current=result.cart!;
    const snapshot=publicCart(current,allowed);
    await setCartId(current.id,request);
    const notices=[...refreshed.notices,...(result.warnings?.map(w=>w.message)||[])];
    if(notices.length) snapshot.notice=notices.join(" ");
    return Response.json(snapshot,{headers:responseHeaders});
  } catch(error) {return fail(error);}
}
export async function checkoutResponse(request:Request) {
  try {
    sameOrigin(request);
    const text=await request.text();
    if(text.length>1024)throw new CommerceError("Invalid request.",413);
    let visitorConsent;
    try {visitorConsent=parseVisitorConsent((text?JSON.parse(text):{}).visitorConsent);}catch {throw new CommerceError("Invalid request.",400);}
    if(request.headers.get("Sec-GPC")==="1")visitorConsent={...visitorConsent,marketing:false,saleOfData:false};
    // Validate the same fresh cart that carries consent into its checkout URL.
    const raw=await readCart(visitorConsent);
    const q=await qualificationFor(raw);
    const allowed=allowance(q);
    const refreshed=await removeUpcomingProducts(raw,q);
    const cart=refreshed.cart;
    if(refreshed.removed) throw new CommerceError(`${refreshed.notices.join(" ")} Please review your bag before checking out.`,422,publicCart(cart,allowed));
    if(!cart?.totalQuantity) throw new CommerceError("Your bag is empty. Add your essentials to continue.",422,publicCart(cart,allowed));
    if(cart.lines.pageInfo.hasNextPage) throw new CommerceError("Your bag has too many different items. Please contact the store.",422);
    // Same fresh qualification bounds every skincare line before any checkout URL is returned.
    for(const line of cart.lines.nodes){
      const entry=allowed(line)?q.qualified.get(line.merchandise.product.handle):undefined;
      if(entry&&line.quantity>entry.quantityAvailable) throw new CommerceError(`Only ${entry.quantityAvailable} of ${line.merchandise.product.title} available right now. Please update your bag.`,422,publicCart(cart,allowed));
      if(skincareLine(line)&&!entry) throw new CommerceError("Skincare in your bag is not available to order. Please review your bag.",422);
    }
    const url=new URL(cart.checkoutUrl);
    if(url.protocol!=="https:") throw new CommerceError("Checkout is temporarily unavailable.");
    return Response.json({checkoutUrl:cart.checkoutUrl},{headers:responseHeaders});
  }catch(error){return fail(error);}
}
