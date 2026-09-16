import { verifyShopifyWebhookSignature } from '@/lib/affiliates/shopify-webhook';
import { SUPPLEMENTS_SHOP,resourceId } from '@/lib/affiliates/shopify-admin';
import { getOrder } from '@/lib/portal-commerce';
import { ingestShopifyOrder } from '@/lib/affiliates/shopify-ingest';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
export const runtime='nodejs';
export async function POST(request:Request){
  const raw=await request.text();
  if(Buffer.byteLength(raw)>2_000_000)return apiError('TOO_LARGE','Payload too large.',413);
  if(request.headers.get('x-shopify-shop-domain')!==SUPPLEMENTS_SHOP)return apiError('INVALID_SHOP','Unexpected shop.',401);
  const verified=verifyShopifyWebhookSignature(raw,request.headers.get('x-shopify-hmac-sha256'),process.env.SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET);
  if(!verified.valid)return apiError('INVALID_SIGNATURE','Webhook authentication failed.',401);
  const topic=request.headers.get('x-shopify-topic');
  if(!['orders/paid','orders/updated','orders/cancelled','refunds/create'].includes(topic??''))return apiError('INVALID_TOPIC','Unsupported topic.',400);
  try{
    const payload=JSON.parse(raw);
    const id=resourceId(topic==='refunds/create'?payload.order_id:payload.id);
    // Always fetch canonical current state; late/replayed webhooks cannot undo a refund.
    const order=await getOrder(id);if(!order)return apiError('NOT_FOUND','Order not available yet.',503);
    const result=await ingestShopifyOrder(order,{webhookDeliveryId:request.headers.get('x-shopify-event-id')??request.headers.get('x-shopify-webhook-id')??undefined});
    return apiSuccess({result});
  }catch{return apiError('RETRY','Order reconciliation failed. Retry this delivery.',503);}
}
