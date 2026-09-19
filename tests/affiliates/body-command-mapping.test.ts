import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapLegacyCommand} from '../../lib/affiliates/canonical-action-fetch';
test('maps only five reviewed original actions, preserving payload zero and target',()=>{
 assert.deepEqual(mapLegacyCommand('/api/affiliates/admin/create','POST',{firstName:'Test',lastName:'Creator',email:'test@example.test',role:'affiliate',commissionRate:0}),{kind:'admin-create',payload:{firstName:'Test',lastName:'Creator',email:'test@example.test',role:'affiliate',commissionRate:0}});
 assert.deepEqual(mapLegacyCommand('/api/affiliates/signup','POST',{email:'a'}),{kind:'signup',payload:{email:'a'}});
 assert.deepEqual(mapLegacyCommand('/api/affiliates/admin/requests/a','POST',{commissionRate:0}),{kind:'affiliate-approval',payload:{commissionRate:0,affiliateId:'a',decision:'approve'}});
 assert.deepEqual(mapLegacyCommand('/api/affiliates/admin/requests/a','DELETE',{}),{kind:'affiliate-approval',payload:{affiliateId:'a',decision:'deny'}});
 assert.deepEqual(mapLegacyCommand('/api/affiliates/admin/affiliates/a','PATCH',{commissionRate:0}),{kind:'commission-settings',payload:{commissionRate:0,affiliateId:'a'}});
 assert.equal(mapLegacyCommand('/api/affiliates/admin/payouts','POST',{affiliateId:'a'})?.kind,'payout-record');
 assert.equal(mapLegacyCommand('/api/affiliates/admin/code-sync','POST',{affiliateId:'a'})?.kind,'creator-code-sync');
 for(const [p,m] of [['/api/affiliates/admin/payouts/a','DELETE'],['/api/affiliates/admin/coupon-sync','POST'],['/api/affiliates/bank','PUT'],['/api/affiliates/admin/affiliates/a','GET']])assert.equal(mapLegacyCommand(p,m,{}),null);
});
