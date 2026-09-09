import type { CartItem, Product } from "./catalog";

export type ShopifyConfig = {domain:string; token:string; version:string};
export class CommerceError extends Error {
  constructor(message:string, public status=502) { super(message); }
}
export function shopifyConfig(values:Record<string,unknown>): ShopifyConfig | null {
  const domain=String(values.SHOPIFY_STORE_DOMAIN || "").trim().toLowerCase();
  const token=String(values.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || "").trim();
  if(!domain && !token) return null;
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !token)
    throw new CommerceError("The store is temporarily unavailable.",503);
  const version=String(values.SHOPIFY_API_VERSION || "2026-07");
  if(!/^20\d{2}-(01|04|07|10)$/.test(version)) throw new CommerceError("The store is temporarily unavailable.",503);
  return {domain,token,version};
}
export async function shopifyRequest<T>(config:ShopifyConfig, query:string, variables:Record<string,unknown>={}, buyerIP?:string, fetcher:typeof fetch=fetch):Promise<T> {
  const headers:Record<string,string>={"Content-Type":"application/json","Shopify-Storefront-Private-Token":config.token};
  if(buyerIP) headers["Shopify-Storefront-Buyer-IP"]=buyerIP;
  let response:Response;
  try {
    response=await fetcher(`https://${config.domain}/api/${config.version}/graphql.json`, {
      method:"POST",headers,body:JSON.stringify({query,variables}),cache:"no-store",signal:AbortSignal.timeout(12000),
    });
  } catch { throw new CommerceError("We couldn’t reach the store. Please try again."); }
  if(!response.ok) throw new CommerceError("The store is temporarily unavailable. Please try again.",response.status===429?429:502);
  const result=await response.json() as {data?:T;errors?:unknown[]};
  if(result.errors?.length || !result.data) throw new CommerceError("We couldn’t complete that request. Please try again.");
  return result.data;
}

export type ShopifyProduct = {
  handle:string; title:string; description:string; productType:string; tags:string[];
  availableForSale:boolean; requiresSellingPlan:boolean;
  images:{nodes:{url:string;altText:string|null}[]};
  variants:{pageInfo:{hasNextPage:boolean};nodes:{id:string;title:string;availableForSale:boolean;price:{amount:string;currencyCode:string}}[]};
};
export function mapProduct(p:ShopifyProduct, index:number):Product|null {
  // Explicit merchandising tags prevent unrelated products entering this catalog.
  const category=p.tags.includes("iqon-supplements")?"supplements":p.tags.includes("iqon-skincare")?"skincare":null;
  if(!category) return null;
  if(p.variants.pageInfo.hasNextPage) throw new CommerceError("This product’s options are temporarily unavailable.");
  const variants=p.variants.nodes.map(v=>({id:v.id,title:v.title,price:Number(v.price.amount),currency:v.price.currencyCode,available:v.availableForSale}));
  const first=variants.find(v=>v.available) || variants[0];
  if(!first || !Number.isFinite(first.price)) return null;
  const images=p.images.nodes.filter(i=>i.url.startsWith("https://")).map(i=>({src:i.url,alt:i.altText||p.title}));
  // A neutral material photograph is used only when the merchant has no product image.
  const image=images[0]?.src||"/images/store/precision.webp";
  return {id:p.handle,name:p.title,category,type:p.productType||category,number:String(index+1).padStart(2,"0"),
    price:first.price,currency:first.currency,size:first.title==="Default Title"?"":first.title,
    descriptor:"",description:p.description,image,campaign:images[1]?.src||image,tone:"silver",ritual:"",
    images:images.length?images:[{src:image,alt:"IQON material study; product photograph coming soon"}],variants,
    available:p.availableForSale&&!p.requiresSellingPlan,requiresSellingPlan:p.requiresSellingPlan};
}
export type ShopifyCart = {
  id:string; checkoutUrl:string; totalQuantity:number;
  cost:{subtotalAmount:{amount:string;currencyCode:string};totalAmount:{amount:string;currencyCode:string}};
  lines:{pageInfo:{hasNextPage:boolean};nodes:{id:string;quantity:number;cost:{totalAmount:{amount:string;currencyCode:string}};merchandise:{id:string;title:string;image?:{url:string}|null;product:{handle:string;title:string}}}[]};
};
export type CartSnapshot = {items:CartItem[];subtotal:number;currency:string;count:number;notice?:string};
export function publicCart(cart:ShopifyCart|null):CartSnapshot {
  if(!cart) return {items:[],subtotal:0,currency:"USD",count:0};
  if(cart.lines.pageInfo.hasNextPage) throw new CommerceError("Your bag has too many different items. Please contact the store.");
  return {items:cart.lines.nodes.map(line=>({id:line.merchandise.product.handle,lineId:line.id,
    variantId:line.merchandise.id,variantTitle:line.merchandise.title,name:line.merchandise.product.title,
    image:line.merchandise.image?.url,quantity:line.quantity,purchase:"once",frequency:"once",
    amount:Number(line.cost.totalAmount.amount),currency:line.cost.totalAmount.currencyCode})),
    subtotal:Number(cart.cost.subtotalAmount.amount),currency:cart.cost.subtotalAmount.currencyCode,count:cart.totalQuantity};
}
export function sameOrigin(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin) throw new CommerceError("Please refresh the page and try again.",403);
  if(!request.headers.get("content-type")?.startsWith("application/json")) throw new CommerceError("Invalid request.",415);
}
export function validQuantity(value:unknown, allowZero=false):number {
  if(typeof value!=="number" || !Number.isInteger(value) || value<(allowZero?0:1) || value>20) throw new CommerceError("Choose a quantity between 1 and 20.",400);
  return value;
}
