import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../lib/db/prisma';
import { createAffiliate,recordPayout,updateAffiliate } from '../../lib/affiliates/store';
import { ingestShopifyOrder,removeShopifyOrderAttribution } from '../../lib/affiliates/shopify-ingest';
import type { ShopifyOrder } from '../../types/portal-commerce';
const enabled=Boolean(process.env.AFFILIATE_TEST_DATABASE_URL);
if(enabled){
  const url=new URL(process.env.AFFILIATE_TEST_DATABASE_URL!);
  if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Ledger integration tests require a disposable local database.');
  process.env.SUPPLEMENTS_DATABASE_URL=process.env.AFFILIATE_TEST_DATABASE_URL;
}
test('real database: idempotent earnings, recurring identity, refund debits, payouts, and exclusions',{skip:!enabled},async()=>{
  const prefix=`fixture${Date.now()}`;
  await prisma.appPortalConfig.upsert({where:{id:'supplements-program'},create:{id:'supplements-program',json:JSON.stringify({startedAt:'2026-09-01T00:00:00Z'})},update:{}});
  const ref=await createAffiliate({firstName:'Referrer',lastName:'Fixture',email:`${prefix}-ref@example.test`,phone:'',promoCode:`${prefix}REF`,role:'affiliate',status:'active',commissionRate:20,couponRate:15,notifyOnOrder:false});
  const affiliate=await createAffiliate({firstName:'Creator',lastName:'Fixture',email:`${prefix}@example.test`,phone:'',promoCode:`${prefix}15`,role:'affiliate',status:'active',commissionRate:20,recurringCommissionRate:20,couponRate:15,referrerId:ref.id,referralCommissionRate:5,notifyOnOrder:false});
  const order:ShopifyOrder={id:6543210987654,status:'processing',currency:'USD',total:'100',shipping_total:'10',total_tax:'10',date_created:'2026-09-16T10:00:00Z',updated_at:'2026-09-16T10:00:00Z',date_paid:'2026-09-16T10:00:00Z',billing:{first_name:'Pat',last_name:'Customer',email:`${prefix}-buyer@example.test`,address_1:'',city:'',state:'',postcode:'',country:'US'},shipping:{first_name:'Pat',last_name:'Customer',address_1:'',city:'',state:'',postcode:'',country:'US'},line_items:[{product_id:8543210987654,name:'Fixture supplement',quantity:1,total:'80'}],coupon_lines:[{code:affiliate.promoCode}]};
  assert.equal((await ingestShopifyOrder(order)).ingested,true);
  await ingestShopifyOrder(order);await ingestShopifyOrder(order);
  let rows=await prisma.affiliateOrder.findMany({where:{shopifyOrderId:order.id}});
  assert.equal(rows.length,2);assert.equal(rows.find(r=>r.affiliateId===affiliate.id)?.commission,16);assert.equal(rows.find(r=>r.affiliateId===ref.id)?.commission,4);
  // Historical rates stay attached to this order after the admin changes future rates.
  await updateAffiliate(affiliate.id,{commissionRate:30});
  await ingestShopifyOrder({...order,total:'60',updated_at:'2026-09-16T11:00:00Z'});
  rows=await prisma.affiliateOrder.findMany({where:{shopifyOrderId:order.id}});
  const primary=rows.find(r=>r.affiliateId===affiliate.id)!;assert.equal(primary.commission,8);
  // Late delivery cannot restore an older total.
  await ingestShopifyOrder(order);assert.equal((await prisma.affiliateOrder.findUnique({where:{id:primary.id}}))?.commission,8);
  const recurring={...order,id:order.id+1,date_created:'2026-09-16T12:00:00Z',updated_at:'2026-09-16T12:00:00Z',coupon_lines:[]};
  assert.equal((await ingestShopifyOrder(recurring)).matchType,'recurring');
  assert.equal((await ingestShopifyOrder({...recurring,id:order.id+2,billing:{...order.billing,email:'different-customer@example.test'}})).ingested,false);
  assert.equal((await ingestShopifyOrder({...order,id:order.id+3,billing:{...order.billing,email:affiliate.email}})).ingested,false);
  assert.equal((await ingestShopifyOrder({...order,id:order.id+4,date_created:'2026-08-01T00:00:00Z'})).ingested,false);
  const payout=await recordPayout({affiliateId:affiliate.id,orderIds:[primary.id],method:'bank',amount:8});assert.equal(payout.amount,8);
  await assert.rejects(()=>recordPayout({affiliateId:affiliate.id,orderIds:[primary.id],method:'bank',amount:8}));
  const refunded={...order,status:'refunded',total:'0',updated_at:'2026-09-16T13:00:00Z'};
  await ingestShopifyOrder(refunded);await ingestShopifyOrder(refunded);
  assert.equal((await prisma.affiliateOrder.findUnique({where:{id:primary.id}}))?.commission,8);
  const debit=await prisma.affiliateOrder.findMany({where:{affiliateId:affiliate.id,orderId:`SHOPIFY-ADJUSTMENT-${order.id}-${affiliate.id}`}});
  assert.equal(debit.length,1);assert.equal(debit[0].commission,-8);
  const next=await prisma.affiliateOrder.findFirstOrThrow({where:{shopifyOrderId:recurring.id,affiliateId:affiliate.id}});
  const nextPayout=await recordPayout({affiliateId:affiliate.id,orderIds:[next.id],method:'bank'});
  assert.equal(nextPayout.amount,8);assert.equal(nextPayout.orderIds.length,2);
  const third={...order,id:order.id+5,updated_at:'2026-09-16T14:00:00Z'};
  await ingestShopifyOrder(third);assert.equal((await removeShopifyOrderAttribution(third.id)).removed,2);
  assert.equal((await ingestShopifyOrder(third)).ingested,false);
  await prisma.$disconnect();
});
