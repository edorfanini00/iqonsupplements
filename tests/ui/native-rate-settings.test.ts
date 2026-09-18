// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Settings from '../../app/affiliates/admin/settings/page';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('mounts separate rates in native admin Settings with explicit affiliate scope and no Health defaults',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('/me')?{user:{role:'admin'}}:url.endsWith('/admin/affiliates')?{affiliates:[{id:'a',firstName:'Ada',lastName:'Test',commissionRate:15}]}:{affiliateId:'a',version:0,terms:[],outbox:[]})));
 render(React.createElement(Settings));
 fireEvent.change(await screen.findByLabelText('Affiliate scope'),{target:{value:'a'}});
 await screen.findByText('Current canonical version: 0');
 expect(screen.getByText(/Shopify terms are inactive until configured/)).toBeTruthy();
 expect(screen.getByText(/Existing Health peptide values are preserved/)).toBeTruthy();
 expect(screen.queryByText('Verify creator code')).toBeNull();
 expect((screen.getByLabelText('Direct commission (%)') as HTMLInputElement).value).toBe('');
 expect(screen.getByRole('option',{name:'Peptides · Woo'})).toBeTruthy();
 expect(screen.getByRole('option',{name:'Skincare · Shopify'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Direct commission (%)'),{target:{value:'17'}});
 fireEvent.change(screen.getByLabelText('Category'),{target:{value:'skincare'}});
 expect((screen.getByLabelText('Direct commission (%)') as HTMLInputElement).value).toBe('');
});
it('reads back explicit zero and the entire saved checkout policy without marking it active',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('/me')?{user:{role:'admin'}}:url.endsWith('/admin/affiliates')?{affiliates:[{id:'a',firstName:'Ada',lastName:'Test'}]}:{affiliateId:'a',version:2,terms:[{category:'supplements',store:'shopify',version:2,terms:{directRate:0,recurringRate:3,referralRate:2,customerDiscount:7,referralBase:'commission',effectiveAt:'2027-01-01T00:00:00.000Z',purchaseTypes:['subscription'],customerEligibility:'all',recurringCycleLimit:0,combinesWith:{orderDiscounts:true,productDiscounts:false,shippingDiscounts:true},eligibleProductIds:['gid://shopify/Product/1']}}],outbox:[{store:'shopify',operation:'public-code',state:'blocked'}]})));
 render(React.createElement(Settings));
 fireEvent.change(await screen.findByLabelText('Affiliate scope'),{target:{value:'a'}});
 await screen.findByText(/Direct 0%/);
 expect(screen.getByText('Saved checkout policy and product scope')).toBeTruthy();
 expect(screen.getByText(/"shippingDiscounts": true/)).toBeTruthy();
 expect(screen.getByText(/skincare: Unconfigured/)).toBeTruthy();
});
it('does not expose Settings to a disabled administrator',async()=>{
 const fetcher=vi.fn(async()=>Response.json({user:{role:'admin',status:'disabled'}}));vi.stubGlobal('fetch',fetcher);
 render(React.createElement(Settings));
 await screen.findByRole('alert');
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(screen.queryByLabelText('Affiliate scope')).toBeNull();
});
it.each(['affiliate','shop_manager','disabled'])('does not expose rate controls to %s',async(role)=>{
 const fetcher=vi.fn(async()=>Response.json({user:{role}}));vi.stubGlobal('fetch',fetcher);
 render(React.createElement(Settings));
 await waitFor(()=>expect(fetcher).toHaveBeenCalled());
 expect(screen.queryByLabelText('Affiliate scope')).toBeNull();
 expect(fetcher).toHaveBeenCalledTimes(1);
});
