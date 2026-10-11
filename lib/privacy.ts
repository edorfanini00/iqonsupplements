// Visitor privacy choices for the headless storefront. Shared by the browser and server.
// A purpose is granted only by an explicit true. null means no choice was expressed.
export const PRIVACY_PURPOSES=["analytics","marketing","preferences","saleOfData"] as const;
export type PrivacyPurpose=typeof PRIVACY_PURPOSES[number];
export type PrivacyChoices=Record<PrivacyPurpose,boolean|null>;
export type PrivacyRestriction=Partial<Record<PrivacyPurpose,false>>;
export type PrivacyState={choices:PrivacyChoices;revision:number;decidedAt:number|null};
export type PrivacySnapshot=PrivacyState&{gpc:boolean;effective:PrivacyChoices;advertisingAllowed:boolean};
export type VisitorConsent=Partial<Record<PrivacyPurpose,boolean>>;

export const PRIVACY_COOKIE="iqon_privacy";
// __Host- cookies cannot be set by sibling subdomains or scoped to another path.
export const SECURE_PRIVACY_COOKIE="__Host-iqon_privacy";
export const PRIVACY_MAX_AGE=60*60*24*365;
export const MAX_REVISION=999_999_999;
export const UNKNOWN_CHOICES:PrivacyChoices=Object.freeze({analytics:null,marketing:null,preferences:null,saleOfData:null});
// Global Privacy Control is an expressed opt out of sale, sharing and targeted advertising.
const GPC_PURPOSES:PrivacyPurpose[]=["marketing","saleOfData"];

export class PrivacyInputError extends Error {}

const code=(value:boolean|null)=>value===true?"1":value===false?"0":"n";
const decode=(value:string)=>value==="1"?true:value==="0"?false:null;

export function encodePrivacyCookie(state:PrivacyState):string {
  return `v1.${PRIVACY_PURPOSES.map(p=>code(state.choices[p])).join("")}.${state.revision}.${state.decidedAt??0}`;
}
// Unreadable, future dated or expired values never yield a grant.
export function parsePrivacyCookie(value:string|undefined, now=Date.now()):PrivacyState {
  const match=/^v1\.([10n]{4})\.(\d{1,9})\.(\d{1,12})$/.exec(value||"");
  if(!match) return {choices:{...UNKNOWN_CHOICES},revision:0,decidedAt:null};
  const revision=Number(match[2]);const decidedAt=Number(match[3]);const seconds=Math.floor(now/1000);
  if(!decidedAt||decidedAt>seconds+300||seconds-decidedAt>PRIVACY_MAX_AGE) return {choices:{...UNKNOWN_CHOICES},revision,decidedAt:null};
  const choices=Object.fromEntries(PRIVACY_PURPOSES.map((p,i)=>[p,decode(match[1][i])])) as PrivacyChoices;
  return {choices,revision,decidedAt};
}

export function validateChoices(value:unknown):PrivacyChoices {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new PrivacyInputError("Invalid privacy choices.");
  const entries=Object.entries(value);
  if(entries.length!==PRIVACY_PURPOSES.length||entries.some(([key,choice])=>!(PRIVACY_PURPOSES as readonly string[]).includes(key)||(choice!==true&&choice!==false&&choice!==null)))
    throw new PrivacyInputError("Invalid privacy choices.");
  return Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,(value as PrivacyChoices)[p]])) as PrivacyChoices;
}
// A restriction can only withdraw. Anything other than an explicit false is rejected.
export function validateRestriction(value:unknown):PrivacyRestriction {
  if(value===undefined) return {};
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new PrivacyInputError("Invalid privacy choices.");
  const entries=Object.entries(value);
  if(entries.some(([key,choice])=>!(PRIVACY_PURPOSES as readonly string[]).includes(key)||choice!==false)) throw new PrivacyInputError("Invalid privacy choices.");
  return Object.fromEntries(entries) as PrivacyRestriction;
}
export function restrictChoices(choices:PrivacyChoices, restriction:PrivacyRestriction={}):PrivacyChoices {
  return Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,restriction[p]===false?false:choices[p]])) as PrivacyChoices;
}
export function grantsAdded(current:PrivacyChoices, next:PrivacyChoices):PrivacyPurpose[] {
  return PRIVACY_PURPOSES.filter(p=>next[p]===true&&current[p]!==true);
}
export function effectiveChoices(choices:PrivacyChoices, gpc:boolean):PrivacyChoices {
  return gpc?{...choices,...Object.fromEntries(GPC_PURPOSES.map(p=>[p,false]))}:{...choices};
}
// Storefront advertising requires both explicit grants and no GPC signal.
export function advertisingAllowed(choices:PrivacyChoices, gpc:boolean):boolean {
  const effective=effectiveChoices(choices,gpc);
  return effective.marketing===true&&effective.saleOfData===true;
}
// Shopify Storefront API VisitorConsent: omitted fields mean no preference was expressed.
export function visitorConsent(choices:PrivacyChoices, gpc:boolean):VisitorConsent|null {
  const effective=effectiveChoices(choices,gpc);
  const consent=Object.fromEntries(PRIVACY_PURPOSES.filter(p=>effective[p]!==null).map(p=>[p,effective[p]]));
  return Object.keys(consent).length?consent as VisitorConsent:null;
}
export function privacySnapshot(state:PrivacyState, gpc:boolean):PrivacySnapshot {
  return {...state,choices:{...state.choices},gpc,effective:effectiveChoices(state.choices,gpc),advertisingAllowed:advertisingAllowed(state.choices,gpc)};
}
export function gpcHeader(headers:Headers):boolean {return headers.get("sec-gpc")?.trim()==="1";}
