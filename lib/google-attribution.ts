import {nativeConsent,nativeConsentReady} from "./shopify-consent";
export const ADS_TAG="AW-18501766604";
export const CHECKOUT_HOST="nr9zd0-t5.myshopify.com";
// The previously reviewed advertised product allowlist. No new product scope.
const PRODUCTS=["creatine-monohydrate","hydrolyzed-collagen-peptides","colostrum-powder"];
const IDS=new Set(["gclid","gbraid","wbraid"]);
const DENIED={ad_storage:"denied",ad_user_data:"denied",analytics_storage:"denied",ad_personalization:"denied"};
declare global {interface Window {dataLayer?:IArguments[];gtag?:(...args:unknown[])=>void;}}
let loaded=false;
let leaving=false;
let ready:Promise<void>|undefined;
const google=(...args:unknown[])=>window.gtag?.(...args);
export function safeAttributionUrl(url:URL){
  const product=PRODUCTS.some(id=>url.pathname===`/products/${id}`);
  const browse=["/","/collections/all","/collections/supplements","/checkout"].includes(url.pathname);
  if(!product&&!browse)return false;
  if(url.hash&&!/^#(main|overview|product-benefits|product-formula|product-routine|ingredient-science|compare|product-questions|reviews)$/.test(url.hash))return false;
  const keys=[...url.searchParams.keys()];if(new Set(keys).size!==keys.length)return false;
  return [...url.searchParams].every(([key,value])=>product&&(IDS.has(key)?/^[a-zA-Z0-9_-]{1,200}$/.test(value):
    key==="gad_source"?/^\d{1,3}$/.test(value):key==="gad_campaignid"?/^\d{1,20}$/.test(value):false));
}
function hasClickCookie(){return /(?:^|;\s*)_gcl_(aw|gb|gs|au)=/.test(document.cookie);}
function permitted(){const consent=nativeConsent();return consent.marketing&&consent.saleOfData;}
function currentSafe(){return location.hostname==="www.iqondaily.com"&&safeAttributionUrl(new URL(location.href));}
function clearGoogleCookies(){
  // Only our Google measurement cookies. Shopify consent cookies are never edited.
  for(const part of document.cookie.split(";")){
    const name=part.trim().split("=")[0];if(!/^_gcl_[a-z0-9_]+$/.test(name))continue;
    for(const domain of ["","; Domain=www.iqondaily.com","; Domain=iqondaily.com"])
      document.cookie=`${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax${domain}`;
  }
}
function leave(url=location.href){
  if(leaving)return;leaving=true;
  google("consent","update",DENIED);
  if(url===location.href)location.reload();else location.assign(url);
}
export function syncAttribution(){
  if(typeof window==="undefined"||leaving)return;
  if(!permitted()){
    if(loaded||nativeConsentReady()||(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true)clearGoogleCookies();
    if(loaded)leave();
    return;
  }
  if(!currentSafe()){if(loaded)leave();return;}
  if(loaded)return;
  const here=new URL(location.href);
  if(!PRODUCTS.some(id=>here.pathname===`/products/${id}`)&&!hasClickCookie())return;
  loaded=true;
  window.dataLayer=window.dataLayer||[];
  // gtag consumes Arguments objects, not ordinary arrays.
  // eslint-disable-next-line prefer-rest-params
  window.gtag=function(){window.dataLayer!.push(arguments);};
  google("consent","default",DENIED);
  google("set","ads_data_redaction",true);
  google("set","url_passthrough",false);
  google("set","allow_ad_personalization_signals",false);
  google("set","allow_google_signals",false);
  google("set","send_page_view",false);
  // The current Ads runtime treats an empty referrer as "use document.referrer".
  // A fixed, non-sensitive origin is required to prevent that fallback.
  google("set","page_referrer",`${here.origin}/`);
  // Defense in depth for template permissions. The tag's account-level
  // automatic-event and user-provided-data capabilities must stay disabled.
  google("policy","all",(_container:unknown,permission:string)=>!permission.startsWith("detect_")&&
    !["get_element_attributes","read_dom_elements","internal_sw_allowed","inject_cmp_banner"].includes(permission));
  google("set","linker",{domains:[CHECKOUT_HOST],accept_incoming:false,decorate_forms:false});
  google("consent","update",{...DENIED,ad_storage:"granted",ad_user_data:"granted"});
  google("js",new Date());
  google("config",ADS_TAG,{send_page_view:false,allow_ad_personalization_signals:false,allow_google_signals:false,
    allow_enhanced_conversions:false,ignore_referrer:true,page_referrer:`${here.origin}/`,page_title:"IQON Daily",
    page_location:`${here.origin}${here.pathname}${here.search}`});
  ready=new Promise(resolve=>{
    const script=document.createElement("script");script.async=true;script.referrerPolicy="no-referrer";
    script.src=`https://www.googletagmanager.com/gtag/js?id=${ADS_TAG}`;
    script.onload=()=>google("get",ADS_TAG,"gclid",()=>resolve());script.onerror=()=>resolve();document.head.appendChild(script);
    // Checkout must remain available when an extension blocks the tag.
    setTimeout(resolve,1500);
  });
}
export function installAttributionGuards(){
  const click=(event:MouseEvent)=>{
    if(!loaded||leaving||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
    const anchor=(event.target as Element|null)?.closest?.("a[href]") as HTMLAnchorElement|null;
    if(!anchor||anchor.target||anchor.hasAttribute("download"))return;
    const to=new URL(anchor.href,location.href);
    if(to.origin===location.origin&&to.hash==="#shopifyReshowConsentBanner")return;
    if(to.origin===location.origin&&!safeAttributionUrl(to)){event.preventDefault();event.stopImmediatePropagation();leave(to.href);}
  };
  document.addEventListener("click",click,true);
  const cleanup:(()=>void)[]=[()=>document.removeEventListener("click",click,true)];
  // Intercept before the URL changes, so Google cannot observe sensitive SPA URLs.
  for(const name of ["pushState","replaceState"] as const){
    const original=history[name];
    const wrapped:History[typeof name]=function(this:History,data,unused,url){
      if(loaded&&!leaving&&url&&!safeAttributionUrl(new URL(String(url),location.href))){leave(new URL(String(url),location.href).href);return;}
      return original.call(this,data,unused,url);
    };
    history[name]=wrapped;cleanup.push(()=>{if(history[name]===wrapped)history[name]=original;});
  }
  const recheck=()=>syncAttribution();
  for(const event of ["popstate","hashchange","pageshow","focus"]){window.addEventListener(event,recheck);cleanup.push(()=>window.removeEventListener(event,recheck));}
  for(const event of ["consentTrackingApiLoaded","visitorConsentCollected"]){document.addEventListener(event,recheck);cleanup.push(()=>document.removeEventListener(event,recheck));}
  syncAttribution();
  return ()=>cleanup.reverse().forEach(fn=>fn());
}
export function needsCheckoutReview(){
  return permitted()&&hasClickCookie()&&!currentSafe();
}
export async function attributionReady(){
  syncAttribution();
  if(ready)await ready;
}
export function validateNativeCheckoutUrl(url:string){
  const to=new URL(url);
  if(to.protocol!=="https:"||to.hostname!==CHECKOUT_HOST||to.username||to.password)throw new Error("Checkout is temporarily unavailable.");
  return to.href;
}
