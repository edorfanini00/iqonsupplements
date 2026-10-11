import { cookies, headers } from "next/headers";
import { PRIVACY_COOKIE, PRIVACY_PURPOSES, SECURE_PRIVACY_COOKIE, PRIVACY_MAX_AGE, MAX_REVISION, PrivacyInputError, combinePrivacy, encodeDecision, encodeWithdrawal, parseDecision, parseWithdrawal, validateChoices, validateWithdrawals, grantsAdded, gpcHeader, privacySnapshot, restrictChoices, withdrawalCookie, type PrivacyChoices, type PrivacyState, type Withdrawals } from "./privacy";

// Only local development uses the unprefixed cookies. Everywhere else a sibling
// subdomain cannot plant a grant because __Host- requires Secure, Path=/ and no Domain.
function localHost(host:string|null) {return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host||"");}
function cookieName(host:string|null) {return localHost(host)?PRIVACY_COOKIE:SECURE_PRIVACY_COOKIE;}

// Shopify publishes the policy and the opt out form on the store's own domain.
const LAUNCH_STORE_DOMAIN="nr9zd0-t5.myshopify.com";
export function privacyLinks() {
  const configured=String(process.env.SHOPIFY_STORE_DOMAIN||"").trim().toLowerCase();
  const domain=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(configured)?configured:LAUNCH_STORE_DOMAIN;
  return {policy:`https://${domain}/policies/privacy-policy`,optOut:`https://${domain}/pages/data-sharing-opt-out`};
}
// The decision as known to this request: the saved decision plus every withdrawal cookie
// the browser sent with it.
export async function readPrivacyState():Promise<PrivacyState> {
  const name=cookieName((await headers()).get("host"));const jar=await cookies();const now=Date.now();
  const withdrawals:Withdrawals={};
  for(const p of PRIVACY_PURPOSES){const at=parseWithdrawal(jar.get(withdrawalCookie(name,p))?.value,now);if(at!==null)withdrawals[p]=at;}
  return combinePrivacy(parseDecision(jar.get(name)?.value,now),withdrawals);
}
export async function readPrivacySnapshot() {
  return privacySnapshot(await readPrivacyState(),gpcHeader(await headers()));
}
// Saves a decision. Each declined purpose also gets its own withdrawal cookie, which no
// later response for an older request overwrites, and which outranks grants that request
// had not seen. Order of arrival therefore cannot bring a withdrawn grant back.
async function writeDecision(choices:PrivacyChoices, current:PrivacyState, request:Request) {
  const url=new URL(request.url);const name=cookieName(url.host);const jar=await cookies();const now=Date.now();
  const options={httpOnly:true,secure:!localHost(url.host)||url.protocol==="https:",sameSite:"lax" as const,path:"/",maxAge:PRIVACY_MAX_AGE};
  jar.set(name,encodeDecision({choices,revision:current.revision>=MAX_REVISION?1:current.revision+1,decidedAt:now,basis:current.horizon}),options);
  for(const p of PRIVACY_PURPOSES) if(choices[p]===false) jar.set(withdrawalCookie(name,p),encodeWithdrawal(now),options);
}

const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie, Sec-GPC","X-Content-Type-Options":"nosniff"};
class PrivacyRequestError extends Error {constructor(message:string,public status:number){super(message);}}

// The browser's current decision. Pages read this after every save rather than trusting
// a save response, because only a new request carries every cookie the browser holds.
export async function getPrivacyResponse() {
  return Response.json({privacy:await readPrivacySnapshot()},{headers:responseHeaders});
}
// Body is either {withdraw:[purposes]} or {choices, expectedVersion}. Withdrawals always
// apply. New grants must name the version the visitor was shown, so a form opened before
// a change made elsewhere cannot restore what was withdrawn.
export async function savePrivacyResponse(request:Request) {
  try {
    if(request.headers.get("origin")!==new URL(request.url).origin) throw new PrivacyRequestError("Please refresh the page and try again.",403);
    if(!request.headers.get("content-type")?.startsWith("application/json")) throw new PrivacyRequestError("Invalid request.",415);
    const text=await request.text();
    if(text.length>1024) throw new PrivacyRequestError("Invalid request.",413);
    let input:unknown;
    try {input=JSON.parse(text);}catch {throw new PrivacyRequestError("Invalid request.",400);}
    if(!input||typeof input!=="object"||Array.isArray(input)) throw new PrivacyRequestError("Invalid request.",400);
    const keys=Object.keys(input).sort().join(",");
    const current=await readPrivacyState();
    if(keys==="withdraw") {
      const withdrawals=validateWithdrawals((input as {withdraw:unknown}).withdraw);
      await writeDecision(restrictChoices(current.choices,Object.fromEntries(withdrawals.map(p=>[p,false]))),current,request);
      return Response.json({saved:true},{headers:responseHeaders});
    }
    if(keys!=="choices,expectedVersion") throw new PrivacyRequestError("Invalid request.",400);
    const {choices:rawChoices,expectedVersion}=input as {choices:unknown;expectedVersion:unknown};
    const choices=validateChoices(rawChoices);
    if(typeof expectedVersion!=="string"||!/^\d{1,9}\.\d{1,15}\.\d{1,15}$/.test(expectedVersion)) throw new PrivacyRequestError("Invalid request.",400);
    const added=grantsAdded(current.choices,choices);
    const refusal=added.length&&expectedVersion!==current.version?{status:409,error:"Your privacy choices changed in another window. Review them and save again."}
      :gpcHeader(request.headers)&&(added.includes("marketing")||added.includes("saleOfData"))?{status:422,error:"Global Privacy Control is on in this browser, so advertising and sharing stay off."}:null;
    if(refusal) {
      // The grants are refused, but any withdrawal in the same request still applies.
      const withdrawals=Object.fromEntries(PRIVACY_PURPOSES.filter(p=>choices[p]===false&&current.choices[p]!==false).map(p=>[p,false]));
      if(Object.keys(withdrawals).length) await writeDecision(restrictChoices(current.choices,withdrawals),current,request);
      return Response.json({error:refusal.error},{status:refusal.status,headers:responseHeaders});
    }
    await writeDecision(choices,current,request);
    return Response.json({saved:true},{headers:responseHeaders});
  } catch(error) {
    const status=error instanceof PrivacyRequestError?error.status:error instanceof PrivacyInputError?400:500;
    return Response.json({error:status===500?"We couldn’t save your privacy choices. Please try again.":error instanceof Error?error.message:"Invalid request."},{status,headers:responseHeaders});
  }
}
