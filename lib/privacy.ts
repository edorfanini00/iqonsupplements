// Visitor privacy choices for the headless storefront. Shared by the browser and server.
// Each purpose is granted (true), declined (false) or not expressed (null). null is never
// reported as a grant or a denial; Shopify applies its own regional rules to it.
export const PRIVACY_PURPOSES=["analytics","marketing","preferences","saleOfData"] as const;
export type PrivacyPurpose=typeof PRIVACY_PURPOSES[number];
export type PrivacyChoices=Record<PrivacyPurpose,boolean|null>;
export type PrivacyRestriction=Partial<Record<PrivacyPurpose,false>>;
// One saved decision: choices, a counter, when it was saved, and the newest decision time
// the saving request had seen (its basis). All times are server milliseconds.
export type SavedDecision={choices:PrivacyChoices;revision:number;decidedAt:number;basis:number};
export type Withdrawals=Partial<Record<PrivacyPurpose,number>>;
// The visitor's current decision after withdrawals are applied. `horizon` is the newest
// time this request knows about; `version` identifies the decision for freshness checks.
export type PrivacyState={choices:PrivacyChoices;revision:number;horizon:number;version:string};
export type PrivacySnapshot={choices:PrivacyChoices;effective:PrivacyChoices;gpc:boolean;version:string};
export type VisitorConsent=Partial<Record<PrivacyPurpose,boolean>>;

export const PRIVACY_COOKIE="iqon_privacy";
// __Host- cookies cannot be set by sibling subdomains or scoped to another path.
export const SECURE_PRIVACY_COOKIE="__Host-iqon_privacy";
export const withdrawalCookie=(base:string, purpose:PrivacyPurpose)=>`${base}_w_${purpose}`;
export const PRIVACY_MAX_AGE=60*60*24*365;
export const MAX_REVISION=999_999_999;
export const UNKNOWN_CHOICES:PrivacyChoices=Object.freeze({analytics:null,marketing:null,preferences:null,saleOfData:null});
// Global Privacy Control is an expressed opt out of sale, sharing and targeted advertising.
const GPC_PURPOSES:PrivacyPurpose[]=["marketing","saleOfData"];
const SKEW=5*60*1000;

export class PrivacyInputError extends Error {}

const code=(value:boolean|null)=>value===true?"1":value===false?"0":"n";
const decode=(value:string)=>value==="1"?true:value==="0"?false:null;

export function encodeDecision(decision:SavedDecision):string {
  return `v2.${PRIVACY_PURPOSES.map(p=>code(decision.choices[p])).join("")}.${decision.revision}.${decision.decidedAt}.${decision.basis}`;
}
// Unreadable, future dated or expired decisions are ignored, so they never yield a grant.
export function parseDecision(value:string|undefined, now=Date.now()):SavedDecision|null {
  const match=/^v2\.([10n]{4})\.(\d{1,9})\.(\d{1,15})\.(\d{1,15})$/.exec(value||"");
  if(!match) return null;
  const decidedAt=Number(match[3]);const basis=Number(match[4]);
  if(!decidedAt||decidedAt>now+SKEW||now-decidedAt>PRIVACY_MAX_AGE*1000||basis>decidedAt) return null;
  const choices=Object.fromEntries(PRIVACY_PURPOSES.map((p,i)=>[p,decode(match[1][i])])) as PrivacyChoices;
  return {choices,revision:Number(match[2]),decidedAt,basis};
}
export const encodeWithdrawal=(at:number)=>`v1.${at}`;
// A withdrawal record is kept even if it looks future dated: it can only restrict.
export function parseWithdrawal(value:string|undefined, now=Date.now()):number|null {
  const match=/^v1\.(\d{1,15})$/.exec(value||"");
  if(!match) return null;
  const at=Number(match[1]);
  return at&&now-at<=PRIVACY_MAX_AGE*1000?at:null;
}
// Withdrawals take precedence over any grant whose saving request had not seen them. A
// grant sent before a withdrawal, but answered after it, therefore never takes effect.
export function combinePrivacy(decision:SavedDecision|null, withdrawals:Withdrawals):PrivacyState {
  const choices=Object.fromEntries(PRIVACY_PURPOSES.map(p=>{
    const withdrawn=withdrawals[p];
    return [p,withdrawn!==undefined&&(!decision||withdrawn>decision.basis)?false:decision?decision.choices[p]:null];
  })) as PrivacyChoices;
  const latestWithdrawal=Math.max(0,...Object.values(withdrawals));
  return {choices,revision:decision?.revision||0,horizon:Math.max(decision?.decidedAt||0,latestWithdrawal),
    version:`${decision?.revision||0}.${decision?.decidedAt||0}.${latestWithdrawal}`};
}

export function validateChoices(value:unknown):PrivacyChoices {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new PrivacyInputError("Invalid privacy choices.");
  const entries=Object.entries(value);
  if(entries.length!==PRIVACY_PURPOSES.length||entries.some(([key,choice])=>!(PRIVACY_PURPOSES as readonly string[]).includes(key)||(choice!==true&&choice!==false&&choice!==null)))
    throw new PrivacyInputError("Invalid privacy choices.");
  return Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,(value as PrivacyChoices)[p]])) as PrivacyChoices;
}
export function validateWithdrawals(value:unknown):PrivacyPurpose[] {
  if(!Array.isArray(value)||!value.length||value.length>PRIVACY_PURPOSES.length||new Set(value).size!==value.length||value.some(p=>!(PRIVACY_PURPOSES as readonly unknown[]).includes(p)))
    throw new PrivacyInputError("Invalid privacy choices.");
  return value as PrivacyPurpose[];
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
// Shopify Storefront API VisitorConsent: omitted fields mean no preference was expressed.
export function visitorConsent(choices:PrivacyChoices, gpc:boolean):VisitorConsent|null {
  const effective=effectiveChoices(choices,gpc);
  const consent=Object.fromEntries(PRIVACY_PURPOSES.filter(p=>effective[p]!==null).map(p=>[p,effective[p]]));
  return Object.keys(consent).length?consent as VisitorConsent:null;
}
export function privacySnapshot(state:PrivacyState, gpc:boolean):PrivacySnapshot {
  return {choices:{...state.choices},effective:effectiveChoices(state.choices,gpc),gpc,version:state.version};
}
export function gpcHeader(headers:Headers):boolean {return headers.get("sec-gpc")?.trim()==="1";}
