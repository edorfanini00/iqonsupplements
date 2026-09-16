import { timingSafeEqual } from 'node:crypto';
import { syncShopifyOrders } from '@/lib/affiliates/shopify-sync';
import { jsonNoCache } from '@/lib/api-cache-headers';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(request:Request){
  const secret=process.env.SUPPLEMENTS_CRON_SECRET;
  const actual=Buffer.from(request.headers.get('authorization')??'');const expected=Buffer.from(`Bearer ${secret??''}`);
  if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return jsonNoCache({ok:false,error:'Unauthorized'},{status:401});
  try{return jsonNoCache({ok:true,...await syncShopifyOrders()});}catch{return jsonNoCache({ok:false,error:'Order sync failed; retry with the stored cursor.'},{status:503});}
}
