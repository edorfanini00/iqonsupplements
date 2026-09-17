import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affiliateComparison,type ProgramReport} from './program-view';
test('uses canonical report revenue, keeps zero and falls back for older reports',()=>{
 const base={id:'sale',category:'peptides',lineItemId:'legacy-order',createdAt:'2026-09-16T00:00:00Z',affiliateId:'x',currency:'USD',storeId:'woo-health',externalOrderId:'woo',orderId:'woo',matchType:'code',commission:20,orderTotal:120,reportedRevenue:100,paidAmount:20,outstandingAmount:0,adjustmentOfId:null};
 const rows=[base,{...base,id:'refund',orderTotal:-25,reportedRevenue:-25,commission:-5,adjustmentOfId:'sale'}] as ProgramReport['orders'];
 assert.equal(affiliateComparison(rows,[])[0].sales,75);
 assert.equal(affiliateComparison([{...base,reportedRevenue:0}] as ProgramReport['orders'],[])[0].sales,0);
 assert.equal(affiliateComparison([{...base,reportedRevenue:undefined}] as ProgramReport['orders'],[])[0].sales,120);
});
