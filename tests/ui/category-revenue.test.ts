// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach} from 'vitest';
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {CategoryRevenue} from '../../components/affiliates/shared/CategoryRevenue';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const unavailable={state:'unavailable',reason:'CANONICAL_ATTRIBUTION_UNAVAILABLE',currencies:null,orderCount:null};
const available=(amount:string)=>({state:'available',reason:null,currencies:[{currency:'USD',amount}],orderCount:1});
function report(start:string,end:string,amount='120.00',admin=true){return {version:1,provider:'shopify',period:{start,end,timezone:'America/New_York'},coverage:admin?{complete:true,reason:null}:undefined,categories:Object.fromEntries(['supplements','skincare','unclassified'].map(k=>[k,{attributedRevenue:unavailable,...(admin?{storeRevenue:available(amount)}:{})}]))};}
let root:Root;let host:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.unstubAllGlobals();});
async function mount(preset='m:2026-08',audience:'admin'|'affiliate'='admin'){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(React.createElement(CategoryRevenue,{preset,audience})));}
function fetchReport(admin=true){vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const u=new URL(input,'https://body.test');return Response.json(report(u.searchParams.get('start')!,u.searchParams.get('end')!,'120.00',admin));}));}
describe('canonical category cards independent of original Overview',()=>{
 it('uses exact Eastern month exclusive bounds, original StatCard styles and separates attributed/store',async()=>{fetchReport();await mount();const url=new URL((fetch as any).mock.calls[0][0],'https://body.test');expect(url.searchParams.get('start')).toBe('2026-08-01T04:00:00.000Z');expect(url.searchParams.get('end')).toBe('2026-09-01T04:00:00.000Z');expect(host.textContent).toContain('Supplements store revenue');expect(host.textContent).toContain('USD 120.00');expect(host.textContent).toContain('Attribution unavailable');expect(host.querySelector('.glass-surface')).not.toBeNull();});
 it('never displays store data in affiliate view even if an overbroad DTO arrives',async()=>{fetchReport(true);await mount('m:2026-08','affiliate');expect(host.textContent).not.toContain('120.00');expect(host.textContent).not.toContain('store revenue');});
 it('ignores old month success after newer month failure and clears previous totals immediately',async()=>{const pending:Array<{url:string,resolve:(r:Response)=>void}>=[];vi.stubGlobal('fetch',vi.fn((url:string)=>new Promise<Response>(resolve=>pending.push({url,resolve}))));await mount();await act(async()=>root.render(React.createElement(CategoryRevenue,{preset:'m:2026-09',audience:'admin'})));await act(async()=>pending[1].resolve(Response.json({error:'unavailable'},{status:503})));const u=new URL(pending[0].url,'https://body.test');await act(async()=>pending[0].resolve(Response.json(report(u.searchParams.get('start')!,u.searchParams.get('end')!,'9999.00'))));expect(host.textContent).toContain('Category reporting unavailable');expect(host.textContent).not.toContain('9999.00');});
 it('does not fabricate a currency for empty data, and rejects wrong period',async()=>{vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const u=new URL(input,'https://body.test');const r=report(u.searchParams.get('start')!,u.searchParams.get('end')!);for(const v of Object.values(r.categories) as any[]){v.storeRevenue.currencies=[];v.storeRevenue.orderCount=0;}return Response.json(r);}));await mount();expect(host.textContent).toContain('No matching orders');expect(host.textContent).not.toContain('$0');});
 it('does not fetch unsupported all-time range or leak a stale success',async()=>{fetchReport();await mount('all');expect(fetch).not.toHaveBeenCalled();expect(host.textContent).toContain('Choose a period of at most 366 days');});
});
