import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { hashPassword,verifyPassword,validPassword } from '../../lib/affiliates/password';
import { verifyShopifyWebhookSignature } from '../../lib/affiliates/shopify-webhook';
import { encryptBankInfo,decryptBankInfo } from '../../lib/affiliates/bank-crypto';
import { supplementsShop,shopifyAdminConfigured,resourceId } from '../../lib/affiliates/shopify-admin';
import { commissionBase } from '../../lib/affiliates/shopify-ingest';
import { normalizeOrder,type AdminOrder } from '../../lib/portal-commerce';
import { computeOrderCommissions } from '../../lib/affiliates/commission';
import { validateReferrer } from '../../lib/affiliates/referrals';
import type { ShopifyOrder } from '../../types/portal-commerce';
import { redactAudit } from '../../lib/affiliates/audit';

test('audit history redacts nested banking and authentication values',()=>{
  assert.deepEqual(redactAudit({email:'affiliate@example.test',bankInfo:{accountNumber:'1234'},changes:[{passwordHash:'private',token:'private',status:'active'}]}),{
    email:'affiliate@example.test',bankInfo:'[redacted]',changes:[{passwordHash:'[redacted]',token:'[redacted]',status:'active'}],
  });
});

test('passwords are salted and invalid credentials do not verify',async()=>{
  const a=await hashPassword('correct-horse-battery-staple');const b=await hashPassword('correct-horse-battery-staple');
  assert.notEqual(a,b);assert.equal(await verifyPassword('correct-horse-battery-staple',a),true);assert.equal(await verifyPassword('incorrect',a),false);
  assert.equal(validPassword('short'),false);assert.equal(validPassword('a'.repeat(257)),false);
});
test('bank information requires a dedicated key and rejects tampering',()=>{
  delete process.env.SUPPLEMENTS_AFFILIATE_BANK_ENCRYPTION_KEY;
  assert.throws(()=>encryptBankInfo({accountNumber:'0123456789'}));
  process.env.SUPPLEMENTS_AFFILIATE_BANK_ENCRYPTION_KEY='only-a-local-test-key-with-more-than-32-characters';
  const {payload,last4}=encryptBankInfo({accountNumber:'0123456789',bankName:'Fixture Bank'});
  assert.equal(last4,'6789');assert.equal(decryptBankInfo(payload).accountNumber,'0123456789');
  const corrupt=Buffer.from(payload,'base64');corrupt[20]^=1;assert.throws(()=>decryptBankInfo(corrupt.toString('base64')));
});
test('Shopify webhooks fail closed without a secret or with a modified body',()=>{
  const body='{"id":1234567890123}';const secret='separate-supplements-fixture';const signature=createHmac('sha256',secret).update(body).digest('base64');
  assert.equal(verifyShopifyWebhookSignature(body,signature,secret).valid,true);
  assert.equal(verifyShopifyWebhookSignature(body+' ',signature,secret).valid,false);
  assert.equal(verifyShopifyWebhookSignature(body,signature,undefined).valid,false);
  assert.equal(verifyShopifyWebhookSignature(body,null,secret).valid,false);
});
test('legacy credentials and another Shopify store cannot configure this business',()=>{
  const saved={...process.env};
  try{
    delete process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN;delete process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN;
    process.env.WC_CONSUMER_KEY='legacy';process.env.SHOPIFY_ADMIN_TOKEN='legacy';
    assert.equal(shopifyAdminConfigured(),false);assert.throws(supplementsShop);
    process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN='other-business.myshopify.com';assert.throws(supplementsShop);
    process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN='nr9zd0-t5.myshopify.com';process.env.SHOPIFY_STORE_DOMAIN='other-business.myshopify.com';assert.throws(supplementsShop);
  }finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
test('large Shopify IDs remain exact and unsafe IDs are refused',()=>{
  assert.equal(resourceId('gid://shopify/Order/6543210987654'),6543210987654);assert.throws(()=>resourceId('9007199254740993'));assert.throws(()=>resourceId(-1));
});
test('commissions exclude shipping/tax and cancellation overrides a prior payment',()=>{
  const order={status:'processing',total:'95',shipping_total:'10',total_tax:'5'} as ShopifyOrder;
  assert.equal(commissionBase(order),80);
  assert.deepEqual(computeOrderCommissions({orderTotal:95,commissionBase:80,commissionRate:20,referrerId:'ref',referralCommissionRate:5,referrerActive:true}),{primaryCommission:16,referralCommission:4});
  assert.equal(commissionBase({...order,status:'refunded'}),0);assert.equal(commissionBase({...order,status:'pending'}),0);
});
test('Shopify normalization uses current totals and rejects unsupported currencies/partial pages',()=>{
  const money=(amount:string)=>({shopMoney:{amount,currencyCode:'USD'}});
  const raw={id:'gid://shopify/Order/6543210987654',legacyResourceId:'6543210987654',name:'#1001',createdAt:'2026-09-16T10:00:00Z',updatedAt:'2026-09-16T11:00:00Z',test:false,displayFinancialStatus:'PARTIALLY_REFUNDED',displayFulfillmentStatus:'FULFILLED',currencyCode:'USD',currentTotalPriceSet:money('50'),currentSubtotalPriceSet:money('40'),currentShippingPriceSet:money('5'),currentTotalTaxSet:money('5'),currentTotalDiscountsSet:money('10'),discountCodes:['CREATOR15'],lineItems:{nodes:[],pageInfo:{hasNextPage:false}},fulfillments:[]} as AdminOrder;
  const order=normalizeOrder(raw);assert.equal(order.status,'completed');assert.equal(order.total,'50');assert.equal(commissionBase(order),40);
  assert.equal(normalizeOrder({...raw,cancelledAt:'2026-09-16T11:00:00Z'}).status,'cancelled');
  assert.equal(normalizeOrder({...raw,test:true}).status,'failed');
  assert.throws(()=>normalizeOrder({...raw,currencyCode:'EUR'}));
  assert.throws(()=>normalizeOrder({...raw,lineItems:{nodes:[],pageInfo:{hasNextPage:true}}}));
});
test('referral graph rejects indirect cycles',async()=>{
  const nodes={a:{id:'a',portalRole:'affiliate',status:'active',referrerId:null},b:{id:'b',portalRole:'affiliate',status:'active',referrerId:'a'}};
  await assert.rejects(()=>validateReferrer('a','b',async id=>nodes[id as keyof typeof nodes]??null));
});
