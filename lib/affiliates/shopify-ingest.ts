import { Prisma, type AffiliateProfile } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getOrder } from '@/lib/portal-commerce';
import type { ShopifyOrder } from '@/types/portal-commerce';
import { resourceId } from './shopify-admin';
import { sendNewOrderEmail } from './mailer';
import { round2 } from './commission';
export type ShopifyOrderLike=ShopifyOrder;
export interface IngestResult {ingested:boolean;reason?:string;affiliateId?:string;matchType?:'code'|'recurring';referralCredited?:boolean}
export interface ManualAttributionResult {ok:boolean;reason?:string;affiliateId?:string;affiliateName?:string;promoCode?:string;commission?:number;referralCredited?:boolean;reassigned?:boolean}
export function commissionBase(order:ShopifyOrder):number {
  if(!['processing','completed'].includes(order.status))return 0;
  return round2(Math.max(0,Number(order.total)-Number(order.shipping_total??0)-Number(order.total_tax??0)));
}
async function transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
  for(let attempt=0;;attempt++){try{return await prisma.$transaction(fn,{isolationLevel:'Serializable',timeout:15_000});}catch(e){if(attempt>=3||(e as {code?:string}).code!=='P2034')throw e;}}
}
/** Snapshot updates and primary/referral earnings commit together. No HTTP inside the transaction. */
async function reconcile(order:ShopifyOrder,manualAffiliateId?:string):Promise<IngestResult & {affiliate?:AffiliateProfile;commission?:number;reassigned?:boolean}>{
  resourceId(order.id);
  if(order.currency&&order.currency!=='USD')throw new Error('Unsupported ledger currency.');
  const program=await prisma.appPortalConfig.findUnique({where:{id:'supplements-program'}});
  if(!program)throw new Error('Initialize the supplements affiliate program before importing orders.');
  const startedAt=JSON.parse(program.json).startedAt as string;
  if(new Date(order.date_created)<new Date(startedAt))return {ingested:false,reason:'Order predates this affiliate program.'};
  const base=commissionBase(order);
  if(!Number.isFinite(base))throw new Error('Invalid order amount.');
  const customerEmail=order.billing.email.trim().toLowerCase();
  const customerName=`${order.billing.first_name} ${order.billing.last_name}`.trim()||'Customer';
  const snapshot={sourceUpdatedAt:order.updated_at?new Date(order.updated_at):undefined,orderTotal:['processing','completed'].includes(order.status)?Number(order.total):0,shippingTotal:Number(order.shipping_total??0),taxTotal:Number(order.total_tax??0),discountTotal:Number(order.discount_total??0),currency:'USD',items:order.line_items.map(l=>({productId:l.product_id,name:l.name??'Item',quantity:l.quantity,unitPrice:Number(l.price??0),subtotal:Number(l.subtotal??0),total:Number(l.total??0),imageUrl:l.image?.src})) as unknown as Prisma.InputJsonValue,itemsSyncedAt:new Date()};
  return transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`supplements-order:${order.id}`}))`;
    const suppressed=await tx.affiliateWebhookEvent.findUnique({where:{provider_externalId:{provider:'supplements-manual-exclusion',externalId:String(order.id)}}});
    if(suppressed&&!manualAffiliateId)return {ingested:false,reason:'Attribution excluded by admin.'};
    let rows=await tx.affiliateOrder.findMany({where:{shopifyOrderId:order.id}});
    const primary=rows.find(r=>r.matchType==='code'||r.matchType==='recurring');
    if(primary?.sourceUpdatedAt && order.updated_at && primary.sourceUpdatedAt>new Date(order.updated_at))return {ingested:false,reason:'Older Shopify snapshot ignored.'};
    let reassigned=false;
    if(manualAffiliateId&&primary&&primary.affiliateId!==manualAffiliateId){
      if(rows.some(r=>r.status==='paid'))throw new Error('Paid commissions cannot be reassigned.');
      await tx.affiliateOrder.deleteMany({where:{shopifyOrderId:order.id,status:'pending'}});rows=[];reassigned=true;
    }
    if(manualAffiliateId&&suppressed)await tx.affiliateWebhookEvent.delete({where:{id:suppressed.id}});
    if(rows.length){
      for(const row of rows){
        const oldBase=Math.max(0,row.orderTotal-(row.shippingTotal??0)-(row.taxTotal??0));
        const rate=row.commissionRateSnapshot??(oldBase>0?row.commission/oldBase*100:0);
        const target=round2(base*rate/100);
        await tx.affiliateOrder.update({where:{id:row.id},data:{...snapshot,commissionRateSnapshot:rate,...(row.status==='pending'?{commission:target}:{})}});
        if(row.status==='paid'){
          // Reconcile refunds after payment as a visible debit in the next payout.
          // The original payment and its commission stay immutable.
          const adjustmentId=`SHOPIFY-ADJUSTMENT-${order.id}-${row.affiliateId}`;
          const prior=await tx.affiliateOrder.findMany({where:{affiliateId:row.affiliateId,orderId:adjustmentId}});
          const settled=prior.filter(a=>a.status==='paid').reduce((sum,a)=>sum+a.commission,0);
          const delta=round2(target-row.commission-settled);
          const pending=prior.find(a=>a.status==='pending');
          if(pending)await tx.affiliateOrder.update({where:{id:pending.id},data:{commission:delta}});
          else if(delta!==0)await tx.affiliateOrder.create({data:{affiliateId:row.affiliateId,orderId:adjustmentId,customerName:`Order #${order.id} refund adjustment`,customerEmail:'',orderTotal:0,commission:delta,matchType:'bonus',status:'pending',currency:'USD'}});
        }
      }
      return {ingested:false,reason:'Existing earnings reconciled.',affiliateId:primary?.affiliateId,matchType:primary?.matchType as 'code'|'recurring'|undefined};
    }
    if(base<=0)return {ingested:false,reason:'No paid product revenue.'};
    let affiliate=manualAffiliateId?await tx.affiliateProfile.findUnique({where:{id:manualAffiliateId}}):null;
    if(manualAffiliateId&&(!affiliate||affiliate.status!=='active'||affiliate.portalRole!=='affiliate'))throw new Error('Select an active affiliate.');
    let matchType:'code'|'recurring'='code';
    let couponCode:string|undefined;
    if(!affiliate){for(const code of order.coupon_lines??[]){affiliate=await tx.affiliateProfile.findFirst({where:{promoCode:{equals:code.code,mode:'insensitive'},status:'active',portalRole:'affiliate'}});if(affiliate){couponCode=code.code;break;}}}
    if(!affiliate&&customerEmail){
      // Email identity only: customers with the same name must never share attribution.
      const seed=await tx.affiliateOrder.findFirst({where:{customerEmail,matchType:'code',orderTotal:{gt:0},createdAt:{lte:new Date(order.date_created)}},orderBy:{createdAt:'asc'},include:{affiliate:true}});
      if(seed){affiliate=seed.affiliate;matchType='recurring';}
    }
    if(!affiliate||affiliate.status!=='active'||affiliate.portalRole!=='affiliate')return {ingested:false,reason:'No active affiliate match.'};
    if(affiliate.email.toLowerCase()===customerEmail)return {ingested:false,reason:'Self purchases do not earn commission.'};
    const rate=matchType==='recurring'?affiliate.recurringCommissionRate:affiliate.commissionRate;
    const common={...snapshot,orderId:String(order.id),shopifyOrderId:order.id,shopifyCustomerId:order.customer_id,customerName,customerEmail,status:'pending',createdAt:new Date(order.date_paid??order.date_created),couponCode:couponCode??(manualAffiliateId?affiliate.promoCode:undefined)};
    const earned=await tx.affiliateOrder.create({data:{...common,affiliateId:affiliate.id,matchType,commission:round2(base*rate/100),commissionRateSnapshot:rate}});
    let referralCredited=false;
    if(affiliate.referrerId&&(affiliate.referralCommissionRate??0)>0){
      const referrer=await tx.affiliateProfile.findUnique({where:{id:affiliate.referrerId}});
      if(referrer?.status==='active'){
        await tx.affiliateOrder.create({data:{...common,affiliateId:referrer.id,sourceAffiliateId:affiliate.id,matchType:'referral',commission:round2(base*affiliate.referralCommissionRate!/100),commissionRateSnapshot:affiliate.referralCommissionRate}});referralCredited=true;
      }
    }
    return {ingested:true,affiliateId:affiliate.id,matchType,referralCredited,reassigned,commission:earned.commission,affiliate};
  });
}
export async function ingestShopifyOrder(order:ShopifyOrder,meta?:{webhookDeliveryId?:string}):Promise<IngestResult>{
  const result=await reconcile(order);
  if('affiliate' in result&&result.affiliate?.notifyOnOrder){const a=result.affiliate;await sendNewOrderEmail({firstName:a.firstName,email:a.email,orderTotal:Number(order.total),commission:result.commission!,customerName:`${order.billing.first_name} ${order.billing.last_name}`.trim(),matchType:result.matchType!,commissionBase:commissionBase(order)}).catch(()=>undefined);}
  if(meta?.webhookDeliveryId)await prisma.affiliateWebhookEvent.upsert({where:{provider_externalId:{provider:'supplements-shopify',externalId:meta.webhookDeliveryId}},create:{provider:'supplements-shopify',externalId:meta.webhookDeliveryId,result:result.reason??'ingested',processedAt:new Date()},update:{result:result.reason??'ingested',processedAt:new Date()}});
  return {ingested:result.ingested,reason:result.reason,affiliateId:result.affiliateId,matchType:result.matchType,referralCredited:'referralCredited' in result?result.referralCredited:undefined};
}
export async function attributeShopifyOrderToAffiliate(id:number,affiliateId:string):Promise<ManualAttributionResult>{
  const order=await getOrder(id);if(!order||commissionBase(order)<=0)return {ok:false,reason:'Only paid orders with product revenue can be attributed.'};
  try{const result=await reconcile(order,affiliateId);return {ok:Boolean(result.affiliateId),...result};}catch(e){return {ok:false,reason:e instanceof Error?e.message:'Attribution failed.'};}
}
export async function removeShopifyOrderAttribution(id:number):Promise<{ok:boolean;removed:number;reason?:string}>{
  return transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`supplements-order:${id}`}))`;
    if(await tx.affiliateOrder.count({where:{shopifyOrderId:id,status:'paid'}}))return {ok:false,removed:0,reason:'Paid commissions cannot be removed.'};
    const result=await tx.affiliateOrder.deleteMany({where:{shopifyOrderId:id,status:'pending'}});
    await tx.affiliateWebhookEvent.upsert({where:{provider_externalId:{provider:'supplements-manual-exclusion',externalId:String(id)}},create:{provider:'supplements-manual-exclusion',externalId:String(id),result:'excluded'},update:{result:'excluded'}});
    return {ok:true,removed:result.count};
  });
}
