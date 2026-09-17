import { shopifyAdmin,resourceId } from '@/lib/affiliates/shopify-admin';
import { SUBSCRIPTIONS_QUERY,SUBSCRIPTION_PAUSE,SUBSCRIPTION_ACTIVATE,SUBSCRIPTION_CANCEL } from '@/lib/affiliates/shopify-queries';
export interface SubscriptionItem {productId:number;quantity:number;name?:string;price:number}
export interface SubscriptionRecord {id:string;status:string;customerEmail:string;customerName:string;currency:string;items:SubscriptionItem[];intervalDays:number;intervalLabel:string;discountPercent:number;firstOrderId:number|null;lastOrderId:number|null;nextBillingAt:Date|null;createdAt:Date;total:number;provider:'shopify'}
export async function getAllSubscriptions():Promise<SubscriptionRecord[]>{
  type Contract={id:string;status:string;createdAt:string;nextBillingDate:string|null;currencyCode:string;customer:{id:string;email?:string;firstName?:string;lastName?:string};billingPolicy:{interval:string;intervalCount:number};originOrder?:{id:string}|null;lines:{nodes:{id:string;title:string;quantity:number;productId:string|null;currentPrice:{amount:string;currencyCode:string}}[];pageInfo:{hasNextPage:boolean}}};
  const out:SubscriptionRecord[]=[];let after:string|null=null;
  for(let page=0;page<30;page++){
    const data:{subscriptionContracts:{nodes:Contract[];pageInfo:{hasNextPage:boolean;endCursor:string}}}=await shopifyAdmin(SUBSCRIPTIONS_QUERY,{after});
    for(const c of data.subscriptionContracts.nodes){
      if(c.lines.pageInfo.hasNextPage)throw new Error('Subscription has more than 100 lines. Manage it in Shopify.');
      const intervalDays=c.billingPolicy.intervalCount*({DAY:1,WEEK:7,MONTH:30,YEAR:365}[c.billingPolicy.interval]??30);
      const items=c.lines.nodes.map(l=>({productId:l.productId?resourceId(l.productId):0,name:l.title,quantity:l.quantity,price:Number(l.currentPrice.amount)}));
      out.push({id:String(resourceId(c.id)),status:c.status.toLowerCase(),customerEmail:c.customer.email??'',customerName:`${c.customer.firstName??''} ${c.customer.lastName??''}`.trim(),currency:c.currencyCode,items,intervalDays,intervalLabel:`Every ${c.billingPolicy.intervalCount} ${c.billingPolicy.interval.toLowerCase()}${c.billingPolicy.intervalCount>1?'s':''}`,discountPercent:0,firstOrderId:c.originOrder?resourceId(c.originOrder.id):null,lastOrderId:null,nextBillingAt:c.nextBillingDate?new Date(c.nextBillingDate):null,createdAt:new Date(c.createdAt),total:items.reduce((s,l)=>s+l.price*l.quantity,0),provider:'shopify'});
    }
    if(!data.subscriptionContracts.pageInfo.hasNextPage)return out;after=data.subscriptionContracts.pageInfo.endCursor;
  }
  throw new Error('Subscription pagination limit reached.');
}
export async function changeSubscription(id:string,action:'pause'|'resume'|'cancel'){
  const query={pause:SUBSCRIPTION_PAUSE,resume:SUBSCRIPTION_ACTIVATE,cancel:SUBSCRIPTION_CANCEL}[action];
  const data=await shopifyAdmin<Record<string,{contract?:{id:string;status:string};userErrors:{message:string}[]}>>(query,{id:`gid://shopify/SubscriptionContract/${resourceId(id)}`});
  const result=Object.values(data)[0];if(result.userErrors.length||!result.contract)throw new Error(result.userErrors.map(e=>e.message).join('; ')||'Subscription could not be changed.');
  return result.contract;
}
