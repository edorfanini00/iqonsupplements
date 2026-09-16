import { shopifyAdminConfigured,shopifyAdmin } from './shopify-admin';
import { ORDERS_QUERY } from './shopify-queries';
import { getOrder,normalizeOrder,type AdminOrder } from '@/lib/portal-commerce';
export const shopifyConfigured=shopifyAdminConfigured;
/** Replay recent updates (including refunds), oldest first for recurring attribution. */
export async function fetchRecentShopifyOrders(perPage=100){
  const data=await shopifyAdmin<{orders:{nodes:AdminOrder[];pageInfo:{hasNextPage:boolean}}}>(ORDERS_QUERY.replace('sortKey:CREATED_AT','sortKey:UPDATED_AT,reverse:true'),{first:Math.min(100,Math.max(1,perPage)),query:'test:false'});
  return data.orders.nodes.map(normalizeOrder).sort((a,b)=>a.date_created.localeCompare(b.date_created));
}
export const fetchShopifyOrderById=getOrder;
