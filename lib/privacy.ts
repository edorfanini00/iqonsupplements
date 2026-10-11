// Visitor privacy choices for the headless storefront. Shared by the browser and server.
// Each purpose is granted (true), declined (false) or not expressed (null). null is never
// reported as a grant or a denial; Shopify applies its own regional rules to it.
export const PRIVACY_PURPOSES=["analytics","marketing","preferences","saleOfData"] as const;
export type PrivacyPurpose=typeof PRIVACY_PURPOSES[number];
export type PrivacyChoices=Record<PrivacyPurpose,boolean|null>;
export type PrivacyRestriction=Partial<Record<PrivacyPurpose,false>>;
// "ready": choices come from the ledger (or the visitor never saved any).
// "loading": the page has not read the ledger yet. "unavailable": the ledger could not be read.
export type PrivacyStatus="ready"|"loading"|"unavailable";
export type PrivacySnapshot={choices:PrivacyChoices;effective:PrivacyChoices;gpc:boolean;version:string;status:PrivacyStatus};
export type VisitorConsent=Partial<Record<PrivacyPurpose,boolean>>;

export const UNKNOWN_CHOICES:PrivacyChoices=Object.freeze({analytics:null,marketing:null,preferences:null,saleOfData:null});
// Global Privacy Control is an expressed opt out of sale, sharing and targeted advertising.
export const GPC_PURPOSES:PrivacyPurpose[]=["marketing","saleOfData"];
// Purposes withheld from checkout when a visitor who made a choice cannot have it read:
// all of them, so no declined purpose can fall back to regional defaults. Visitors who never
// made a choice have no identity, are never in this state, and stay unexpressed.
export const OUTAGE_DECLINED:PrivacyPurpose[]=[...PRIVACY_PURPOSES];

// Cookies. Production names carry __Host- (Secure, Path=/, no Domain); localhost uses plain names.
// The identity cookie holds a random token created by the visitor's own browser; the server
// stores only its SHA-256 and never sets this cookie, so no response can replace it.
export const IDENTITY_COOKIE="iqon_privacy_id";
// Withdrawals not yet confirmed by the ledger, one cookie per purpose, written by the page.
export const PENDING_COOKIE_PREFIX="iqon_privacy_pending_";
export const IDENTITY_MAX_AGE=60*60*24*400;
export const cookieName=(name:string, secure:boolean)=>secure?`__Host-${name}`:name;
export const validIdentity=(value:string|undefined):value is string=>/^[A-Za-z0-9_-]{43}$/.test(value||"");
export const validPendingToken=(value:string|undefined):value is string=>/^\d{1,15}-[a-z0-9]{1,16}$/.test(value||"");

export class PrivacyInputError extends Error {}

// Versions identify a decision: the first 12 characters of the visitor key and the revision.
export const UNSAVED_VERSION="none.0";
export const versionOf=(visitorKey:string|null, revision:number)=>visitorKey?`${visitorKey.slice(0,12)}.${revision}`:UNSAVED_VERSION;
export function parseVersion(value:unknown):{prefix:string;revision:number}|null {
  const match=typeof value==="string"?/^([0-9a-f]{12}|none)\.(\d{1,9})$/.exec(value):null;
  return match?{prefix:match[1],revision:Number(match[2])}:null;
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
export function effectiveChoices(choices:PrivacyChoices, gpc:boolean):PrivacyChoices {
  return gpc?{...choices,...Object.fromEntries(GPC_PURPOSES.map(p=>[p,false]))}:{...choices};
}
// Shopify Storefront API VisitorConsent: omitted fields mean no preference was expressed.
export function visitorConsent(choices:PrivacyChoices, gpc:boolean):VisitorConsent|null {
  const effective=effectiveChoices(choices,gpc);
  const consent=Object.fromEntries(PRIVACY_PURPOSES.filter(p=>effective[p]!==null).map(p=>[p,effective[p]]));
  return Object.keys(consent).length?consent as VisitorConsent:null;
}
export function privacySnapshot(choices:PrivacyChoices, version:string, status:PrivacyStatus, gpc:boolean):PrivacySnapshot {
  return {choices:{...choices},effective:effectiveChoices(choices,gpc),gpc,version,status};
}
export function gpcHeader(headers:Headers):boolean {return headers.get("sec-gpc")?.trim()==="1";}
