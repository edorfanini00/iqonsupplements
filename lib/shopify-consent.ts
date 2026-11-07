// Native Shopify owns consent and persistence. This module only reads it for
// the current operation; it does not create a consent cookie, ledger or UI.
export type VisitorConsent = {analytics:boolean; marketing:boolean; preferences:boolean; saleOfData:boolean};
export const DENIED_CONSENT: VisitorConsent = {analytics:false,marketing:false,preferences:false,saleOfData:false};
type CustomerPrivacy = {
  consentStatus?: string;
  analyticsProcessingAllowed:()=>boolean;
  marketingAllowed:()=>boolean;
  preferencesProcessingAllowed:()=>boolean;
  saleOfDataAllowed:()=>boolean;
};
export function nativeConsentReady(){
  return typeof window!=="undefined"&&(window as unknown as {Shopify?:{customerPrivacy?:CustomerPrivacy}}).Shopify?.customerPrivacy?.consentStatus==="loaded";
}
export function nativeConsent(): VisitorConsent {
  try {
    const native = (window as unknown as {Shopify?:{customerPrivacy?:CustomerPrivacy}}).Shopify?.customerPrivacy;
    // Hydrogen 2026.10's native async API must finish loading the visitor state.
    if(native?.consentStatus!=="loaded") return {...DENIED_CONSENT};
    const gpc=(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true;
    return {analytics:native.analyticsProcessingAllowed()===true,
      marketing:!gpc&&native.marketingAllowed()===true,
      preferences:native.preferencesProcessingAllowed()===true,
      saleOfData:!gpc&&native.saleOfDataAllowed()===true};
  } catch {return {...DENIED_CONSENT};}
}
export function parseVisitorConsent(value:unknown): VisitorConsent {
  if(value===undefined) return {...DENIED_CONSENT};
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error("Invalid consent.");
  const input=value as Record<string,unknown>;
  if(Object.keys(input).length!==4||Object.keys(DENIED_CONSENT).some(key=>typeof input[key]!=="boolean")) throw new Error("Invalid consent.");
  return {analytics:input.analytics as boolean,marketing:input.marketing as boolean,
    preferences:input.preferences as boolean,saleOfData:input.saleOfData as boolean};
}
