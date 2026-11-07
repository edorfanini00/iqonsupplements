import {createShopifyRequestContext,createStorefrontClient,handleShopifyRoutes} from "@shopify/hydrogen";
import {Kind,parse,print,visit} from "graphql";
import {sameOrigin} from "./shopify";

// Constrain Shopify's official same-origin proxy to the hosted consent API.
// No private Storefront token, customer session, URL or referrer is forwarded.
export function consentQuery(payload:unknown):string {
  if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("Invalid request.");
  const {query,variables}=payload as {query?:unknown;variables?:unknown};
  if(typeof query!=="string"||query.length>12000)throw new Error("Invalid request.");
  if(variables&&(typeof variables!=="object"||Array.isArray(variables)||
    Object.entries(variables).some(([key,value])=>key!=="isPreviewMode"||value!==false)))throw new Error("Unexpected variables.");
  const doc=parse(query);
  const op=doc.definitions[0];
  if(doc.definitions.length!==1||op.kind!==Kind.OPERATION_DEFINITION||op.operation!=="query"||
    op.selectionSet.selections.length!==1||op.selectionSet.selections[0].kind!==Kind.FIELD||
    op.selectionSet.selections[0].name.value!=="consentManagement")throw new Error("Only native consent queries are supported.");
  return print(visit(doc,{
    OperationDefinition(node){
      if(node.variableDefinitions?.some(v=>v.variable.name.value!=="isPreviewMode"||v.type.kind!==Kind.NAMED_TYPE||v.type.name.value!=="Boolean"||v.defaultValue?.kind!==Kind.BOOLEAN||v.defaultValue.value!==false))throw new Error("Unexpected variable definition.");
      return {...node,variableDefinitions:[]};
    },
    Variable(node){if(node.name.value!=="isPreviewMode")throw new Error("Unexpected variable.");return {kind:Kind.BOOLEAN,value:false};},
    Argument(node){if(["origReferrer","landingPage","visitorEmail"].includes(node.name.value))return null;},
    ObjectField(node){if(node.name.value==="metafields")return null;},
    StringValue(){throw new Error("Unexpected consent data.");},
    FragmentSpread(){throw new Error("Unexpected fragment.");},
  }));
}
export async function shopifyConsentProxy(request:Request):Promise<Response> {
  const responseHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
  try {
    sameOrigin(request);
    if(new URL(request.url).search)throw new Error("Unexpected query parameters.");
    if(Number(request.headers.get("content-length")||0)>14000)throw new Error("Request too large.");
    const body=await request.text();if(body.length>14000)throw new Error("Request too large.");
    const query=consentQuery(JSON.parse(body));
    const headers=new Headers({"content-type":"application/json"});
    for(const name of ["origin","sec-gpc","Shopify-Storefront-Consent-Management"]){const value=request.headers.get(name);if(value)headers.set(name,value);}
    const cookie=(request.headers.get("cookie")||"").split(";").filter(part=>/^\s*(_shopify_essential|_tracking_consent)=/.test(part)).join(";");
    if(cookie)headers.set("cookie",cookie);
    const clean=new Request(request.url,{method:"POST",headers,body:JSON.stringify({query,variables:{}})});
    const buyerIp=process.env.VERCEL?request.headers.get("x-forwarded-for")?.split(",")[0]?.trim():request.headers.get("cf-connecting-ip")?.trim();
    const base={request:clean,i18n:{country:"US",language:"EN"} as const};
    const requestContext=buyerIp?createShopifyRequestContext({...base,buyerIp}):createShopifyRequestContext(base);
    const storefrontClient=createStorefrontClient({type:"public",requestContext,config:{storeDomain:"nr9zd0-t5.myshopify.com",apiVersion:"unstable"}});
    const response=await handleShopifyRoutes({request:clean,requestContext,storefrontClient});
    if(!response)throw new Error("Unavailable.");
    for(const [name,value] of Object.entries(responseHeaders))response.headers.set(name,value);
    return response;
  } catch {return Response.json({errors:[{message:"Privacy preferences are temporarily unavailable."}]},{status:400,headers:responseHeaders});}
}
