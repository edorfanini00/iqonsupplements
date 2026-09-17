import { describe, it, expect, vi } from 'vitest';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
vi.mock('next/navigation', () => ({ useRouter: () => ({push:vi.fn(),refresh:vi.fn()}), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
const pages: Record<string,()=>Promise<unknown>> = {
'../../app/affiliates/admin/page.tsx':()=>import('../../app/affiliates/admin/page'),
'../../app/affiliates/admin/affiliates/page.tsx':()=>import('../../app/affiliates/admin/affiliates/page'),
'../../app/affiliates/admin/analytics/page.tsx':()=>import('../../app/affiliates/admin/analytics/page'),
'../../app/affiliates/admin/app/page.tsx':()=>import('../../app/affiliates/admin/app/page'),
'../../app/affiliates/admin/payouts/page.tsx':()=>import('../../app/affiliates/admin/payouts/page'),
'../../app/affiliates/admin/requests/page.tsx':()=>import('../../app/affiliates/admin/requests/page'),
'../../app/affiliates/dashboard/page.tsx':()=>import('../../app/affiliates/dashboard/page'),
'../../app/affiliates/dashboard/payouts/page.tsx':()=>import('../../app/affiliates/dashboard/payouts/page'),
'../../app/affiliates/dashboard/clients/page.tsx':()=>import('../../app/affiliates/dashboard/clients/page'),
'../../app/affiliates/dashboard/network/page.tsx':()=>import('../../app/affiliates/dashboard/network/page'),
};
const contracts = [
  ['admin/page', ['Affiliate operations','Revenue &amp; commission','Top affiliates by sales','Sync Coupons','Sync Woo','Test Email','Settle payouts','30d']],
  ['admin/affiliates/page', ['Manage affiliates','Pending payout','Paid lifetime','Export']],
  ['admin/analytics/page', ['Insights &amp; trends','Sales over time','Commission generated','Order count','Commission status','Top affiliates']],
  ['admin/app/page', ['App','Loading…']],
  ['admin/payouts/page', ['Settle commissions','Pending balances','Total pending','Paid lifetime','Export']],
  ['admin/requests/page', ['Affiliate requests']],
  ['dashboard/page', ['Your performance','Your promo code','Earnings over time','Order types','Earnings mix','Recent orders','Copy code','Payment info']],
  ['dashboard/payouts/page', ['Your payouts','Pending','Paid']],
  ['dashboard/clients/page', ['Your customers']],
  ['dashboard/network/page', ['Your referrals']],
] as const;
describe('original page render contracts',()=>{
  for(const [page, labels] of contracts) it(`${page} preserves original sections and controls`,async()=>{
    const Page=((await pages[`../../app/affiliates/${page}.tsx`]()) as {default: React.ComponentType}).default;
    const html=renderToStaticMarkup(createElement(Page));
    for(const label of labels) expect(html).toContain(label);
    expect(html).not.toContain('Export report');
    expect(html).not.toContain('From (New York)');
    expect(html).not.toContain('Shared category earnings');
  });
  it('detail keeps its original client and recruit cards without an appended report',()=>{
    const source=readFileSync('app/affiliates/admin/affiliates/[id]/page.tsx','utf8');
    for(const label of ['Total spent','Commission earned','Store revenue:']) expect(source).toContain(label);
    expect(source).not.toContain('<SharedProgram');
  });
});
