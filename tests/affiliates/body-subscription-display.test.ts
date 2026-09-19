import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SUBSCRIPTION_INTERVAL_OPTIONS,subscriptionIntervalLabel} from '../../lib/subscriptions/config';
test('Health subscription read display retains exact original interval labels',()=>{
 assert.deepEqual(SUBSCRIPTION_INTERVAL_OPTIONS,[{days:10,label:'Every 10 days'},{days:14,label:'Every 2 weeks'},{days:30,label:'Every month'},{days:60,label:'Every 2 months'}]);
 assert.equal(subscriptionIntervalLabel(30),'Every month');
 assert.equal(subscriptionIntervalLabel(17),'Every 17 days');
});
