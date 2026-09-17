export interface BodySession {
  wpUserId:number;
  portalUserId:number;
  email:string;
  role:'affiliate'|'admin'|'shop_manager';
  portalRoles:string[];
  profile:{id:string;status:'active';firstName:string;lastName:string;promoCode:string;onboardedAt:string|null}|null;
}
const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
/** Explicit v1 DTO projection. Never authenticate by decoded token or snapshot roles. */
export function parseBodySession(value:unknown):BodySession|null {
 if(!record(value) || value.version!==1 || !record(value.session))return null;
 const s=value.session;
 if(typeof s.wpUserId!=='number' || !Number.isSafeInteger(s.wpUserId) || s.wpUserId<=0 || typeof s.email!=='string' || !s.email.trim() || !['affiliate','admin','shop_manager'].includes(String(s.role)) || !Array.isArray(s.wpRoles) || !s.wpRoles.every(r=>typeof r==='string'))return null;
 let profile:BodySession['profile']=null;
 if(s.profile!==null){
  const p=s.profile;
  if(!record(p) || p.status!=='active' || typeof p.id!=='string' || !p.id || typeof p.firstName!=='string' || typeof p.lastName!=='string' || typeof p.promoCode!=='string' || (p.onboardedAt!==null && typeof p.onboardedAt!=='string'))return null;
  profile={id:p.id,status:'active',firstName:p.firstName,lastName:p.lastName,promoCode:p.promoCode,onboardedAt:p.onboardedAt};
 }
 if(s.role==='affiliate' && !profile)return null;
 return {wpUserId:s.wpUserId,portalUserId:s.wpUserId,email:s.email,role:s.role as BodySession['role'],portalRoles:[...s.wpRoles],profile};
}
