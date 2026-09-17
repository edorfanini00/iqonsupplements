import { requireAdminSession,isNextResponse } from '@/lib/affiliates/auth-guards';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
import { resourceId } from '@/lib/affiliates/shopify-admin';
/** Shopify owns refunds, return restocking and gateway transactions. */
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const session=await requireAdminSession();if(isNextResponse(session))return session;
  try{const id=resourceId((await context.params).id);return apiSuccess({redirectUrl:`https://admin.shopify.com/store/nr9zd0-t5/orders/${id}`,message:'Complete the refund or return in Shopify. The signed webhook will reconcile affiliate earnings.'});}catch{return apiError('VALIDATION_ERROR','Invalid order.',400);}
}
