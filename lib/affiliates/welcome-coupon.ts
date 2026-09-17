import type { Affiliate } from './types';
import { shopifyAdmin } from './shopify-admin';
import { CUSTOMER_LOOKUP,CUSTOMER_CREATE } from './shopify-queries';
import { findCoupon,writeCoupon } from './coupon-sync';
/** An optional, separately approved supplements offer. Disabled until configured. */
export async function ensureWelcomeCoupon(affiliate:Affiliate):Promise<string|null>{
  const percent=Number(process.env.SUPPLEMENTS_WELCOME_DISCOUNT_PERCENT??0);
  if(!Number.isFinite(percent)||percent<=0)return null;
  if(percent>100)throw new Error('Welcome discount must be at most 100%.');
  const code=`WELCOME-${affiliate.id.slice(-10).toUpperCase()}`;
  const title=`IQON Supplements welcome:${affiliate.id}`;
  const existing=await findCoupon(code);
  if(existing){if(existing.codeDiscount.title!==title)throw new Error('Welcome code conflicts with an existing discount.');return code;}
  const lookup=await shopifyAdmin<{customers:{nodes:{id:string;defaultEmailAddress?:{emailAddress:string}}[]}}>(CUSTOMER_LOOKUP,{query:`email:${JSON.stringify(affiliate.email)}`});
  let customerId=lookup.customers.nodes.find(c=>c.defaultEmailAddress?.emailAddress.toLowerCase()===affiliate.email.toLowerCase())?.id;
  if(!customerId){
    const created=await shopifyAdmin<{customerCreate:{customer?:{id:string};userErrors:{message:string}[]}}>(CUSTOMER_CREATE,{input:{email:affiliate.email,firstName:affiliate.firstName,lastName:affiliate.lastName}});
    if(created.customerCreate.userErrors.length||!created.customerCreate.customer)throw new Error('Could not register the welcome discount customer.');
    customerId=created.customerCreate.customer.id;
  }
  await writeCoupon({title,code,startsAt:new Date().toISOString(),usageLimit:1,appliesOncePerCustomer:true,context:{customers:{add:[customerId]}},customerGets:{value:{percentage:percent/100},items:{all:true}},combinesWith:{orderDiscounts:false,productDiscounts:false,shippingDiscounts:false}});
  return code;
}
