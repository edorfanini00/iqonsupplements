import { cookies, headers } from "next/headers";
import { PRIVACY_COOKIE, PRIVACY_PURPOSES, SECURE_PRIVACY_COOKIE, PRIVACY_MAX_AGE, MAX_REVISION, PrivacyInputError, encodePrivacyCookie, parsePrivacyCookie, validateChoices, grantsAdded, gpcHeader, privacySnapshot, restrictChoices, type PrivacyChoices, type PrivacyState } from "./privacy";

// Only local development uses the unprefixed cookie. Everywhere else a sibling
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
export async function readPrivacyState():Promise<PrivacyState> {
  const requestHeaders=await headers();
  return parsePrivacyCookie((await cookies()).get(cookieName(requestHeaders.get("host")))?.value);
}
export async function readPrivacySnapshot() {
  const requestHeaders=await headers();
  return privacySnapshot(await readPrivacyState(),gpcHeader(requestHeaders));
}
async function writePrivacyState(state:PrivacyState, request:Request) {
  const url=new URL(request.url);const local=localHost(url.host);
  (await cookies()).set(cookieName(url.host),encodePrivacyCookie(state),{httpOnly:true,secure:!local||url.protocol==="https:",sameSite:"lax",path:"/",maxAge:PRIVACY_MAX_AGE});
}

const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie, Sec-GPC","X-Content-Type-Options":"nosniff"};
class PrivacyRequestError extends Error {constructor(message:string,public status:number){super(message);}}

export async function getPrivacyResponse() {
  return Response.json({privacy:await readPrivacySnapshot()},{headers:responseHeaders});
}
// Records a visitor initiated choice. Withdrawals always apply; a new grant must be
// made against the latest saved revision so an outdated window cannot restore it.
export async function savePrivacyResponse(request:Request) {
  try {
    if(request.headers.get("origin")!==new URL(request.url).origin) throw new PrivacyRequestError("Please refresh the page and try again.",403);
    if(!request.headers.get("content-type")?.startsWith("application/json")) throw new PrivacyRequestError("Invalid request.",415);
    const text=await request.text();
    if(text.length>1024) throw new PrivacyRequestError("Invalid request.",413);
    let input:unknown;
    try {input=JSON.parse(text);}catch {throw new PrivacyRequestError("Invalid request.",400);}
    if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(key=>key!=="choices"&&key!=="expectedRevision")) throw new PrivacyRequestError("Invalid request.",400);
    const {choices:rawChoices,expectedRevision}=input as {choices?:unknown;expectedRevision?:unknown};
    const choices=validateChoices(rawChoices);
    if(typeof expectedRevision!=="number"||!Number.isInteger(expectedRevision)||expectedRevision<0||expectedRevision>MAX_REVISION) throw new PrivacyRequestError("Invalid request.",400);
    const current=await readPrivacyState();
    const added=grantsAdded(current.choices,choices);
    const gpc=gpcHeader(request.headers);
    const record=async(next:PrivacyChoices)=>{
      const state={choices:next,revision:current.revision>=MAX_REVISION?1:current.revision+1,decidedAt:Math.floor(Date.now()/1000)};
      await writePrivacyState(state,request);return privacySnapshot(state,gpc);
    };
    const refusal=added.length&&expectedRevision!==current.revision?{status:409,error:"Your privacy choices changed in another window. Review them and save again."}
      :gpc&&(added.includes("marketing")||added.includes("saleOfData"))?{status:422,error:"Global Privacy Control is on in this browser, so advertising and sharing stay off."}:null;
    if(refusal) {
      // The grants are refused, but any withdrawal in the same request still applies.
      const withdrawals=Object.fromEntries(PRIVACY_PURPOSES.filter(p=>choices[p]===false&&current.choices[p]!==false).map(p=>[p,false]));
      const privacy=Object.keys(withdrawals).length?await record(restrictChoices(current.choices,withdrawals)):privacySnapshot(current,gpc);
      return Response.json({error:refusal.error,privacy},{status:refusal.status,headers:responseHeaders});
    }
    return Response.json({privacy:await record(choices)},{headers:responseHeaders});
  } catch(error) {
    const status=error instanceof PrivacyRequestError?error.status:error instanceof PrivacyInputError?400:500;
    return Response.json({error:status===500?"We couldn’t save your privacy choices. Please try again.":error instanceof Error?error.message:"Invalid request."},{status,headers:responseHeaders});
  }
}
