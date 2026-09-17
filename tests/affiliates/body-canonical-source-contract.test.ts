/** Optional read-only cross-worktree schema qualification against the actual
 * canonical owner's validator. No DB/provider/HTTP calls or source writes. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mapLegacyCommand} from '../../lib/affiliates/canonical-action-fetch';
const source=process.env.HEALTH_COMMAND_VALIDATION_SOURCE;
test('actual canonical validator accepts original Body command envelopes', {skip:!source},async()=>{
 const {validateCommand,commandHash}=await import(pathToFileURL(source!).href);
 const cases:[string,string,Record<string,unknown>][]=[
 ['/api/affiliates/signup','POST',{firstName:'Synthetic',lastName:'Applicant',email:'synthetic@example.test',phone:'5550100',password:'synthetic-only-password',nickname:'EXAMPLE',noReferrer:true}],
 ['/api/affiliates/admin/requests/fixture','POST',{promoCode:'EXAMPLE15',commissionRate:0,recurringCommissionRate:0,couponRate:0,referrerId:null,referralCommissionRate:0}],
 ['/api/affiliates/admin/requests/fixture','DELETE',{}],
 ['/api/affiliates/admin/affiliates/fixture','PATCH',{commissionRate:0,bonusThreshold:null,bonusRate:null}],
 ['/api/affiliates/admin/payouts','POST',{affiliateId:'fixture',method:'bank',paidAt:'2026-09-17T12:00:00.000Z'}],
 ['/api/affiliates/admin/code-sync','POST',{affiliateId:'fixture'}],
 ['/api/affiliates/admin/rates','PUT',{affiliateId:'fixture',rates:[{store:'shopify',category:'supplements',directRate:0,recurringRate:0,referralRate:0,customerDiscount:0,referralBase:'revenue',purchaseTypes:['one_time'],customerEligibility:'all',combinesWith:{orderDiscounts:false,productDiscounts:false,shippingDiscounts:false},effectiveAt:'2027-01-01T00:00:00.000Z',eligibleProductIds:['gid://shopify/Product/1']}]}],
 ];
 for(const [path,method,payload] of cases){
  const mapped=mapLegacyCommand(path,method,payload)!;assert.ok(mapped,path);
  const envelope={version:1,commandId:'87bfc143-8302-4073-b184-a000ee947ff1',...(['signup','payout-record'].includes(mapped.kind)?{}:{expectedVersion:0}),payload:mapped.payload};
  const validated=validateCommand(mapped.kind,envelope);assert.equal(validated.kind,mapped.kind);
  assert.equal(commandHash(validated,'wp:1'),commandHash(validateCommand(mapped.kind,JSON.parse(JSON.stringify(envelope))),'wp:1'));
 }
});
