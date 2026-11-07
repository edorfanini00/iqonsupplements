// Native Shopify owns consent and persistence. Read it only within a fresh
// document; this module creates no consent cookie, ledger or UI.
export type VisitorConsent = {analytics:boolean; marketing:boolean; preferences:boolean; saleOfData:boolean};
export const DENIED_CONSENT: VisitorConsent = {analytics:false,marketing:false,preferences:false,saleOfData:false};
type CustomerPrivacy = {
  consentStatus?: string;
  analyticsProcessingAllowed:()=>boolean;
  marketingAllowed:()=>boolean;
  preferencesProcessingAllowed:()=>boolean;
  saleOfDataAllowed:()=>boolean;
};
// A loaded SDK cache is authoritative only for this uninterrupted document.
// This is an ephemeral freshness barrier, never a consent value or persistence.
export const NATIVE_CONSENT_INVALIDATED="iqon:native-consent-invalidated";
export const NATIVE_CONSENT_RELOADING="iqon:native-consent-reloading";
let invalidated=false;
let revision=0;
let installed=false;
let reloadRequested=false;
let pendingCartMutations=0;
let continueReload:(()=>void)|undefined;
let refreshDocument:(()=>void)|undefined;
export function refreshNativeConsent(){refreshDocument?.();}
// Keep the existing cart response/cookie intact before replacing this document.
// The cart API's existing bounded timeout releases this hold on failure too.
export function holdNativeRefreshForCart(){
  pendingCartMutations++;
  let released=false;
  return ()=>{
    if(released)return;released=true;pendingCartMutations--;
    if(!pendingCartMutations)continueReload?.();
  };
}
export const nativeConsentRevision=()=>revision;
export const nativeConsentInvalidated=()=>invalidated;
function safeRefreshBoundary(){
  // Do not inspect fields or discard typed state on account, contact, login or
  // other form routes. Refresh only when back at a known shopping boundary.
  const path=window.location.pathname;
  const shopping=path==="/"||path==="/checkout"||/^\/products\/[^/]+$/.test(path)||
    ["/collections/all","/collections/supplements","/collections/skincare"].includes(path);
  return shopping&&document.visibilityState!=="hidden"&&!!(window as unknown as {Shopify?:{customerPrivacy?:CustomerPrivacy}}).Shopify?.customerPrivacy;
}
function installFreshnessBoundary(){
  if(installed||typeof window==="undefined"||typeof document==="undefined")return;
  installed=true;
  const invalidate=()=>{
    if(invalidated)return;
    invalidated=true;revision++;
    document.dispatchEvent(new Event(NATIVE_CONSENT_INVALIDATED));
  };
  const reload=()=>{
    invalidate();
    if(reloadRequested||!safeRefreshBoundary())return;
    reloadRequested=true;
    const finish=()=>{
      if(pendingCartMutations){continueReload=finish;return;}
      continueReload=undefined;
      // Finish event dispatch and the cart promise's callbacks while denied.
      window.setTimeout(()=>{
        if(!safeRefreshBoundary()){reloadRequested=false;return;}
        if(pendingCartMutations){continueReload=finish;return;}
        document.dispatchEvent(new Event(NATIVE_CONSENT_RELOADING));
        window.location.reload();
      },0);
    };
    finish();
  };
  refreshDocument=reload;
  // No consent flags, identifiers, cookies or stored ledger cross this channel.
  // A missing/unsupported channel is covered by resume/focus reload below.
  let channel:BroadcastChannel|undefined;
  try {
    channel=new BroadcastChannel("iqon-native-consent-invalidation");
    channel.onmessage=event=>{
      if(event.data!=="invalidate")return;
      invalidate();
      if(document.visibilityState!=="hidden")reload();
    };
  } catch { /* Resume still requires a new document and native API response. */ }
  document.addEventListener("visitorConsentCollected",()=>{
    revision++;
    try {channel?.postMessage("invalidate");} catch { /* Resume remains fail closed. */ }
  },true);
  window.addEventListener("blur",event=>{if(event.target===window)invalidate();},true);
  window.addEventListener("pagehide",invalidate,true);
  window.addEventListener("focus",event=>{if(event.target===window)reload();},true);
  window.addEventListener("pageshow",event=>{if(event.persisted)reload();},true);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")invalidate();
    else if(invalidated)reload();
  },true);
  if(document.visibilityState==="hidden")invalidate();
}
installFreshnessBoundary();
export function nativeConsentReady(){
  return !invalidated&&typeof window!=="undefined"&&(window as unknown as {Shopify?:{customerPrivacy?:CustomerPrivacy}}).Shopify?.customerPrivacy?.consentStatus==="loaded";
}
export function nativeConsent(): VisitorConsent {
  try {
    const native = (window as unknown as {Shopify?:{customerPrivacy?:CustomerPrivacy}}).Shopify?.customerPrivacy;
    // Hydrogen 2026.10's native async API must finish loading the visitor state.
    if(invalidated||native?.consentStatus!=="loaded") return {...DENIED_CONSENT};
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
