import { cache } from "react";
import { cookies, headers } from "next/headers";
import { products, type StoreCatalog } from "./catalog";
import { mergeSkincareMerchandise } from "./merchandise";
import { CATALOG_QUERY, CART_QUERY, CART_CREATE, CART_ADD, CART_UPDATE, CART_REMOVE } from "./shopify-operations";
import { CommerceError, shopifyConfig, shopifyRequest, mapProduct, publicCart, sameOrigin, validQuantity, type ShopifyCart, type ShopifyProduct } from "./shopify";

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
  return {mode:"live",products:mergeSkincareMerchandise(list,products),currency:list[0]?.currency||"USD"};
}
// Request-scoped memoization only; no buyer-specific data in global caches.
export const getStoreCatalog=cache(async():Promise<StoreCatalog>=>{
  try {return await readCatalog();}
  catch {return {mode:"unavailable",products:[],currency:"USD"};}
});

const CART_COOKIE="iqon_shopify_cart";
async function cartId() {return (await cookies()).get(CART_COOKIE)?.value;}
async function setCartId(id:string,request:Request) {
  (await cookies()).set(CART_COOKIE,id,{httpOnly:true,secure:new URL(request.url).protocol==="https:",sameSite:"lax",path:"/",maxAge:60*60*24*10});
}
async function readCart():Promise<ShopifyCart|null> {
  const settings=config();
  if(!settings) throw new CommerceError("Orders are not open yet.",503);
  const id=await cartId();
  if(!id) return null;
  const result=await shopifyRequest<{cart:ShopifyCart|null}>(settings,CART_QUERY,{id},await buyerIP());
  return result.cart;
}
type CartPayload={cart:ShopifyCart|null;userErrors:{message:string}[];warnings?:{message:string}[]};
async function mutate(query:string,variables:Record<string,unknown>):Promise<CartPayload> {
  const settings=config();
  if(!settings) throw new CommerceError("Orders are not open yet.",503);
  const data=await shopifyRequest<Record<string,CartPayload>>(settings,query,variables,await buyerIP());
  const result=Object.values(data)[0];
  if(result.userErrors.length) throw new CommerceError(result.userErrors.map(e=>e.message).join(" "),422);
  if(!result.cart) throw new CommerceError("We couldn’t update your bag. Please try again.");
  return result;
}
const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
function fail(error:unknown) {
  return Response.json({error:error instanceof CommerceError?error.message:"We couldn’t update your bag. Please try again."},{status:error instanceof CommerceError?error.status:502,headers:responseHeaders});
}
export async function getCartResponse() {
  try {return Response.json(publicCart(await readCart()),{headers:responseHeaders});}catch(error){return fail(error);}
}
export async function mutateCartResponse(request:Request) {
  try {
    sameOrigin(request);
    if(Number(request.headers.get("content-length")||0)>4096) throw new CommerceError("Invalid request.",413);
    const text=await request.text();
    if(text.length>4096) throw new CommerceError("Invalid request.",413);
    let input:Record<string,unknown>;
    try {input=JSON.parse(text);}catch {throw new CommerceError("Invalid request.",400);}
    if(!input||typeof input!=="object") throw new CommerceError("Invalid request.",400);
    let current=await readCart();
    let result:CartPayload;
    if(input.action==="add") {
      const quantity=validQuantity(input.quantity);
      const catalog=await readCatalog();
      const product=catalog.products.find(p=>p.id===input.id);
      const variant=product?.variants?.find(v=>v.id===input.variantId);
      if(!product||!variant||!variant.available||!product.available) throw new CommerceError("This option is currently unavailable.",422);
      const existing=current?.lines.nodes.find(l=>l.merchandise.id===variant.id);
      if(existing && existing.quantity+quantity>20) throw new CommerceError("You can add up to 20 of this option.",422);
      if(!existing && current && current.lines.nodes.length>=99) throw new CommerceError("Your bag is full. Please complete this order first.",422);
      const lines=[{merchandiseId:variant.id,quantity}];
      result=current?await mutate(CART_ADD,{cartId:current.id,lines}):await mutate(CART_CREATE,{input:{lines}});
    } else if(input.action==="update") {
      const quantity=validQuantity(input.quantity,true);
      if(!current || !current.lines.nodes.some(l=>l.id===input.lineId)) throw new CommerceError("Your bag has changed. Refresh it and try again.",409);
      result=quantity?await mutate(CART_UPDATE,{cartId:current.id,lines:[{id:input.lineId,quantity}]}):await mutate(CART_REMOVE,{cartId:current.id,lineIds:[input.lineId]});
    } else throw new CommerceError("Invalid request.",400);
    current=result.cart!;
    await setCartId(current.id,request);
    const snapshot=publicCart(current);
    if(result.warnings?.length) snapshot.notice=result.warnings.map(w=>w.message).join(" ");
    return Response.json(snapshot,{headers:responseHeaders});
  } catch(error) {return fail(error);}
}
export async function checkoutResponse(request:Request) {
  try {
    sameOrigin(request);
    // Refresh immediately before handing the buyer to Shopify's hosted checkout.
    const cart=await readCart();
    if(!cart?.totalQuantity) throw new CommerceError("Your bag is empty.",422);
    const url=new URL(cart.checkoutUrl);
    if(url.protocol!=="https:") throw new CommerceError("Checkout is temporarily unavailable.");
    return Response.json({checkoutUrl:cart.checkoutUrl},{headers:responseHeaders});
  }catch(error){return fail(error);}
}
