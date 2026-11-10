import { isHeldSkincareHandle } from "./skincare-identity";
import { parseVisitorConsent, type VisitorConsent } from "./shopify-consent";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { products, type StoreCatalog } from "./catalog";
import { mergeCatalogMerchandise } from "./merchandise";
import { withComingSoonSkincareCards } from "./new-skincare";
import { isComingSoon, SKINCARE_COMING_SOON } from "./commerce-policy";
import { CATALOG_QUERY, CART_QUERY, CHECKOUT_CONSENT_QUERY, CART_CREATE, CART_ADD, CART_UPDATE, CART_REMOVE, CART_DISCOUNTS } from "./shopify-operations";
import { CommerceError, shopifyConfig, shopifyRequest, mapProduct, publicCart, sameOrigin, validQuantity, validDiscountCodes, type ShopifyCart, type ShopifyProduct } from "./shopify";
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
async function readCatalog():Promise<StoreCatalog> {
  const settings=config();
  if(!settings) return {mode:"preview",products,currency:"USD"};
  const list:StoreCatalog["products"]=[];
  let after:string|null=null;
  do {
    const data:{products:{nodes:ShopifyProduct[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}=await shopifyRequest(settings,CATALOG_QUERY,{after},await buyerIP());
    for(const node of data.products.nodes) {const product=mapProduct(node,list.length); if(product) list.push(product);}
    after=data.products.pageInfo.hasNextPage?data.products.pageInfo.endCursor:null;
    if(data.products.pageInfo.hasNextPage&&!after) throw new CommerceError("The collection is temporarily unavailable.");
  } while(after);
  return {mode:"live",products:withComingSoonSkincareCards(mergeCatalogMerchandise(list,products)),currency:list[0]?.currency||"USD"};
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
async function mutate(query:string,variables:Record<string,unknown>):Promise<CartPayload> {
  const settings=config();
  if(!settings) throw new CommerceError("Orders are not open yet.",503);
  const data=await shopifyRequest<Record<string,CartPayload>>(settings,query,variables,await buyerIP());
  const result=Object.values(data)[0];
  if(result.userErrors.length) throw new CommerceError(result.userErrors.map(e=>e.message).join(" "),422,result.cart?publicCart(result.cart):undefined);
  if(!result.cart) throw new CommerceError("We couldn’t update your bag. Please try again.");
  return result;
}
const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
function fail(error:unknown) {
  return Response.json({error:error instanceof CommerceError?error.message:"We couldn’t update your bag. Please try again.",
    ...(error instanceof CommerceError&&error.cart?{cart:error.cart}:{})},{status:error instanceof CommerceError?error.status:502,headers:responseHeaders});
}
function blockedSkincareLines(cart:ShopifyCart) {
  return cart.lines.nodes.filter(line=>isHeldSkincareHandle(line.merchandise.product.handle)||(SKINCARE_COMING_SOON&&(line.merchandise.product.tags?.includes("iqon-skincare")||products.some(p=>p.id===line.merchandise.product.handle&&isComingSoon(p)))));
}
// Retired supplements (still published in Shopify) can linger in bags created before they were retired.
function retiredLines(cart:ShopifyCart) {
  return cart.lines.nodes.filter(line=>isRetiredProductHandle(line.merchandise.product.handle));
}
type Refreshed={cart:ShopifyCart|null;removed:boolean;removedLineIds:string[];notices:string[]};
async function removeUpcomingProducts(cart:ShopifyCart|null):Promise<Refreshed> {
  if(!cart)return {cart:null,removed:false,removedLineIds:[],notices:[]};
  const skincare=blockedSkincareLines(cart);
  const retired=retiredLines(cart).filter(line=>!skincare.includes(line));
  const blocked=[...skincare,...retired];
  if(!blocked.length)return {cart,removed:false,removedLineIds:[],notices:[]};
  const result=await mutate(CART_REMOVE,{cartId:cart.id,lineIds:blocked.map(line=>line.id)});
  // A successful mutation envelope is not proof that the reserved lines were removed.
  // Validate before any subsequent purchase mutation or checkout handoff.
  if((skincare.some(line=>isHeldSkincareHandle(line.merchandise.product.handle))&&result.cart!.lines.pageInfo.hasNextPage)||result.cart!.lines.nodes.some(line=>isHeldSkincareHandle(line.merchandise.product.handle)))
    throw new CommerceError("Skincare is coming soon. We couldn’t safely refresh your bag. Please try again.");
  const notices=[...(skincare.length?[skincareNotice]:[]),...(retired.length?[retiredNotice]:[])];
  return {cart:result.cart,removed:true,removedLineIds:blocked.map(line=>line.id),notices};
}
const skincareNotice="These skincare items are not available to order and have been removed from your bag; supplements can still be ordered.";
const retiredNotice="Colon Gentle Cleanse has been discontinued and was removed from your bag. Gut Health replaces it.";
export async function getCartResponse() {
  try {const {cart,removed,notices}=await removeUpcomingProducts(await readCart());return Response.json({...publicCart(cart),...(removed?{notice:notices.join(" ")}:{})},{headers:responseHeaders});}catch(error){return fail(error);}
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
    if(input.action==="add"&&isHeldSkincareHandle(input.id))
      throw new CommerceError("Skincare is coming soon and cannot be ordered yet.",422);
    const refreshed=await removeUpcomingProducts(await readCart());
    let current=refreshed.cart;
    let result:CartPayload;
    if(input.action==="add") {
      const quantity=validQuantity(input.quantity);
      const catalog=await readCatalog();
      const product=catalog.products.find(p=>p.id===input.id);
      const variant=product?.variants?.find(v=>v.id===input.variantId);
      if(product&&isComingSoon(product)) throw new CommerceError("Skincare is coming soon and cannot be ordered yet.",422,publicCart(current));
      if(!product||!variant||!variant.available||!product.available) throw new CommerceError("This option is currently unavailable.",422);
      // Subscriptions are retired: a new line is always a one time purchase and never carries a selling plan.
      if(input.sellingPlanId!==undefined||(input.purchase!==undefined&&input.purchase!=="once")) throw new CommerceError("Subscriptions are no longer offered. Choose a one time purchase.",422,publicCart(current));
      const existing=current?.lines.nodes.find(l=>l.merchandise.id===variant.id&&!l.sellingPlanAllocation);
      if(existing && existing.quantity+quantity>20) throw new CommerceError("You can add up to 20 of this option.",422);
      if(!existing && current && current.lines.nodes.length>=99) throw new CommerceError("Your bag is full. Please complete this order first.",422);
      const lines=[{merchandiseId:variant.id,quantity}];
      result=current?await mutate(CART_ADD,{cartId:current.id,lines}):await mutate(CART_CREATE,{input:{lines}});
    } else if(input.action==="update") {
      const quantity=validQuantity(input.quantity,true);
      if(typeof input.lineId==="string"&&refreshed.removedLineIds.includes(input.lineId)) throw new CommerceError(refreshed.notices.join(" "),422,publicCart(current));
      if(!current || !current.lines.nodes.some(l=>l.id===input.lineId)) throw new CommerceError("Your bag has changed. Please review it and try again.",409,publicCart(current));
      result=quantity?await mutate(CART_UPDATE,{cartId:current.id,lines:[{id:input.lineId,quantity}]}):await mutate(CART_REMOVE,{cartId:current.id,lineIds:[input.lineId]});
    } else if(input.action==="discount") {
      const discountCodes=validDiscountCodes(input.discountCodes);
      if(!current?.totalQuantity) throw new CommerceError("Add an item to your bag before applying a code.",422,publicCart(current));
      result=await mutate(CART_DISCOUNTS,{cartId:current.id,discountCodes});
    } else throw new CommerceError("Invalid request.",400);
    current=result.cart!;
    const snapshot=publicCart(current);
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
    const refreshed=await removeUpcomingProducts(await readCart(visitorConsent));
    const cart=refreshed.cart;
    if(refreshed.removed) throw new CommerceError(`${refreshed.notices.join(" ")} Please review your bag before checking out.`,422,publicCart(cart));
    if(!cart?.totalQuantity) throw new CommerceError("Your bag is empty. Add your essentials to continue.",422,publicCart(cart));
    if(cart.lines.pageInfo.hasNextPage) throw new CommerceError("Your bag has too many different items. Please contact the store.",422);
    const url=new URL(cart.checkoutUrl);
    if(url.protocol!=="https:") throw new CommerceError("Checkout is temporarily unavailable.");
    return Response.json({checkoutUrl:cart.checkoutUrl},{headers:responseHeaders});
  }catch(error){return fail(error);}
}
