import { requireAdminSession,isNextResponse } from '@/lib/affiliates/auth-guards';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
import { getAllSubscriptions } from '@/lib/subscriptions/store';
import { getAffiliateAttributionForSubscriptions } from '@/lib/affiliates/subscription-attribution';
export async function GET(){
  const session=await requireAdminSession();if(isNextResponse(session))return session;
  try{
    const subscriptions=await getAllSubscriptions();const attribution=await getAffiliateAttributionForSubscriptions(subscriptions);
    return apiSuccess({subscriptions:subscriptions.map(s=>({...s,affiliate:attribution.get(s.id)??null})),summary:{total:subscriptions.length,active:subscriptions.filter(s=>s.status==='active').length}});
  }catch{return apiError('INTEGRATION_UNAVAILABLE','Connect the supplements subscription app with permission to read its Shopify contracts. Contracts owned by another app must be managed in that app.',503);}
}
