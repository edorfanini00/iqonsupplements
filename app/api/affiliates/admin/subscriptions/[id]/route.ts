import { requireAdminSession,isNextResponse } from '@/lib/affiliates/auth-guards';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
import { changeSubscription } from '@/lib/subscriptions/store';
import { writeAuditLog } from '@/lib/affiliates/audit';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const session=await requireAdminSession();if(isNextResponse(session))return session;
  const {id}=await context.params;const {action}=await request.json();
  if(!['pause','resume','cancel'].includes(action))return apiError('VALIDATION_ERROR','Manage billing frequency, line items and immediate charges in the Shopify subscription app.',400);
  try{const contract=await changeSubscription(id,action);await writeAuditLog({actorPortalUserId:session.portalUserId,actorEmail:session.email,action:`subscription.${action}`,after:{contractId:id},request});return apiSuccess({status:contract.status.toLowerCase()});}catch(e){return apiError('SHOPIFY_ERROR',e instanceof Error?e.message:'Subscription could not be changed.',502);}
}
