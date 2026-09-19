import { cookies } from 'next/headers';
import { relayAffiliateRequest, sharedRelayConfig } from './shared-relay';
import {parseBodySession, type BodySession} from './body-session-dto';
/** Compatibility names only. Legacy independent portal cookies never authenticate. */
export const AFFILIATE_SESSION_COOKIE = 'iqon_affiliate_wp_jwt';
export const AFFILIATE_COOKIE_OPTIONS = {httpOnly:true,secure:process.env.NODE_ENV === 'production',sameSite:'lax' as const,path:'/',maxAge:2592000};
export type AffiliateSession = BodySession;
export async function getAffiliateSession():Promise<AffiliateSession|null> {
  try {
    const {portal}=sharedRelayConfig();
    const store=await cookies();
    const response=await relayAffiliateRequest(new Request(portal+'/api/affiliates/shared-session',{headers:{cookie:store.toString()}}));
    if(!response.ok)return null;
    return parseBodySession(await response.json());
  } catch {return null;}
}
export async function getLightSession(){const session=await getAffiliateSession();return session?{...session,profileId:session.profile?.id,status:session.profile?.status}:null;}
// Fail closed if an old handler is ever invoked outside middleware.
export async function createPortalSession(_accountId:number):Promise<string>{throw Error('Independent affiliate sessions are disabled');}
export async function revokeCurrentSession():Promise<void>{throw Error('Logout must use the shared authority relay');}
