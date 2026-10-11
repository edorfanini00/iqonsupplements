import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { privacyLedger } from "./privacy-ledger";
import { IDENTITY_COOKIE, PENDING_COOKIE_PREFIX, PRIVACY_PURPOSES, PrivacyInputError, UNKNOWN_CHOICES, cookieName, gpcHeader, parseVersion, privacySnapshot, validIdentity, validPendingToken, validateChoices, validateWithdrawals, versionOf, type PrivacyChoices, type PrivacyRestriction, type PrivacyStatus } from "./privacy";

// Only local development uses unprefixed cookie names. Everywhere else __Host- cookies
// cannot be planted by a sibling subdomain or scoped to another path.
function localHost(host:string|null) {return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host||"");}

// Shopify publishes the policy and the opt out form on the store's own domain.
const LAUNCH_STORE_DOMAIN="nr9zd0-t5.myshopify.com";
export function privacyLinks() {
  const configured=String(process.env.SHOPIFY_STORE_DOMAIN||"").trim().toLowerCase();
  const domain=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(configured)?configured:LAUNCH_STORE_DOMAIN;
  return {policy:`https://${domain}/policies/privacy-policy`,optOut:`https://${domain}/pages/data-sharing-opt-out`};
}

type Jar=Awaited<ReturnType<typeof cookies>>;
async function context() {
  const requestHeaders=await headers();const secure=!localHost(requestHeaders.get("host"));
  return {jar:await cookies(),secure,gpc:gpcHeader(requestHeaders)};
}
// The ledger key: a one way hash of the browser's random token.
function visitorKey(jar:Jar, secure:boolean):string|null {
  const token=jar.get(cookieName(IDENTITY_COOKIE,secure))?.value;
  return validIdentity(token)?createHash("sha256").update(token).digest("hex"):null;
}
// Withdrawals the page recorded but the ledger has not confirmed. They travel with every
// request, so a checkout started from any tab honors them. They can only restrict.
function pendingRestriction(jar:Jar, secure:boolean):PrivacyRestriction {
  return Object.fromEntries(PRIVACY_PURPOSES.filter(p=>validPendingToken(jar.get(cookieName(PENDING_COOKIE_PREFIX+p,secure))?.value)).map(p=>[p,false]));
}

export type PrivacyState={choices:PrivacyChoices;version:string;status:PrivacyStatus;pending:PrivacyRestriction;visitorKey:string|null};
// The visitor's saved decision. A visitor who never saved one has no identity cookie and
// needs no database read. A failed read is reported as unavailable, never as a grant.
export async function readPrivacyState():Promise<PrivacyState> {
  const {jar,secure}=await context();
  const key=visitorKey(jar,secure);const pending=pendingRestriction(jar,secure);
  if(!key) return {choices:{...UNKNOWN_CHOICES},version:versionOf(null,0),status:"ready",pending,visitorKey:null};
  try {
    if(!privacyLedger) throw new Error("privacy ledger is not configured");
    const record=await privacyLedger.read(key);
    return {choices:record?.choices??{...UNKNOWN_CHOICES},version:versionOf(key,record?.revision??0),status:"ready",pending,visitorKey:key};
  } catch {
    return {choices:{...UNKNOWN_CHOICES},version:versionOf(key,0),status:"unavailable",pending,visitorKey:key};
  }
}
// For the first render: no database read. Visitors with saved choices load them in the page.
export async function initialPrivacySnapshot() {
  const {jar,secure,gpc}=await context();
  const key=visitorKey(jar,secure);
  return privacySnapshot(UNKNOWN_CHOICES,versionOf(key,0),key?"loading":"ready",gpc);
}

const responseHeaders={"Cache-Control":"private, no-store","Vary":"Cookie, Sec-GPC","X-Content-Type-Options":"nosniff"};
class PrivacyRequestError extends Error {constructor(message:string,public status:number){super(message);}}

export async function getPrivacyResponse() {
  const state=await readPrivacyState();const {gpc}=await context();
  const privacy=privacySnapshot(state.choices,state.version,state.status,gpc);
  return state.status==="unavailable"
    ?Response.json({error:"We couldn’t load your privacy choices right now.",privacy},{status:503,headers:responseHeaders})
    :Response.json({privacy},{headers:responseHeaders});
}
// Body is either {withdraw:[purposes]} or {choices, expectedVersion}. Withdrawals always
// apply. New grants apply only to the exact decision version the visitor was shown.
// The response never carries consent state; the page reads GET /api/privacy afterwards.
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
    const change=keys==="withdraw"?{kind:"withdraw" as const,purposes:validateWithdrawals((input as {withdraw:unknown}).withdraw)}
      :keys==="choices,expectedVersion"?(()=>{
        const {choices,expectedVersion}=input as {choices:unknown;expectedVersion:unknown};
        const version=parseVersion(expectedVersion);
        if(!version) throw new PrivacyRequestError("Invalid request.",400);
        return {kind:"choices" as const,choices:validateChoices(choices),version};
      })():null;
    if(!change) throw new PrivacyRequestError("Invalid request.",400);
    const {jar,secure,gpc}=await context();
    const key=visitorKey(jar,secure);
    if(!key) throw new PrivacyRequestError("Please refresh the page and try again.",400);
    if(!privacyLedger) throw new PrivacyRequestError("We couldn’t save your privacy choices right now.",503);
    const forbidden=gpc?PRIVACY_PURPOSES.filter(p=>p==="marketing"||p==="saleOfData"):[];
    let result;
    try {
      result=await privacyLedger.save(key,change.kind==="withdraw"?change
        // A page that saw no saved decision expects revision 0. A version from another
        // identity can never match, so its grants are refused.
        :{kind:"choices",choices:change.choices,forbidden,expectedRevision:change.version.prefix===key.slice(0,12)?change.version.revision
          :change.version.prefix==="none"&&change.version.revision===0?0:-1});
    } catch {throw new PrivacyRequestError("We couldn’t save your privacy choices right now.",503);}
    if(result.applied) return Response.json({saved:true},{headers:responseHeaders});
    const gpcRefusal=change.kind==="choices"&&forbidden.some(p=>change.choices[p]===true&&result.record.choices[p]!==true);
    return Response.json({error:gpcRefusal?"Global Privacy Control is on in this browser, so advertising and sharing stay off."
      :"Your privacy choices changed in another window. Review them and save again."},{status:gpcRefusal?422:409,headers:responseHeaders});
  } catch(error) {
    const status=error instanceof PrivacyRequestError?error.status:error instanceof PrivacyInputError?400:500;
    return Response.json({error:status===500?"We couldn’t save your privacy choices. Please try again.":error instanceof Error?error.message:"Invalid request."},{status,headers:responseHeaders});
  }
}
