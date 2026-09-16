import { requireAdminSession,isNextResponse } from '@/lib/affiliates/auth-guards';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
import { shopifyAdminConfigured } from '@/lib/affiliates/shopify-admin';
import { syncShopifyOrders } from '@/lib/affiliates/shopify-sync';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(){const session=await requireAdminSession();if(isNextResponse(session))return session;return apiSuccess({configured:shopifyAdminConfigured()});}
export async function POST(){const session=await requireAdminSession();if(isNextResponse(session))return session;try{return apiSuccess({...await syncShopifyOrders(),results:[]});}catch(e){return apiError('SYNC_FAILED',e instanceof Error?e.message:'Order sync failed.',503);}}
