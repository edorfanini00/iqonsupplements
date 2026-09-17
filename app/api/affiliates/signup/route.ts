import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/db/database';
import { hashPassword } from '@/lib/affiliates/password';
import { getAffiliateByPromoCode,getAffiliateById,formatPromoCode } from '@/lib/affiliates/store';
import { isReservedPromoNickname } from '@/lib/affiliates/commission';
import { getInviteUrl,sendSignupConfirmationEmail } from '@/lib/affiliates/mailer';
import { enforceRateLimit } from '@/lib/affiliates/rate-limit';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
export const runtime='nodejs';
const schema=z.object({firstName:z.string().trim().min(1).max(80),lastName:z.string().trim().min(1).max(80),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),phone:z.string().trim().min(5).max(40),password:z.string().min(12).max(256),nickname:z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),whatsapp:z.string().max(40).optional(),instagram:z.string().max(200).optional(),tiktok:z.string().max(200).optional(),website:z.string().max(500).optional(),ref:z.string().max(100).nullish(),noReferrer:z.boolean().optional()});
export async function POST(request:Request){
  if(!isDatabaseConfigured())return apiError('SERVICE_UNAVAILABLE','Applications will open once the affiliate portal is connected.',503);
  try {
    if(!(await enforceRateLimit(request,'signup',5,900_000)).allowed)return apiError('RATE_LIMITED','Please try again later.',429);
    const parsed=schema.safeParse(await request.json());if(!parsed.success)return apiError('VALIDATION_ERROR',parsed.error.issues[0].message,400);
    const d=parsed.data;
    if(isReservedPromoNickname(d.nickname))return apiError('VALIDATION_ERROR','Choose a nickname without the IQON brand name.',400);
    const promoCode=formatPromoCode(d.nickname);
    let referrerId:string|undefined;
    if(d.ref&&!d.noReferrer){const ref=await getAffiliateByPromoCode(d.ref)??await getAffiliateById(d.ref);if(ref&&ref.role==='affiliate'&&['active','pending'].includes(ref.status)&&ref.email!==d.email)referrerId=ref.id;}
    if((d.ref&&d.noReferrer)||(!referrerId&&!d.noReferrer))return apiError('VALIDATION_ERROR','Select who referred you, or choose “No one referred me”.',400);
    const passwordHash=await hashPassword(d.password);
    const affiliate=await prisma.$transaction(async tx=>{
      const account=await tx.portalAccount.create({data:{email:d.email,passwordHash}});
      return tx.affiliateProfile.create({data:{portalUserId:account.id,firstName:d.firstName,lastName:d.lastName,email:d.email,phone:d.phone,whatsapp:d.whatsapp,promoCode,instagram:d.instagram,tiktok:d.tiktok,website:d.website,portalRole:'affiliate',status:'pending',commissionRate:20,recurringCommissionRate:20,couponRate:15,referrerId}});
    });
    const inviteUrl=getInviteUrl(affiliate.id);
    const sent=await sendSignupConfirmationEmail({firstName:affiliate.firstName,email:affiliate.email,promoCode,inviteUrl});
    return apiSuccess({pending:true,inviteUrl,promoCode,emailSent:sent.ok,message:'Application received. Save your recruitment link. Your account is pending review.'});
  } catch(err){
    if((err as {code?:string}).code==='P2002')return apiError('CONFLICT','Email or creator code is already registered. Try signing in or choose another code.',409);
    return apiError('SERVICE_UNAVAILABLE','We could not submit your application. Please try again later.',503);
  }
}
