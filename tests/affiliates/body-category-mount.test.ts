import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('affiliate Overview keeps category cards; admin retains the independent original Shopify toggle',()=>{
 const source=(page:string)=>readFileSync(new URL(`../../app/affiliates/${page}/page.tsx`,import.meta.url),'utf8');
 assert.ok(source('dashboard').includes('<CategoryRevenue preset={preset} audience="affiliate" />'));
 const admin=source('admin');
 assert.ok(admin.includes('setRevenueView("shopify")'));
 assert.ok(admin.includes('const range = resolveRange(p)'));
 assert.ok(admin.includes('/api/affiliates/category-revenue?${catParams}'));
 assert.ok(admin.includes('storeRevenue + appRevenue'));
});
