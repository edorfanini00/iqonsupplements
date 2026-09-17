import test from 'node:test';
import assert from 'node:assert/strict';
import { programQuery, businessDayInstant, validateAllocations, selectProgramCurrency, csvCell, settlementPlan, payoutAttemptDisposition, currentCrossStoreActive, approvalAgreements, affiliateComparison, type ProgramReport } from '../../components/affiliates/shared/program-view';

test('shared UI uses New York DST boundaries and retains affiliate/category', () => {
 assert.equal(businessDayInstant('2026-03-08',true),'2026-03-09T03:59:59.999Z');
 const q=new URLSearchParams(programQuery({category:'app',start:'2026-03-08',end:'2026-03-08',affiliateId:'creator'}));
 assert.equal(q.get('affiliateId'),'creator'); assert.equal(q.get('category'),'app');
});
test('partial payout UI rejects mixed currency and excess allocations', () => {
 const orders=[{id:'a',affiliateId:'x',currency:'USD',outstandingAmount:10},{id:'b',affiliateId:'x',currency:'EUR',outstandingAmount:10}];
 assert.deepEqual(validateAllocations(orders,{a:'2.50'},'x'),[{orderId:'a',amount:2.5}]);
 assert.throws(()=>validateAllocations(orders,{a:'11'},'x'));
 assert.throws(()=>validateAllocations(orders,{a:'2',b:'2'},'x'));
});
test('currency selection uses payout allocation currencies and keeps unknown records',()=>{
 const report={currencies:[],orders:[{currency:null}],payouts:[{currency:null,amount:30,items:[{currency:'USD',amount:10},{currency:'EUR',amount:20}]}]} as unknown as ProgramReport;
 assert.equal(selectProgramCurrency(report,'UNKNOWN').orders.length,1);
 assert.deepEqual(selectProgramCurrency(report,'USD').payouts[0].items,[{currency:'USD',amount:10}]);
 assert.ok(csvCell('=CMD()').startsWith('"\''));
});

test('full settlement nets out-of-filter negative adjustments and protects uncertain tokens',()=>{
 const full=[{id:'sale',affiliateId:'x',currency:'USD',outstandingAmount:50},{id:'refund',affiliateId:'x',currency:'USD',outstandingAmount:-12}];
 assert.deepEqual(settlementPlan(full,{sale:'30'},'x'),{currency:'USD',amount:18,allocations:[{orderId:'sale',amount:30},{orderId:'refund',amount:-12}]});
 assert.throws(()=>settlementPlan(full,{sale:'10'},'x'));
 assert.equal(payoutAttemptDisposition(400,true,false),'correctable');
 assert.equal(payoutAttemptDisposition(400,false,false),'uncertain');
 assert.equal(payoutAttemptDisposition(500,true,false),'uncertain');
 assert.equal(payoutAttemptDisposition(400,true,true),'recorded');
});
test('explicit zero agreements are valid but missing agreements block approval',()=>{
 const rates=['peptides','supplements','skincare','app'].map(category=>({category,directRate:0,recurringRate:0,referralRate:0,customerDiscount:0,referralBase:'commission' as const}));
 assert.equal(approvalAgreements(rates).directRate,0);assert.throws(()=>approvalAgreements(rates.slice(1)));
});
test('cross-store promotion requires matching current verified activations',()=>{
 const stores=[{storeId:'woo-health',code:'X',status:'active',verifiedAt:'2026-09-16T00:00:00Z'},{storeId:'shopify-supplements',code:'X',status:'active',verifiedAt:'2026-09-16T00:00:00Z'}];
 assert.equal(currentCrossStoreActive(stores,true),true);assert.equal(currentCrossStoreActive(stores,false),false);
 assert.equal(currentCrossStoreActive([stores[0],{...stores[1],status:'conflict'}],true),false);
});
test('affiliate comparison deduplicates mixed orders and excludes referral sales',()=>{
 const base={affiliateId:'x',currency:'USD',storeId:'shop',externalOrderId:'mixed',orderId:'mixed',matchType:'code',commission:5,orderTotal:50,paidAmount:0,outstandingAmount:5,adjustmentOfId:null};
 const rows=[{...base,id:'a',category:'supplements'},{...base,id:'b',category:'skincare'},{...base,id:'c',affiliateId:'referrer',matchType:'referral'}] as ProgramReport['orders'];
 const result=affiliateComparison(rows,[]), direct=result.find(r=>r.affiliateId==='x')!,referrer=result.find(r=>r.affiliateId==='referrer')!;
 assert.equal(direct.orders,1);assert.equal(direct.sales,100);assert.equal(direct.earnings,10);assert.equal(referrer.sales,0);assert.equal(referrer.earnings,5);
});
