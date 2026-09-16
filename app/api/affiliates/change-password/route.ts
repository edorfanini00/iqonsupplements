import { requireAffiliateSession,isNextResponse } from '@/lib/affiliates/auth-guards';
import { prisma } from '@/lib/db/prisma';
import { hashPassword,verifyPassword,validPassword } from '@/lib/affiliates/password';
import { enforceRateLimit } from '@/lib/affiliates/rate-limit';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
export async function POST(request:Request) {
  const session=await requireAffiliateSession();if(isNextResponse(session))return session;
  if(!(await enforceRateLimit(request,'change-password',8,60_000)).allowed)return apiError('RATE_LIMITED','Try again later.',429);
  const {currentPassword,newPassword}=await request.json();
  if(typeof currentPassword!=='string'||!validPassword(newPassword))return apiError('VALIDATION_ERROR','Use a new password between 12 and 256 characters.',400);
  const account=await prisma.portalAccount.findUnique({where:{id:session.portalUserId}});
  if(!account||!await verifyPassword(currentPassword,account.passwordHash))return apiError('INVALID_CREDENTIALS','Your current password is incorrect.',400);
  await prisma.$transaction(async tx=>{await tx.portalAccount.update({where:{id:account.id},data:{passwordHash:await hashPassword(newPassword)}});await tx.portalSession.deleteMany({where:{accountId:account.id}});});
  return apiSuccess({message:'Password updated. Please sign in again.'});
}
