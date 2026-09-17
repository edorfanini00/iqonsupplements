import { cookies } from 'next/headers';
import { relayAffiliateRequest, sharedRelayConfig } from './shared-relay';
import type { Affiliate } from './types';
/** Compatibility names only. Legacy independent portal cookies never authenticate. */
export const AFFILIATE_SESSION_COOKIE = 'iqon_affiliate_wp_jwt';
export const AFFILIATE_COOKIE_OPTIONS = {httpOnly:true,secure:process.env.NODE_ENV === 'production',sameSite:'lax' as const,path:'/',maxAge:2592000};
export interface AffiliateSession {
  portalUserId:number;
  wpUserId:number;
  email:string;
  role:'affiliate'|'admin'|'shop_manager';
  portalRoles:string[];
  profile:Affiliate|null;
}
export async function getAffiliateSession():Promise<AffiliateSession|null> {
  try {
    const {portal}=sharedRelayConfig();
    const store=await cookies();
    const response=await relayAffiliateRequest(new Request(portal+'/api/affiliates/shared-session',{headers:{cookie:store.toString()}}));
    if(!response.ok)return null;
    const {session}=await response.json();
    if(!session || !Number.isSafeInteger(session.wpUserId) || !['admin','affiliate','shop_manager'].includes(session.role) || (session.profile && session.profile.status !== 'active') || (session.role === 'affiliate' && !session.profile))return null;
    return {...session,portalUserId:session.wpUserId,portalRoles:session.wpRoles ?? []};
  } catch {return null;}
}
export async function getLightSession(){const session=await getAffiliateSession();return session?{...session,profileId:session.profile?.id,status:session.profile?.status}:null;}
// Fail closed if an old handler is ever invoked outside middleware.
export async function createPortalSession(_accountId:number):Promise<string>{throw Error('Independent affiliate sessions are disabled');}
export async function revokeCurrentSession():Promise<void>{throw Error('Logout must use the shared authority relay');}
