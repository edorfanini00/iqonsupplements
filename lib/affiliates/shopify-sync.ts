import { prisma } from '@/lib/db/prisma';
import { shopifyAdmin } from './shopify-admin';
import { ORDERS_QUERY } from './shopify-queries';
import { normalizeOrder,type AdminOrder } from '@/lib/portal-commerce';
import { ingestShopifyOrder } from './shopify-ingest';
interface SyncState {from:string;through?:string;cursor?:string|null}
/** Durable cursor: capped invocations resume the same window without dropping orders. */
export async function syncShopifyOrders(maxPages=8){
  const key='supplements-shopify-sync';
  const saved=await prisma.appPortalConfig.findUnique({where:{id:key}});
  if(!saved)throw new Error('Run affiliate bootstrap to initialize the program start date.');
  const state=JSON.parse(saved.json) as SyncState;
  const through=state.through??new Date().toISOString();
  let after=state.cursor??null;let hasMore=false;let fetched=0;let ingested=0;
  const query=ORDERS_QUERY.replace('sortKey:CREATED_AT','sortKey:UPDATED_AT');
  for(let page=0;page<maxPages;page++){
    const data:{orders:{nodes:AdminOrder[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}=await shopifyAdmin(query,{first:50,after,query:`test:false updated_at:>='${state.from}' updated_at:<='${through}'`});
    for(const raw of data.orders.nodes){const result=await ingestShopifyOrder(normalizeOrder(raw));fetched++;if(result.ingested)ingested++;}
    hasMore=data.orders.pageInfo.hasNextPage;after=data.orders.pageInfo.endCursor;
    const next:SyncState=hasMore?{from:state.from,through,cursor:after}:{from:new Date(new Date(through).getTime()-5*60_000).toISOString()};
    await prisma.appPortalConfig.update({where:{id:key},data:{json:JSON.stringify(next)}});
    if(!hasMore)break;
  }
  await prisma.portalSession.deleteMany({where:{expiresAt:{lt:new Date()}}});
  await prisma.portalRateLimit.deleteMany({where:{expiresAt:{lt:new Date()}}});
  return {fetched,ingested,skipped:fetched-ingested,hasMore};
}
