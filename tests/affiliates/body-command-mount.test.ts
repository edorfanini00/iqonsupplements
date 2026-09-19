import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('original signup/approval/payout/profile forms use durable canonical action client',()=>{
 assert.ok(readFileSync(new URL('../../app/affiliates/admin/layout.tsx',import.meta.url),'utf8').includes('<CommandRecovery />'));
 assert.ok(readFileSync(new URL('../../app/affiliates/admin/affiliates/[id]/page.tsx',import.meta.url),'utf8').includes('<CanonicalAffiliateControls affiliateId={id} />'));
 assert.ok(readFileSync(new URL('../../app/affiliates/admin/requests/page.tsx',import.meta.url),'utf8').includes('BODY COMMAND REJECTION STATE'));
 for(const page of ['signup','admin/requests','admin/payouts','admin/affiliates','admin/affiliates/[id]']){
 const source=readFileSync(new URL(`../../app/affiliates/${page}/page.tsx`,import.meta.url),'utf8');assert.ok(source.includes('import { canonicalActionFetch as fetch }'));
 }
});
