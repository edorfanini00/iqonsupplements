import { prisma } from '@/lib/db/prisma';
import { tokenHash, hashPassword, validPassword } from '@/lib/affiliates/password';
import { enforceRateLimit } from '@/lib/affiliates/rate-limit';
import { apiError, apiSuccess } from '@/lib/affiliates/api-response';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    if(!(await enforceRateLimit(request,'reset',10,60_000)).allowed) return apiError('RATE_LIMITED','Please try again later.',429);
    const {token,password}=await request.json();
    if(typeof token!=='string'||token.length>256||!validPassword(password)) return apiError('VALIDATION_ERROR','Use a password between 12 and 256 characters.',400);
    const passwordHash=await hashPassword(password);
    const changed=await prisma.$transaction(async tx=>{
      const reset=await tx.affiliatePasswordReset.findUnique({where:{tokenHash:tokenHash(token)}});
      if(!reset||reset.usedAt||reset.expiresAt<=new Date()) return false;
      const account=await tx.portalAccount.findUnique({where:{email:reset.email}});
      if(!account||account.disabled) return false;
      const claim=await tx.affiliatePasswordReset.updateMany({where:{id:reset.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});
      if(claim.count!==1) return false;
      await tx.portalAccount.update({where:{id:account.id},data:{passwordHash}});
      await tx.portalSession.deleteMany({where:{accountId:account.id}});
      await tx.affiliatePasswordReset.updateMany({where:{email:reset.email,usedAt:null},data:{usedAt:new Date()}});
      return true;
    });
    return changed?apiSuccess({message:'Your password has been updated. You can now sign in.'}):apiError('INVALID_TOKEN','This reset link is invalid or has expired. Please request a new one.',400);
  } catch {return apiError('SERVICE_UNAVAILABLE','Password reset is temporarily unavailable.',503);}
}
