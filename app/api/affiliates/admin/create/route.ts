import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/affiliates/password';
import { getAffiliateById,formatPromoCode,createAffiliatePasswordReset } from '@/lib/affiliates/store';
import { getPasswordResetUrl,sendPasswordResetEmail } from '@/lib/affiliates/mailer';
import { syncAffiliateCoupon } from '@/lib/affiliates/coupon-sync';
import { requireAdminSession,isNextResponse } from '@/lib/affiliates/auth-guards';
import { writeAuditLog } from '@/lib/affiliates/audit';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
const rate=z.number().finite().min(0).max(100);
const schema=z.object({firstName:z.string().trim().min(1).max(80),lastName:z.string().trim().min(1).max(80),email:z.string().email().max(254).transform(s=>s.trim().toLowerCase()),phone:z.string().max(40).optional(),nickname:z.string().min(2).max(30),role:z.enum(['affiliate','admin']).default('affiliate'),commissionRate:rate.default(20),recurringCommissionRate:rate.default(20),couponRate:rate.default(15),referrerId:z.string().nullish(),referralCommissionRate:rate.optional(),sendEmail:z.boolean().optional()});
export async function POST(request:Request){
  const session=await requireAdminSession();if(isNextResponse(session))return session;
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return apiError('VALIDATION_ERROR',parsed.error.issues[0].message,400);
  const d=parsed.data;
  if(d.referrerId){const ref=await getAffiliateById(d.referrerId);if(!ref||ref.status!=='active')return apiError('VALIDATION_ERROR','Choose an active referrer.',400);}
  try{
    const passwordHash=await hashPassword(randomBytes(32).toString('base64url'));
    const record=await prisma.$transaction(async tx=>{const account=await tx.portalAccount.create({data:{email:d.email,role:d.role,passwordHash}});return tx.affiliateProfile.create({data:{firstName:d.firstName,lastName:d.lastName,email:d.email,phone:d.phone??'',promoCode:formatPromoCode(d.nickname),portalRole:d.role,status:d.role==='admin'?'active':'pending',portalUserId:account.id,commissionRate:d.commissionRate,recurringCommissionRate:d.recurringCommissionRate,couponRate:d.couponRate,referrerId:d.referrerId,referralCommissionRate:d.referralCommissionRate}});});
    const affiliate=await getAffiliateById(record.id);
    let setupWarning:string|undefined;
    if(d.role==='affiliate'&&affiliate){try{const sync=await syncAffiliateCoupon({...affiliate,status:'active'});if(sync.status==='error')throw new Error();await prisma.affiliateProfile.update({where:{id:record.id},data:{status:'active',reviewedAt:new Date()}});}catch{setupWarning='Account created and awaiting approval. Connect Shopify, then approve it from Requests.';}}
    let emailResult:Awaited<ReturnType<typeof sendPasswordResetEmail>>|null=null;
    if(d.sendEmail!==false){const reset=await createAffiliatePasswordReset(d.email,60);if(reset)emailResult=await sendPasswordResetEmail({firstName:d.firstName,email:d.email,resetUrl:getPasswordResetUrl(reset.token),expiresMinutes:60});}
    await writeAuditLog({actorPortalUserId:session.portalUserId,actorEmail:session.email,action:'affiliate_create',targetAffiliateId:record.id,after:{email:d.email,role:d.role},request});
    return apiSuccess({affiliate:await getAffiliateById(record.id),email:emailResult,warning:setupWarning});
  }catch(e){if((e as {code?:string}).code==='P2002')return apiError('CONFLICT','Email or creator code is already registered.',409);return apiError('INTERNAL_ERROR','Account creation failed. Please try again.',500);}
}
