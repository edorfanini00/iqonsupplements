import { createHmac,timingSafeEqual } from 'node:crypto';
export function verifyShopifyWebhookSignature(raw:string,signature:string|null,secret:string|undefined):{valid:boolean;reason?:string}{
  if(!secret?.trim()||!signature)return {valid:false,reason:'Webhook authentication is not configured or missing.'};
  const expected=createHmac('sha256',secret.trim()).update(raw).digest();
  const actual=Buffer.from(signature,'base64');
  return {valid:actual.length===expected.length&&timingSafeEqual(actual,expected)};
}
export function logIngestEvent(event:Record<string,unknown>){console.info('[supplements-affiliates]',JSON.stringify(event));}
