import type { Affiliate } from './types';
import { getAllAffiliates } from './store';
import { shopifyAdmin,shopifyAdminConfigured } from './shopify-admin';
import { COUPON_QUERY,COUPON_CREATE,COUPON_UPDATE,COUPON_DEACTIVATE } from './shopify-queries';
export interface CouponSyncResult {promoCode:string;affiliateId:string;status:'ok'|'created'|'updated'|'missing'|'error';message?:string}
type Coupon={id:string;codeDiscount:{title?:string;status?:string;customerGets?:{value?:{percentage?:number}}}};
type MutationResult=Record<string,{codeDiscountNode?:{id:string};userErrors:{field?:string[];message:string}[]}>;
export async function findCoupon(code:string):Promise<Coupon|null>{
  const result=await shopifyAdmin<{codeDiscountNodeByCode:Coupon|null}>(COUPON_QUERY,{code});return result.codeDiscountNodeByCode;
}
export async function writeCoupon(input:Record<string,unknown>,id?:string){
  const result=await shopifyAdmin<MutationResult>(id?COUPON_UPDATE:COUPON_CREATE,{input,...(id?{id}:{})});
  const payload=Object.values(result)[0];
  if(payload.userErrors.length||!payload.codeDiscountNode)throw new Error(payload.userErrors.map(e=>e.message).join('; ')||'Discount was not saved.');
  return payload.codeDiscountNode.id;
}
export async function retireShopifyCoupon(code:string):Promise<{ok:boolean;message:string}>{
  if(!shopifyAdminConfigured())return {ok:false,message:'Shopify Admin integration is not connected.'};
  const existing=await findCoupon(code);if(!existing)return {ok:true,message:'Coupon does not exist.'};
  if(!existing.codeDiscount.title?.startsWith('IQON Supplements affiliate:'))return {ok:false,message:'This discount is not managed by this affiliate program.'};
  const result=await shopifyAdmin<MutationResult>(COUPON_DEACTIVATE,{id:existing.id});
  const errors=Object.values(result)[0].userErrors;
  return {ok:errors.length===0,message:errors.length?errors.map(e=>e.message).join('; '):'Coupon deactivated.'};
}
export async function syncAffiliateCoupon(affiliate:Affiliate,dryRun=false):Promise<CouponSyncResult>{
  const base={promoCode:affiliate.promoCode,affiliateId:affiliate.id};
  const title=`IQON Supplements affiliate:${affiliate.id}`;
  const existing=await findCoupon(affiliate.promoCode);
  if(existing&&existing.codeDiscount.title!==title)return {...base,status:'error',message:'That code belongs to another discount. Choose a different code.'};
  if(affiliate.couponRate<=0){if(existing&&!dryRun){const result=await retireShopifyCoupon(affiliate.promoCode);if(!result.ok)throw new Error(result.message);}return {...base,status:'ok',message:'Customer discount disabled.'};}
  if(!Number.isFinite(affiliate.couponRate)||affiliate.couponRate>100)throw new Error('Discount must be between 0 and 100%.');
  const matches=existing?.codeDiscount.status==='ACTIVE'&&existing.codeDiscount.customerGets?.value?.percentage===affiliate.couponRate/100;
  if(matches)return {...base,status:'ok'};
  if(dryRun)return {...base,status:'missing',message:existing?'Discount needs updating.':'Discount needs creating.'};
  await writeCoupon({title,code:affiliate.promoCode,startsAt:new Date().toISOString(),endsAt:null,context:{all:"ALL"},customerGets:{value:{percentage:affiliate.couponRate/100},items:{all:true},appliesOnOneTimePurchase:true,appliesOnSubscription:true},recurringCycleLimit:0,combinesWith:{orderDiscounts:false,productDiscounts:false,shippingDiscounts:false},appliesOncePerCustomer:false},existing?.id);
  return {...base,status:existing?'updated':'created'};
}
export async function syncAffiliateCoupons(options?:{dryRun?:boolean;affiliateId?:string}){
  if(!shopifyAdminConfigured())return {configured:false,results:[] as CouponSyncResult[]};
  const affiliates=(await getAllAffiliates()).filter(a=>a.role==='affiliate'&&a.status==='active'&&(!options?.affiliateId||a.id===options.affiliateId));
  const results:CouponSyncResult[]=[];
  for(const a of affiliates){try{results.push(await syncAffiliateCoupon(a,options?.dryRun??false));}catch(err){results.push({promoCode:a.promoCode,affiliateId:a.id,status:'error',message:err instanceof Error?err.message:'Discount sync failed.'});}}
  return {configured:true,results};
}
