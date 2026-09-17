import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/db/database';
import { verifyPassword, hashPassword } from '@/lib/affiliates/password';
import { AFFILIATE_SESSION_COOKIE, AFFILIATE_COOKIE_OPTIONS, createPortalSession } from '@/lib/affiliates/session';
import { getAffiliateByPortalUserId } from '@/lib/affiliates/store';
import { getInviteUrl } from '@/lib/affiliates/mailer';
import { enforceRateLimit, checkRateLimit } from '@/lib/affiliates/rate-limit';
import { apiError } from '@/lib/affiliates/api-response';
export const runtime = 'nodejs';
const dummyHash = hashPassword('unusable-dummy-password-for-timing');
export async function POST(request:Request) {
  if (!isDatabaseConfigured()) return apiError('SERVICE_UNAVAILABLE','The affiliate portal is being connected. Please try again later.',503);
  try {
    if (!(await enforceRateLimit(request,'login',10,60_000)).allowed) return apiError('RATE_LIMITED','Too many attempts. Please try again later.',429);
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password || email.length>254 || password.length>256) return apiError('VALIDATION_ERROR','Email and password are required.',400);
    if (!(await checkRateLimit(`login-account:${email}`,20,900_000)).allowed) return apiError('RATE_LIMITED','Too many attempts. Please try again later.',429);
    const account = await prisma.portalAccount.findUnique({where:{email}});
    const valid = await verifyPassword(password, account?.passwordHash ?? await dummyHash);
    if (!valid || !account || account.disabled) return apiError('INVALID_CREDENTIALS','Email or password is incorrect.',401);
    const profile = await getAffiliateByPortalUserId(account.id);
    if (profile?.status === 'pending') return NextResponse.json({ok:true,pending:true,inviteUrl:getInviteUrl(profile.id)});
    if ((profile && profile.status !== 'active') || (account.role==='affiliate' && !profile)) return apiError('FORBIDDEN','This account is not active. Please contact support.',403);
    const token = await createPortalSession(account.id);
    const response = NextResponse.json({ok:true,role:account.role,affiliate:profile ? {id:profile.id,firstName:profile.firstName,lastName:profile.lastName,email:profile.email,promoCode:profile.promoCode,role:account.role} : {id:String(account.id),firstName:'',lastName:'',email,promoCode:'',role:account.role}});
    response.cookies.set(AFFILIATE_SESSION_COOKIE,token,AFFILIATE_COOKIE_OPTIONS);
    return response;
  } catch { return apiError('SERVICE_UNAVAILABLE','Sign in is temporarily unavailable. Please try again later.',503); }
}
