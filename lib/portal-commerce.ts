/** Shopify Admin data normalized for the ported portal's accounting/order views. */
import type { ShopifyOrder,ShopifyProduct } from '@/types/portal-commerce';
import { shopifyAdmin,resourceId } from '@/lib/affiliates/shopify-admin';
import { ORDERS_QUERY,ORDER_QUERY,PRODUCTS_QUERY,CUSTOMERS_QUERY } from '@/lib/affiliates/shopify-queries';
export type MoneyBag={shopMoney:{amount:string;currencyCode?:string}};
type Address={firstName?:string;lastName?:string;address1?:string;address2?:string;city?:string;provinceCode?:string;zip?:string;countryCodeV2?:string;phone?:string};
export type AdminOrder={id:string;legacyResourceId:string;name:string;createdAt:string;processedAt?:string;updatedAt:string;cancelledAt?:string|null;test:boolean;displayFinancialStatus:string;displayFulfillmentStatus:string;currencyCode:string;email?:string;currentTotalPriceSet:MoneyBag;currentSubtotalPriceSet:MoneyBag;currentShippingPriceSet:MoneyBag;currentTotalTaxSet:MoneyBag;currentTotalDiscountsSet:MoneyBag;customer?:{id:string;firstName?:string;lastName?:string;email?:string}|null;billingAddress?:Address|null;shippingAddress?:Address|null;discountCodes:string[];lineItems:{nodes:{id:string;name:string;quantity:number;currentQuantity:number;sku?:string;product?:{id:string}|null;image?:{url:string}|null;originalUnitPriceSet:MoneyBag;discountedTotalSet:MoneyBag;originalTotalSet:MoneyBag}[];pageInfo:{hasNextPage:boolean}};fulfillments:{trackingInfo:{company?:string;number?:string;url?:string}[]}[]};
function address(a:Address|null|undefined){return {first_name:a?.firstName??'',last_name:a?.lastName??'',address_1:a?.address1??'',address_2:a?.address2??'',city:a?.city??'',state:a?.provinceCode??'',postcode:a?.zip??'',country:a?.countryCodeV2??'',phone:a?.phone??''};}
export function normalizeOrder(o:AdminOrder):ShopifyOrder {
  if(o.lineItems.pageInfo.hasNextPage)throw new Error('An order has more than 100 lines; expand the integration before processing it.');
  if(o.currencyCode!=='USD')throw new Error('The supplements affiliate ledger currently requires shop currency USD.');
  const paid=['PAID','PARTIALLY_REFUNDED'].includes(o.displayFinancialStatus);
  const status=o.test?'failed':o.cancelledAt?'cancelled':o.displayFinancialStatus==='REFUNDED'?'refunded':paid?(o.displayFulfillmentStatus==='FULFILLED'?'completed':'processing'):o.displayFinancialStatus==='VOIDED'?'cancelled':'pending';
  return {id:resourceId(o.legacyResourceId),status,updated_at:o.updatedAt,currency:o.currencyCode,date_created:o.createdAt,date_paid:paid?o.processedAt??o.createdAt:null,total:o.currentTotalPriceSet.shopMoney.amount,shipping_total:o.currentShippingPriceSet.shopMoney.amount,total_tax:o.currentTotalTaxSet.shopMoney.amount,discount_total:o.currentTotalDiscountsSet.shopMoney.amount,customer_id:o.customer?resourceId(o.customer.id):undefined,billing:{...address(o.billingAddress),email:o.email??o.customer?.email??''},shipping:address(o.shippingAddress),coupon_lines:o.discountCodes.map(code=>({code})),line_items:o.lineItems.nodes.map(l=>({id:l.id,product_id:l.product?resourceId(l.product.id):0,name:l.name,quantity:l.currentQuantity,price:l.originalUnitPriceSet.shopMoney.amount,subtotal:l.originalTotalSet.shopMoney.amount,total:l.discountedTotalSet.shopMoney.amount,image:l.image?{src:l.image.url}:undefined})),meta_data:[{key:'_shopify_order_name',value:o.name},{key:'_wc_shipment_tracking_items',value:o.fulfillments.flatMap(f=>f.trackingInfo.map(t=>({tracking_provider:t.company,tracking_number:t.number,custom_tracking_link:t.url})))}]};
}
type Page<T>={nodes:T[];pageInfo:{hasNextPage:boolean;endCursor:string|null}};
export async function listPaidOrders(opts?:{after?:string;before?:string;maxPages?:number;statuses?:string[];fields?:string}):Promise<{orders:ShopifyOrder[];truncated:boolean}> {
  const filters=['test:false'];
  if(opts?.after)filters.push(`created_at:>='${new Date(opts.after).toISOString()}'`);
  if(opts?.before)filters.push(`created_at:<='${new Date(opts.before).toISOString()}'`);
  const statuses=opts?.statuses?.length?opts.statuses:['processing','completed'];
  const orders:ShopifyOrder[]=[];let cursor:string|null=null;let more=false;
  for(let page=0;page<(opts?.maxPages??30);page++){
    const data: {orders:Page<AdminOrder>} = await shopifyAdmin(ORDERS_QUERY,{first:50,after:cursor,query:filters.join(' ')});
    for(const raw of data.orders.nodes){const order=normalizeOrder(raw);if(statuses.includes(order.status))orders.push(order);}
    more=data.orders.pageInfo.hasNextPage;cursor=data.orders.pageInfo.endCursor;if(!more)break;
  }
  return {orders,truncated:more};
}
export async function getOrder(id:number):Promise<ShopifyOrder|null>{
  const data=await shopifyAdmin<{order:AdminOrder|null}>(ORDER_QUERY,{id:`gid://shopify/Order/${resourceId(id)}`});
  return data.order?normalizeOrder(data.order):null;
}
export async function getStoreRevenueSummary(opts?:{after?:string;before?:string;maxPages?:number}){
  const result=await listPaidOrders(opts);const orders=result.orders.map(o=>({dateCreated:o.date_created,total:Number(o.total)}));
  return {totalRevenue:Math.round(orders.reduce((s,o)=>s+o.total,0)*100)/100,totalOrders:orders.length,truncated:result.truncated,orders};
}
export async function getProducts(_opts?:{per_page?:number}):Promise<ShopifyProduct[]>{
  type Product={id:string;title:string;handle:string;descriptionHtml:string;status:string;totalInventory:number;featuredImage?:{url:string;altText?:string}|null;variants:{nodes:{price:string;compareAtPrice?:string|null;inventoryQuantity?:number|null}[]}};
  const out:ShopifyProduct[]=[];let after:string|null=null;
  for(let page=0;page<30;page++){
    const data:{products:Page<Product>}=await shopifyAdmin(PRODUCTS_QUERY,{after});
    for(const p of data.products.nodes){const v=p.variants.nodes[0];out.push({id:resourceId(p.id),name:p.title,slug:p.handle,permalink:`/products/${p.handle}`,type:'simple',status:'publish',description:p.descriptionHtml,price:v?.price??'0',regular_price:v?.compareAtPrice??v?.price??'0',sale_price:v?.price??'0',on_sale:Boolean(v?.compareAtPrice&&Number(v.compareAtPrice)>Number(v.price)),stock_status:(v?.inventoryQuantity??1)>0?'instock':'outofstock',stock_quantity:p.totalInventory,images:p.featuredImage?[{id:0,src:p.featuredImage.url,alt:p.featuredImage.altText??p.title}]:[]});}
    if(!data.products.pageInfo.hasNextPage)return out;after=data.products.pageInfo.endCursor;
  }
  throw new Error('Catalog pagination limit reached.');
}
export async function getProduct(idOrSlug:string){return (await getProducts()).find(p=>String(p.id)===idOrSlug||p.slug===idOrSlug)??null;}
export async function registeredCustomers(maxPages=30){
  type Customer={id:string;email?:string;firstName?:string;lastName?:string;createdAt:string;emailMarketingConsent?:{marketingState:string}|null};
  const customers:{id:number;email?:string;first_name?:string;last_name?:string;date_created:string}[]=[];let after:string|null=null;let more=false;
  for(let page=0;page<maxPages;page++){
    const data:{customers:Page<Customer>}=await shopifyAdmin(CUSTOMERS_QUERY,{after});
    for(const c of data.customers.nodes)if(c.emailMarketingConsent?.marketingState==='SUBSCRIBED')customers.push({id:resourceId(c.id),email:c.email,first_name:c.firstName,last_name:c.lastName,date_created:c.createdAt});
    more=data.customers.pageInfo.hasNextPage;after=data.customers.pageInfo.endCursor;if(!more)break;
  }
  return {customers,truncated:more};
}
