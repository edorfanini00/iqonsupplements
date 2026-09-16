/** Supplements-only Admin API client. Credentials never reach the storefront bundle. */
export const SUPPLEMENTS_SHOP = 'nr9zd0-t5.myshopify.com';
export function shopifyAdminConfigured():boolean {
  return Boolean(process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN?.trim() && process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN?.trim() === SUPPLEMENTS_SHOP);
}
export function supplementsShop():string {
  const domain=process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN?.trim();
  if(domain!==SUPPLEMENTS_SHOP) throw new Error('Connect the IQON Supplements Shopify store.');
  if(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STORE_DOMAIN!==domain) throw new Error('Storefront and affiliate Shopify stores must match.');
  return domain;
}
export async function shopifyAdmin<T>(query:string,variables:Record<string,unknown>={}):Promise<T> {
  const domain=supplementsShop();
  const token=process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN?.trim();
  if(!token) throw new Error('Shopify Admin integration is not connected.');
  const response=await fetch(`https://${domain}/admin/api/2026-07/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query,variables}),cache:'no-store',signal:AbortSignal.timeout(25_000)});
  if(!response.ok)throw new Error(`Shopify request failed (${response.status}).`);
  const json=await response.json() as {data?:T;errors?:{message:string}[]};
  if(json.errors?.length||!json.data)throw new Error('Shopify could not complete this request. Check the app scopes and connection.');
  return json.data;
}
/** The portal uses numeric resource IDs, stored as Postgres float8, not 32-bit Int. */
export function resourceId(value:unknown):number {
  const id=Number(String(value??'').split('/').pop());
  if(!Number.isSafeInteger(id)||id<=0)throw new Error('Unsupported Shopify resource ID.');
  return id;
}
