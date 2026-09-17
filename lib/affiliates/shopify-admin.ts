/** Supplements-only Admin API client. Credentials never reach the storefront bundle. */
import { shopifyAuthConfigured, shopifyAuthenticatedFetch } from './shopify-auth';
export const SUPPLEMENTS_SHOP = 'nr9zd0-t5.myshopify.com';
export function shopifyAdminConfigured():boolean {
  return shopifyAuthConfigured();
}
export function supplementsShop():string {
  const domain=process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN?.trim();
  if(domain!==SUPPLEMENTS_SHOP) throw new Error('Connect the IQON Supplements Shopify store.');
  if(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STORE_DOMAIN!==domain) throw new Error('Storefront and affiliate Shopify stores must match.');
  return domain;
}
export async function shopifyAdmin<T>(query:string,variables:Record<string,unknown>={}):Promise<T> {
  supplementsShop();
  const response=await shopifyAuthenticatedFetch(query,variables);
  if(!response.ok)throw new Error(`Shopify request failed (${response.status}).`);
  const json=await response.json().catch(() => { throw new Error('SHOPIFY_QUERY_FAILED'); }) as {data?:T;errors?:{message:string}[]}|null;
  if(!json||json.errors?.length||!json.data)throw new Error('Shopify could not complete this request. Check the app scopes and connection.');
  return json.data;
}
/** The portal uses numeric resource IDs, stored as Postgres float8, not 32-bit Int. */
export function resourceId(value:unknown):number {
  const id=Number(String(value??'').split('/').pop());
  if(!Number.isSafeInteger(id)||id<=0)throw new Error('Unsupported Shopify resource ID.');
  return id;
}
