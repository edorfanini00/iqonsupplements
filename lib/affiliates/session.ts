import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/db/database';
import { getAffiliateByPortalUserId } from '@/lib/affiliates/store';
import { tokenHash } from './password';
import type { Affiliate } from './types';
export const AFFILIATE_SESSION_COOKIE = 'iqon_supplements_portal';
export const AFFILIATE_COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 7 };
export interface AffiliateSession {
  portalUserId: number;
  email: string;
  role: 'affiliate' | 'admin' | 'shop_manager';
  portalRoles: string[];
  profile: Affiliate | null;
}
export async function getAffiliateSession(): Promise<AffiliateSession | null> {
  if (!isDatabaseConfigured()) return null;
  const token = (await cookies()).get(AFFILIATE_SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.portalSession.findUnique({where:{tokenHash:tokenHash(token)},include:{account:true}});
  if (!session || session.expiresAt <= new Date() || session.account.disabled) return null;
  const account = session.account;
  if (!['admin','affiliate','shop_manager'].includes(account.role)) return null;
  const profile = await getAffiliateByPortalUserId(account.id);
  if (profile && profile.status !== 'active') return null;
  if (account.role === 'affiliate' && !profile) return null;
  return {portalUserId:account.id,email:account.email,role:account.role as AffiliateSession['role'],portalRoles:[account.role],profile};
}
export async function getLightSession() {
  const session = await getAffiliateSession();
  return session ? {...session,profileId:session.profile?.id,status:session.profile?.status} : null;
}
export async function createPortalSession(accountId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.portalSession.create({data:{tokenHash:tokenHash(token),accountId,expiresAt:new Date(Date.now()+AFFILIATE_COOKIE_OPTIONS.maxAge*1000)}});
  return token;
}
export async function revokeCurrentSession() {
  const token = (await cookies()).get(AFFILIATE_SESSION_COOKIE)?.value;
  if (token && isDatabaseConfigured()) await prisma.portalSession.deleteMany({where:{tokenHash:tokenHash(token)}});
}
