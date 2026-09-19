// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {CanonicalAffiliateControls} from '../../components/affiliates/shared/CanonicalAffiliateControls';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows canonical category settings and clears previous affiliate state on failure',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/a')?Response.json({affiliateId:'a',version:7,terms:[{store:'shopify',category:'supplements',version:7,terms:{directRate:0,recurringRate:2,referralRate:3,customerDiscount:4,referralBase:'revenue',effectiveAt:'2027-01-01T00:00:00.000Z'}}],outbox:[{store:'shopify',operation:'public-code',state:'blocked'}]}):Response.json({},{status:503})));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>root.render(React.createElement(CanonicalAffiliateControls,{affiliateId:'a'})));
 expect(host.textContent).toContain('Current canonical version: 7');expect(host.textContent).toContain('Direct 0%');expect(host.textContent).toContain('shopify · public-code · blocked');
 await act(async()=>root.render(React.createElement(CanonicalAffiliateControls,{affiliateId:'b'})));
 expect(host.textContent).not.toContain('version: 7');expect(host.textContent).toContain('Canonical settings unavailable');
 await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();
});
